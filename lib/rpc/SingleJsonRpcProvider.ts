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

  private syncingDb: boolean = false
  private enableDbSync: boolean
  private providerStateSyncer: ProviderStateSyncer
  private healthScoreAtLastSync: number = 0
  private lastDbSyncTimestampInMs: number = 0

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

  hasEnoughWaitSinceLastDbSync(waitTimeRequirementInMs: number): boolean {
    this.log.debug(
      `${this.url}: hasEnoughWaitSinceLastDbSync? waited ${
        Date.now() - this.lastDbSyncTimestampInMs
      } ms, wait requirement: ${waitTimeRequirementInMs} ms`
    )
    return Date.now() - this.lastDbSyncTimestampInMs > waitTimeRequirementInMs
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
      this.logLatencyMetrics(perf.methodName, perf.latencyInMs)
      this.lastEvaluatedLatencyInMs = perf.latencyInMs
      this.lastLatencyEvaluationTimestampInMs = perf.startTimestampInMs
      this.lastLatencyEvaluationApiName = perf.methodName
      this.evaluatingLatency = false
    } else {
      this.logLatencyMetrics(perf.methodName, perf.latencyInMs)
      if (
        perf.startTimestampInMs - this.lastLatencyEvaluationTimestampInMs >
          1000 * this.config.LATENCY_EVALUATION_WAIT_PERIOD_IN_S &&
        MAJOR_METHOD_NAMES.includes(perf.methodName)
      ) {
        this.lastEvaluatedLatencyInMs = perf.latencyInMs
        this.lastLatencyEvaluationTimestampInMs = perf.startTimestampInMs
        this.lastLatencyEvaluationApiName = perf.methodName
      }
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
      this.logLatencyMetrics(perf.methodName, perf.latencyInMs)
      this.lastEvaluatedLatencyInMs = perf.latencyInMs
      this.lastLatencyEvaluationTimestampInMs = perf.startTimestampInMs
      this.lastLatencyEvaluationApiName = perf.methodName
      this.evaluatingLatency = false
    } else {
      this.logLatencyMetrics(perf.methodName, perf.latencyInMs)
      if (
        perf.startTimestampInMs - this.lastLatencyEvaluationTimestampInMs >
          1000 * this.config.LATENCY_EVALUATION_WAIT_PERIOD_IN_S &&
        MAJOR_METHOD_NAMES.includes(perf.methodName)
      ) {
        this.lastEvaluatedLatencyInMs = perf.latencyInMs
        this.lastLatencyEvaluationTimestampInMs = perf.startTimestampInMs
        this.lastLatencyEvaluationApiName = perf.methodName
      }
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
    this.log.debug(`${this.providerId}: checkLastCallPerformance: method: ${method}`)
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
    this.logCheckHealth()
    this.evaluatingHealthiness = true
    try {
      await this.getBlockNumber_EvaluateHealthiness()
    } catch (error: any) {
      this.log.error(`Encounter error for shadow call for evaluating healthiness: ${JSON.stringify(error)}`)
      // Swallow the error.
    }
  }

  async evaluateLatency(methodName: string, ...args: any[]) {
    this.log.debug(`${this.url}: Evaluate for latency... methodName: ${methodName}`)
    this.logEvaluateLatency()
    this.evaluatingLatency = true
    try {
      await (this as any)[`${methodName}_EvaluateLatency`](...args)
    } catch (error: any) {
      this.log.error(`Encounter error for shadow evaluate latency call: ${JSON.stringify(error)}`)
      // Swallow the error.
    }
  }

  // Notice that AWS metrics have to be non-negative.
  logHealthMetrics() {
    metric.putMetric(`${this.metricPrefix}_health_score`, -this.healthScore, MetricLoggerUnit.None)
  }

  logLatencyMetrics(methodName: string, latencyInMs: number) {
    metric.putMetric(`${this.metricPrefix}_evaluated_latency_${methodName}`, latencyInMs, MetricLoggerUnit.None)
  }

  logCheckHealth() {
    metric.putMetric(`${this.metricPrefix}_check_health`, 1, MetricLoggerUnit.Count)
  }

  logEvaluateLatency() {
    metric.putMetric(`${this.metricPrefix}_evaluate_latency`, 1, MetricLoggerUnit.Count)
  }

  logProviderSelection() {
    metric.putMetric(`${this.metricPrefix}_selected`, 1, MetricLoggerUnit.Count)
  }

  logDbSyncSuccess() {
    metric.putMetric(`${this.metricPrefix}_db_sync_SUCCESS`, 1, MetricLoggerUnit.Count)
  }

  logDbSyncFailure() {
    metric.putMetric(`${this.metricPrefix}_db_sync_FAIL`, 1, MetricLoggerUnit.Count)
  }

  private async wrappedFunctionCall(
    callType: CallType,
    fnName: string,
    fn: (...args: any[]) => Promise<any>,
    ...args: any[]
  ): Promise<any> {
    this.log.debug(
      `SingleJsonRpcProvider: wrappedFunctionCall: callType: ${callType}, provider: ${
        this.url
      }, fnName: ${fnName}, fn: ${fn}, args: ${JSON.stringify([...args])}`
    )
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
      this.log.debug(
        `Provider call failed: provider: ${this.url}, fnName: ${fnName}, fn: ${fn}, args: ${JSON.stringify([
          ...args,
        ])}, error details: ${JSON.stringify(error)}`
      )
      throw error
    } finally {
      perf.latencyInMs = Date.now() - perf.startTimestampInMs
      this.checkLastCallPerformance(perf)
      this.updateHealthyStatus()
      if (this.enableDbSync) {
        if (
          !this.syncingDb &&
          MAJOR_METHOD_NAMES.includes(perf.methodName) &&
          this.hasEnoughWaitSinceLastDbSync(1000 * this.config.DB_SYNC_INTERVAL_IN_S)
        ) {
          this.syncingDb = true
          // Fire and forget. Won't check the sync result.
          this.syncAndUpdateProviderState()
        }
      }
      this.lastCallTimestampInMs = perf.startTimestampInMs
    }
  }

  private async syncAndUpdateProviderState() {
    try {
      const newState: ProviderState | null = await this.providerStateSyncer.syncWithRepository(
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
        this.log.debug(`${this.providerId}: Synced with storage: new health score ${this.healthScore}`)
        this.updateHealthyStatus()

        // Update latency stat
        this.updateLatencyStat(newState)
      }
      this.lastDbSyncTimestampInMs = Date.now()
      this.log.debug(`${this.providerId}: Successfully synced with DB and updated states`)
      this.logDbSyncSuccess()
    } catch (err: any) {
      this.log.error(`${this.providerId}: Encountered unhandled error when sync provider state: ${JSON.stringify(err)}`)
      this.logDbSyncFailure()
      // Won't throw. A fail of sync won't affect how we do health state update locally.
    } finally {
      this.syncingDb = false
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

  override getBlockNumber(): Promise<number> {
    return this.wrappedFunctionCall(CallType.NORMAL, 'getBlockNumber', this._getBlockNumber.bind(this))
  }

  override getBlockWithTransactions(
    blockHashOrBlockTag: BlockTag | string | Promise<BlockTag | string>
  ): Promise<BlockWithTransactions> {
    return this.wrappedFunctionCall(
      CallType.NORMAL,
      'getBlockWithTransactions',
      super.getBlockWithTransactions.bind(this),
      blockHashOrBlockTag
    )
  }

  override getCode(addressOrName: string | Promise<string>, blockTag?: BlockTag | Promise<BlockTag>): Promise<string> {
    return this.wrappedFunctionCall(CallType.NORMAL, 'getCode', super.getCode.bind(this), addressOrName, blockTag)
  }

  override getGasPrice(): Promise<BigNumber> {
    return this.wrappedFunctionCall(CallType.NORMAL, 'getGasPrice', super.getGasPrice.bind(this))
  }

  override getLogs(filter: Filter): Promise<Array<Log>> {
    return this.wrappedFunctionCall(CallType.NORMAL, 'getLogs', super.getLogs.bind(this), filter)
  }

  override getStorageAt(
    addressOrName: string | Promise<string>,
    position: BigNumberish | Promise<BigNumberish>,
    blockTag?: BlockTag | Promise<BlockTag>
  ): Promise<string> {
    return this.wrappedFunctionCall(
      CallType.NORMAL,
      'getStorageAt',
      super.getStorageAt.bind(this),
      addressOrName,
      position,
      blockTag
    )
  }

  override getTransaction(transactionHash: string | Promise<string>): Promise<TransactionResponse> {
    return this.wrappedFunctionCall(CallType.NORMAL, 'getTransaction', super.getTransaction.bind(this), transactionHash)
  }

  override getTransactionCount(
    addressOrName: string | Promise<string>,
    blockTag?: BlockTag | Promise<BlockTag>
  ): Promise<number> {
    return this.wrappedFunctionCall(
      CallType.NORMAL,
      'getTransactionCount',
      super.getTransactionCount.bind(this),
      addressOrName,
      blockTag
    )
  }

  override getTransactionReceipt(transactionHash: string | Promise<string>): Promise<TransactionReceipt> {
    return this.wrappedFunctionCall(
      CallType.NORMAL,
      'getTransactionReceipt',
      super.getTransactionReceipt.bind(this),
      transactionHash
    )
  }

  override lookupAddress(address: string | Promise<string>): Promise<string | null> {
    return this.wrappedFunctionCall(CallType.NORMAL, 'lookupAddress', super.lookupAddress.bind(this), address)
  }

  override resolveName(name: string | Promise<string>): Promise<string | null> {
    return this.wrappedFunctionCall(CallType.NORMAL, 'resolveName', super.resolveName.bind(this), name)
  }

  override sendTransaction(signedTransaction: string | Promise<string>): Promise<TransactionResponse> {
    return this.wrappedFunctionCall(
      CallType.NORMAL,
      'sendTransaction',
      super.sendTransaction.bind(this),
      signedTransaction
    )
  }

  override waitForTransaction(
    transactionHash: string,
    confirmations?: number,
    timeout?: number
  ): Promise<TransactionReceipt> {
    return this.wrappedFunctionCall(
      CallType.NORMAL,
      'waitForTransaction',
      super.waitForTransaction.bind(this),
      transactionHash,
      confirmations,
      timeout
    )
  }

  override call(transaction: Deferrable<TransactionRequest>, blockTag?: BlockTag | Promise<BlockTag>): Promise<string> {
    return this.wrappedFunctionCall(CallType.NORMAL, 'call', super.call.bind(this), transaction, blockTag)
  }

  override send(method: string, params: Array<any>): Promise<any> {
    return this.wrappedFunctionCall(CallType.NORMAL, 'send', super.send.bind(this), method, params)
  }

  ///////////////////// Begin of special functions /////////////////////

  // Wrap another layer only for the sake of ease unit testing.
  // We will test this API to represent the tests of other similar implemented APIs.
  private _getBlockNumber(): Promise<number> {
    return super.getBlockNumber()
  }

  private getBlockNumber_EvaluateHealthiness(): Promise<number> {
    return this.wrappedFunctionCall(CallType.HEALTH_CHECK, 'getBlockNumber', this._getBlockNumber.bind(this))
  }

  // @ts-ignore
  private getBlockNumber_EvaluateLatency(): Promise<number> {
    return this.wrappedFunctionCall(CallType.LATENCY_EVALUATION, 'getBlockNumber', this._getBlockNumber.bind(this))
  }

  // @ts-ignore
  private call_EvaluateLatency(
    transaction: Deferrable<TransactionRequest>,
    blockTag?: BlockTag | Promise<BlockTag>
  ): Promise<string> {
    return this.wrappedFunctionCall(CallType.LATENCY_EVALUATION, 'call', super.call.bind(this), transaction, blockTag)
  }

  // @ts-ignore
  private send_EvaluateLatency(method: string, params: Array<any>): Promise<any> {
    return this.wrappedFunctionCall(CallType.LATENCY_EVALUATION, 'send', super.send.bind(this), method, params)
  }
}
