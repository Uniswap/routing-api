import { StaticJsonRpcProvider, TransactionRequest } from '@ethersproject/providers'
import { DEFAULT_SINGLE_PROVIDER_CONFIG, SingleJsonRpcProviderConfig } from './config'
import { metric, MetricLoggerUnit } from '@uniswap/smart-order-router'
import {
  BlockTag,
  BlockWithTransactions,
  Filter,
  Log,
  TransactionReceipt,
  TransactionResponse,
} from '@ethersproject/abstract-provider'
import { BigNumber, BigNumberish } from '@ethersproject/bignumber'
import { Deferrable } from '@ethersproject/properties'
import { deriveProviderName } from '../handlers/evm/provider/ProviderName'
import Logger from 'bunyan'
import { Network } from '@ethersproject/networks'
import { ProviderStateSyncer } from './ProviderStateSyncer'
import { ProviderState } from './ProviderState'

export const MAJOR_METHOD_NAMES: string[] = ['getBlockNumber', 'call', 'send']

enum CallType {
  NORMAL,
  // Extra call to check health against an unhealthy provider
  HEALTH_CHECK,
  // Extra call to check latency against a healthy provider
  LATENCY_EVALUATION,
}

interface SingleCallPerf {
  callType: CallType
  methodName: string
  succeed: boolean
  latencyInMs: number
  startTimestampInMs: number
}

// TODO(jie): Implement block-aligned cache
export class SingleJsonRpcProvider extends StaticJsonRpcProvider {
  readonly url: string
  readonly providerName: string
  readonly providerId: string

  private healthScore: number = 0
  private healthy: boolean = true

  private lastCallTimestampInMs: number = 0

  private evaluatingHealthiness: boolean = false
  private lastHealthinessEvaluationTimestampInMs: number = 0

  private evaluatingLatency: boolean = false
  private lastLatencyEvaluationTimestampInMs: number = 0
  private lastEvaluatedLatencyInMs: number = 0
  private lastLatencyEvaluationApiName: string
  private recentAverageLatencyInMs: number = 0

  private config: SingleJsonRpcProviderConfig
  private readonly metricPrefix: string
  private readonly log: Logger

  private enableDbSync: boolean
  private providerStateSyncer: ProviderStateSyncer
  private healthScoreAtLastSync: number = 0

  constructor(
    network: Network,
    url: string,
    log: Logger,
    config: SingleJsonRpcProviderConfig = DEFAULT_SINGLE_PROVIDER_CONFIG
  ) {
    super(url, network)
    this.url = url
    this.log = log
    this.providerName = deriveProviderName(url)
    this.providerId = `${network.chainId.toString()}_${this.providerName}`
    this.config = config
    this.metricPrefix = `RPC_GATEWAY_${this.network.chainId}_${this.providerName}`
    this.enableDbSync = config.ENABLE_DB_SYNC
    if (this.enableDbSync) {
      const dbTableName = process.env['RPC_PROVIDER_HEALTH_TABLE_NAME']!
      if (dbTableName === undefined) {
        throw new Error('Environment variable RPC_PROVIDER_HEALTH_TABLE_NAME is missing!')
      }
      this.providerStateSyncer = new ProviderStateSyncer(
        dbTableName,
        this.providerId,
        this.config.DB_SYNC_INTERVAL_IN_S,
        this.config.LATENCY_STAT_HISTORY_WINDOW_LENGTH_IN_S,
        log
      )
    }
  }

  isHealthy() {
    return this.healthy
  }

  recentAverageLatency() {
    return this.recentAverageLatencyInMs
  }

  hasEnoughWaitSinceLastLatencyEvaluation(waitTimeRequirementInMs: number): boolean {
    this.log.debug(
      `${this.url}: hasEnoughWaitSinceLastLatencyEvaluation? waited ${
        Date.now() - this.lastLatencyEvaluationTimestampInMs
      } ms, wait requirement: ${waitTimeRequirementInMs} ms`
    )
    return Date.now() - this.lastLatencyEvaluationTimestampInMs > waitTimeRequirementInMs
  }

  hasEnoughWaitSinceLastHealthinessEvaluation(waitTimeRequirementInMs: number): boolean {
    this.log.debug(
      `${this.url}: hasEnoughWaitSinceLastHealthinessEvaluation? waited ${
        Date.now() - this.lastHealthinessEvaluationTimestampInMs
      } ms, wait requirement: ${waitTimeRequirementInMs} ms`
    )
    return Date.now() - this.lastHealthinessEvaluationTimestampInMs > waitTimeRequirementInMs
  }

  isEvaluatingHealthiness(): boolean {
    console.log(`evaluatingHealthiness: ${this.evaluatingHealthiness}`)
    return this.evaluatingHealthiness
  }

  isEvaluatingLatency(): boolean {
    return this.evaluatingLatency
  }

  private recordError(perf: SingleCallPerf) {
    if (perf.callType === CallType.HEALTH_CHECK) {
      this.lastHealthinessEvaluationTimestampInMs = perf.startTimestampInMs
      this.evaluatingHealthiness = false
    } else if (perf.callType === CallType.LATENCY_EVALUATION) {
      this.evaluatingLatency = false
    }

    this.healthScore += this.config.ERROR_PENALTY
    this.log.error(
      `${this.url}: method: ${perf.methodName} error penalty ${this.config.ERROR_PENALTY}, score => ${this.healthScore}`
    )
  }

  private recordHighLatency(perf: SingleCallPerf) {
    if (perf.callType === CallType.HEALTH_CHECK) {
      this.lastHealthinessEvaluationTimestampInMs = perf.startTimestampInMs
      this.evaluatingHealthiness = false
    } else if (perf.callType === CallType.LATENCY_EVALUATION) {
      this.lastEvaluatedLatencyInMs = perf.latencyInMs
      this.lastLatencyEvaluationTimestampInMs = perf.startTimestampInMs
      this.lastLatencyEvaluationApiName = perf.methodName
      this.logLatencyMetrics()
      this.evaluatingLatency = false
    } else if (
      perf.startTimestampInMs - this.lastLatencyEvaluationTimestampInMs >
        1000 * this.config.LATENCY_EVALUATION_WAIT_PERIOD_IN_S &&
      MAJOR_METHOD_NAMES.includes(perf.methodName)
    ) {
      this.lastEvaluatedLatencyInMs = perf.latencyInMs
      this.lastLatencyEvaluationTimestampInMs = perf.startTimestampInMs
      this.lastLatencyEvaluationApiName = perf.methodName
      this.logLatencyMetrics()
    }

    this.healthScore += this.config.HIGH_LATENCY_PENALTY
    this.log.error(
      `${this.url}: method: ${perf.methodName}, high latency penalty ${this.config.ERROR_PENALTY}, score => ${this.healthScore}`
    )
  }

  private recordProviderCallSuccess(perf: SingleCallPerf, timeFromLastCallInMs: number) {
    if (perf.callType === CallType.HEALTH_CHECK) {
      this.lastHealthinessEvaluationTimestampInMs = perf.startTimestampInMs
      this.evaluatingHealthiness = false
    } else if (perf.callType === CallType.LATENCY_EVALUATION) {
      this.lastEvaluatedLatencyInMs = perf.latencyInMs
      this.lastLatencyEvaluationTimestampInMs = perf.startTimestampInMs
      this.lastLatencyEvaluationApiName = perf.methodName
      this.logLatencyMetrics()
      this.evaluatingLatency = false
    } else if (
      perf.startTimestampInMs - this.lastLatencyEvaluationTimestampInMs >
        1000 * this.config.LATENCY_EVALUATION_WAIT_PERIOD_IN_S &&
      MAJOR_METHOD_NAMES.includes(perf.methodName)
    ) {
      this.lastEvaluatedLatencyInMs = perf.latencyInMs
      this.lastLatencyEvaluationTimestampInMs = perf.startTimestampInMs
      this.lastLatencyEvaluationApiName = perf.methodName
      this.logLatencyMetrics()
    }

    if (this.healthScore === 0) {
      return
    }
    if (timeFromLastCallInMs <= 0) {
      return
    }
    timeFromLastCallInMs = Math.min(timeFromLastCallInMs, this.config.RECOVER_MAX_WAIT_TIME_TO_ACKNOWLEDGE_IN_MS)
    this.healthScore += timeFromLastCallInMs * this.config.RECOVER_SCORE_PER_MS
    if (this.healthScore > 0) {
      this.healthScore = 0
    }
    this.log.debug(
      `${this.url}: healthy: ${this.healthy}, recovery ${timeFromLastCallInMs} * ${
        this.config.RECOVER_SCORE_PER_MS
      } = ${timeFromLastCallInMs * this.config.RECOVER_SCORE_PER_MS}, score => ${this.healthScore}`
    )
  }

  private checkLastCallPerformance(perf: SingleCallPerf) {
    const method = perf.methodName
    this.log.debug(`checkLastCallPerformance: method: ${method}`)
    if (!perf.succeed) {
      metric.putMetric(`${this.metricPrefix}_${method}_FAILED`, 1, MetricLoggerUnit.Count)
      this.recordError(perf)
    } else {
      if (perf.latencyInMs > this.config.MAX_LATENCY_ALLOWED_IN_MS) {
        metric.putMetric(`${this.metricPrefix}_${method}_SUCCESS_HIGH_LATENCY`, 1, MetricLoggerUnit.Count)
        this.recordHighLatency(perf)
      } else {
        metric.putMetric(`${this.metricPrefix}_${method}_SUCCESS`, 1, MetricLoggerUnit.Count)
        this.log.debug(`${this.url} method: ${method} succeeded`)
        this.recordProviderCallSuccess(perf, perf.startTimestampInMs - this.lastCallTimestampInMs)
      }
    }
  }

  async evaluateHealthiness() {
    this.log.debug(`${this.url}: Evaluate healthiness for unhealthy provider...`)
    this.evaluatingHealthiness = true
    try {
      await this.getBlockNumber(CallType.HEALTH_CHECK)
    } catch (error: any) {
      this.log.error(`Encounter error for shadow call for evaluating healthiness: ${JSON.stringify(error)}`)
      // Swallow the error.
    }
  }

  async evaluateLatency(methodName: string, ...args: any[]) {
    this.log.debug(`${this.url}: Evaluate for latency...`)
    this.evaluatingLatency = true
    try {
      await (this as any)[`${methodName}`](CallType.LATENCY_EVALUATION, ...args)
    } catch (error: any) {
      this.log.error(`Encounter error for shadow evaluate latency call: ${JSON.stringify(error)}`)
      // Swallow the error.
    }
  }

  // Notice that AWS metrics have to be non-negative.
  logHealthMetrics() {
    metric.putMetric(`${this.metricPrefix}_health_score`, -this.healthScore, MetricLoggerUnit.None)
  }

  logLatencyMetrics() {
    metric.putMetric(
      `${this.metricPrefix}_evaluated_latency_${this.lastLatencyEvaluationApiName}`,
      this.lastEvaluatedLatencyInMs,
      MetricLoggerUnit.None
    )
    this.log.debug(
      {
        lastEvaluatedLatencyInMs: this.lastEvaluatedLatencyInMs,
        lastLatencyEvaluationTimestampInMs: this.lastLatencyEvaluationTimestampInMs,
        lastLatencyEvaluationApiName: this.lastLatencyEvaluationApiName,
      },
      'Latency evaluation recorded'
    )
  }

  logProviderSelection() {
    metric.putMetric(`${this.metricPrefix}_selected`, 1, MetricLoggerUnit.Count)
  }

  // Wrap another layer only for the sake of ease unit testing.
  // We will test this API to represent the tests of other similar implemented APIs.
  private _getBlockNumber(): Promise<number> {
    return super.getBlockNumber()
  }

  private async wrappedFunctionCall(
    callType: CallType,
    fnName: string,
    fn: (...args: any[]) => Promise<any>,
    ...args: any[]
  ): Promise<any> {
    this.log.debug(`SingleJsonRpcProvider: wrappedFunctionCall: fnName: ${fnName}, fn: ${fn}, args: ${[...args]}`)
    const perf: SingleCallPerf = {
      callType: callType,
      methodName: fnName,
      succeed: true,
      latencyInMs: 0,
      startTimestampInMs: Date.now(),
    }
    try {
      return await fn(...args)
    } catch (error: any) {
      perf.succeed = false
      this.log.error(JSON.stringify(error))
      throw error
    } finally {
      perf.latencyInMs = Date.now() - perf.startTimestampInMs
      this.checkLastCallPerformance(perf)
      this.updateHealthyStatus()
      if (this.enableDbSync) {
        // Fire and forget. Won't check the sync result.
        this.maybeSyncAndUpdateProviderState()
      }
      this.lastCallTimestampInMs = perf.startTimestampInMs
    }
  }

  private async maybeSyncAndUpdateProviderState() {
    try {
      const newState: ProviderState | null = await this.providerStateSyncer.maybeSyncWithRepository(
        this.healthScore - this.healthScoreAtLastSync,
        this.healthScore,
        this.lastEvaluatedLatencyInMs,
        this.lastLatencyEvaluationTimestampInMs,
        this.lastLatencyEvaluationApiName
      )
      if (newState !== null) {
        // Update health state
        this.healthScoreAtLastSync = newState.healthScore
        this.healthScore = this.healthScoreAtLastSync
        this.log.debug(`Synced with storage: new health score ${this.healthScore}`)
        this.updateHealthyStatus()

        // Update latency stat
        this.updateLatencyStat(newState)
      }
    } catch (err: any) {
      this.log.error(`Encountered unhandled error when sync provider state: ${JSON.stringify(err)}`)
      // Won't throw. A fail of sync won't affect how we do health state update locally.
    }
  }

  private updateHealthyStatus() {
    if (this.healthy && this.healthScore < this.config.HEALTH_SCORE_FALLBACK_THRESHOLD) {
      this.healthy = false
      this.log.warn(`${this.url} drops to unhealthy`)
    } else if (!this.healthy && this.healthScore > this.config.HEALTH_SCORE_RECOVER_THRESHOLD) {
      this.healthy = true
      this.log.warn(`${this.url} resumes to healthy`)
    }
  }

  private updateLatencyStat(state: ProviderState) {
    const timestampInMs = Date.now()
    let latencySum = 0
    let latencyCount = 0
    for (const latency of state.latencies) {
      if (latency.timestampInMs > timestampInMs - 1000 * this.config.LATENCY_STAT_HISTORY_WINDOW_LENGTH_IN_S) {
        latencySum += latency.latencyInMs
        latencyCount++
      }
    }
    this.recentAverageLatencyInMs = latencySum / latencyCount
  }

  ///////////////////// Begin of override functions /////////////////////

  override getBlockNumber(callType = CallType.NORMAL): Promise<number> {
    return this.wrappedFunctionCall(callType, 'getBlockNumber', this._getBlockNumber.bind(this))
  }

  override getBlockWithTransactions(
    blockHashOrBlockTag: BlockTag | string | Promise<BlockTag | string>,
    callType = CallType.NORMAL
  ): Promise<BlockWithTransactions> {
    return this.wrappedFunctionCall(
      callType,
      'getBlockWithTransactions',
      super.getBlockWithTransactions.bind(this),
      blockHashOrBlockTag
    )
  }

  override getCode(
    addressOrName: string | Promise<string>,
    blockTag?: BlockTag | Promise<BlockTag>,
    callType = CallType.NORMAL
  ): Promise<string> {
    return this.wrappedFunctionCall(callType, 'getCode', super.getCode.bind(this), addressOrName, blockTag)
  }

  override getGasPrice(callType = CallType.NORMAL): Promise<BigNumber> {
    return this.wrappedFunctionCall(callType, 'getGasPrice', super.getGasPrice.bind(this))
  }

  override getLogs(filter: Filter, callType = CallType.NORMAL): Promise<Array<Log>> {
    return this.wrappedFunctionCall(callType, 'getLogs', super.getLogs.bind(this), filter)
  }

  override getStorageAt(
    addressOrName: string | Promise<string>,
    position: BigNumberish | Promise<BigNumberish>,
    blockTag?: BlockTag | Promise<BlockTag>,
    callType = CallType.NORMAL
  ): Promise<string> {
    return this.wrappedFunctionCall(
      callType,
      'getStorageAt',
      super.getStorageAt.bind(this),
      addressOrName,
      position,
      blockTag
    )
  }

  override getTransaction(
    transactionHash: string | Promise<string>,
    callType = CallType.NORMAL
  ): Promise<TransactionResponse> {
    return this.wrappedFunctionCall(callType, 'getTransaction', super.getTransaction.bind(this), transactionHash)
  }

  override getTransactionCount(
    addressOrName: string | Promise<string>,
    blockTag?: BlockTag | Promise<BlockTag>,
    callType = CallType.NORMAL
  ): Promise<number> {
    return this.wrappedFunctionCall(
      callType,
      'getTransactionCount',
      super.getTransactionCount.bind(this),
      addressOrName,
      blockTag
    )
  }

  override getTransactionReceipt(
    transactionHash: string | Promise<string>,
    callType = CallType.NORMAL
  ): Promise<TransactionReceipt> {
    return this.wrappedFunctionCall(
      callType,
      'getTransactionReceipt',
      super.getTransactionReceipt.bind(this),
      transactionHash
    )
  }

  override lookupAddress(address: string | Promise<string>, callType = CallType.NORMAL): Promise<string | null> {
    return this.wrappedFunctionCall(callType, 'lookupAddress', super.lookupAddress.bind(this), address)
  }

  override resolveName(name: string | Promise<string>, callType = CallType.NORMAL): Promise<string | null> {
    return this.wrappedFunctionCall(callType, 'resolveName', super.resolveName.bind(this), name)
  }

  override sendTransaction(
    signedTransaction: string | Promise<string>,
    callType = CallType.NORMAL
  ): Promise<TransactionResponse> {
    return this.wrappedFunctionCall(callType, 'sendTransaction', super.sendTransaction.bind(this), signedTransaction)
  }

  override waitForTransaction(
    transactionHash: string,
    confirmations?: number,
    timeout?: number,
    callType = CallType.NORMAL
  ): Promise<TransactionReceipt> {
    return this.wrappedFunctionCall(
      callType,
      'waitForTransaction',
      super.waitForTransaction.bind(this),
      transactionHash,
      confirmations,
      timeout
    )
  }

  override call(
    transaction: Deferrable<TransactionRequest>,
    blockTag?: BlockTag | Promise<BlockTag>,
    callType = CallType.NORMAL
  ): Promise<string> {
    return this.wrappedFunctionCall(callType, 'call', super.call.bind(this), transaction, blockTag)
  }
  override send(method: string, params: Array<any>, callType = CallType.NORMAL): Promise<any> {
    return this.wrappedFunctionCall(callType, 'send', super.send.bind(this), method, params)
  }
}
