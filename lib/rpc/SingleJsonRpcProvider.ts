import { StaticJsonRpcProvider, TransactionRequest } from '@ethersproject/providers'
import { SingleJsonRpcProviderConfig } from './config'
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
import { getProviderId } from './utils'
import { ProviderHealthiness } from './ProviderHealthState'
import { ProviderHealthStateRepository } from './ProviderHealthStateRepository'
import { ProviderHealthStateDynamoDbRepository } from './ProviderHealthStateDynamoDbRepository'

export const MAJOR_METHOD_NAMES: string[] = ['getBlockNumber', 'call', 'send']

export enum CallType {
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

export class SingleJsonRpcProvider extends StaticJsonRpcProvider {
  readonly url: string
  readonly providerName: string
  readonly providerId: string

  private healthiness: ProviderHealthiness = ProviderHealthiness.HEALTHY

  private evaluatingHealthiness: boolean = false
  private lastHealthinessEvaluationTimestampInMs: number = 0

  private evaluatingLatency: boolean = false
  private lastLatencyEvaluationTimestampInMs: number = 0

  private config: SingleJsonRpcProviderConfig
  private readonly metricPrefix: string
  private readonly log: Logger

  private enableDbSync: boolean
  private syncingDb: boolean = false
  private dbSyncSampleProb: number
  private healthStateRepository: ProviderHealthStateRepository
  private lastDbSyncTimestampInMs: number = 0

  constructor(
    network: Network,
    url: string,
    log: Logger,
    config: SingleJsonRpcProviderConfig,
    enableDbSync: boolean,
    dbSyncSampleProb: number
  ) {
    super(url, network)
    this.url = url
    this.log = log
    this.providerName = deriveProviderName(url)
    this.providerId = getProviderId(network.chainId, this.providerName)
    this.config = config
    this.metricPrefix = `RPC_GATEWAY_${this.network.chainId}_${this.providerName}`
    this.enableDbSync = enableDbSync
    this.dbSyncSampleProb = dbSyncSampleProb

    if (this.enableDbSync) {
      const dbTableName = process.env['RPC_PROVIDER_HEALTH_TABLE_NAME']!
      if (dbTableName === undefined) {
        throw new Error('Environment variable RPC_PROVIDER_HEALTH_TABLE_NAME is missing!')
      }
      this.healthStateRepository = new ProviderHealthStateDynamoDbRepository(dbTableName, log)
      // Fire and forget. Won't check the sync result. But usually the sync will finish before the end of initialization
      // of the current lambda, so it should already know the latest provider health states before serving requests.
      this.syncAndUpdateProviderHealthiness()
    }
  }

  isHealthy() {
    return this.healthiness === ProviderHealthiness.HEALTHY
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

  private recordProviderCallError(perf: SingleCallPerf) {
    this.logProviderCallFailureMetric(perf.methodName)
    this.log.error(`Failed at calling provider: ${this.url}: method: ${perf.methodName}`)

    if (perf.callType === CallType.HEALTH_CHECK) {
      this.lastHealthinessEvaluationTimestampInMs = perf.startTimestampInMs
      this.evaluatingHealthiness = false
    } else if (perf.callType === CallType.LATENCY_EVALUATION) {
      this.lastLatencyEvaluationTimestampInMs = perf.startTimestampInMs
      this.evaluatingLatency = false
    }
  }

  private recordProviderCallSuccess(perf: SingleCallPerf) {
    this.logProviderCallSuccessMetric(perf.methodName)
    this.logLatencyMetrics(perf.methodName, perf.latencyInMs, perf.callType)
    this.log.debug(`Succeeded at calling provider: ${this.url} method: ${perf.methodName}`)

    if (perf.callType === CallType.HEALTH_CHECK) {
      this.lastHealthinessEvaluationTimestampInMs = perf.startTimestampInMs
      this.evaluatingHealthiness = false
    } else if (perf.callType === CallType.LATENCY_EVALUATION) {
      this.lastLatencyEvaluationTimestampInMs = perf.startTimestampInMs
      this.evaluatingLatency = false
    }
  }

  private checkLastCallPerformance(perf: SingleCallPerf) {
    const method = perf.methodName
    this.log.debug(`${this.providerId}: checkLastCallPerformance: method: ${method}`)
    if (!perf.succeed) {
      this.recordProviderCallError(perf)
    } else {
      this.recordProviderCallSuccess(perf)
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

  logProviderCallSuccessMetric(methodName: string) {
    metric.putMetric(`${this.metricPrefix}_SUCCESS`, 1, MetricLoggerUnit.Count)
    metric.putMetric(`${this.metricPrefix}_${methodName}_SUCCESS`, 1, MetricLoggerUnit.Count)
  }

  logProviderCallFailureMetric(methodName: string) {
    metric.putMetric(`${this.metricPrefix}_FAILED`, 1, MetricLoggerUnit.Count)
    metric.putMetric(`${this.metricPrefix}_${methodName}_FAILED`, 1, MetricLoggerUnit.Count)
  }

  logLatencyMetrics(methodName: string, latencyInMs: number, callType: CallType) {
    metric.putMetric(
      `${this.metricPrefix}_evaluated_${callType}_latency_${methodName}`,
      latencyInMs,
      MetricLoggerUnit.Milliseconds
    )
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

  logDbSyncRequested() {
    metric.putMetric(`${this.metricPrefix}_db_sync_REQUESTED`, 1, MetricLoggerUnit.Count)
  }

  logDbSyncSampled() {
    metric.putMetric(`${this.metricPrefix}_db_sync_SAMPLED`, 1, MetricLoggerUnit.Count)
  }

  logDbSyncSuccess() {
    metric.putMetric(`${this.metricPrefix}_db_sync_SUCCESS`, 1, MetricLoggerUnit.Count)
  }

  logDbSyncFailure() {
    metric.putMetric(`${this.metricPrefix}_db_sync_FAIL`, 1, MetricLoggerUnit.Count)
  }

  logHealthinessChanged(newHealthiness: ProviderHealthiness) {
    metric.putMetric(`${this.metricPrefix}_becomes_${newHealthiness}`, 1, MetricLoggerUnit.Count)
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
      // TODO: consolidate start time here and above
      perf.startTimestampInMs = Date.now()
      const result = await fn(...args)
      perf.latencyInMs = Date.now() - perf.startTimestampInMs

      if (this.url.startsWith('https://eth-mainnet-fast.g.alchemy.com') && perf.latencyInMs >= 500) {
        this.log.warn(
          `Provider call latency is high: provider: ${this.url}, fnName: ${fnName}, fn: ${fn}, args: ${JSON.stringify([
            ...args,
          ])}, latency: ${perf.latencyInMs}`
        )
      }

      return result
    } catch (error: any) {
      perf.succeed = false
      this.log.debug(
        `Provider call failed: provider: ${this.url}, fnName: ${fnName}, fn: ${fn}, args: ${JSON.stringify([
          ...args,
        ])}, error details: ${JSON.stringify(error)}`
      )
      throw error
    } finally {
      this.checkLastCallPerformance(perf)
      if (this.enableDbSync) {
        if (!this.syncingDb && this.hasEnoughWaitSinceLastDbSync(1000 * this.config.DB_SYNC_INTERVAL_IN_S)) {
          this.logDbSyncRequested()
          if (Math.random() < this.dbSyncSampleProb) {
            this.logDbSyncSampled()
            this.syncingDb = true
            // Fire and forget. Won't check the sync result.
            this.syncAndUpdateProviderHealthiness()
          }
        }
      }
    }
  }

  private async syncAndUpdateProviderHealthiness() {
    try {
      const healthStateFromDb = await this.healthStateRepository.read(this.providerId)
      if (healthStateFromDb !== null) {
        if (healthStateFromDb.healthiness !== this.healthiness) {
          this.logHealthinessChanged(healthStateFromDb.healthiness)
          this.log.debug(
            `${this.providerId}: Health state changed! From ${this.healthiness} to ${healthStateFromDb.healthiness}`
          )
        }
        this.healthiness = healthStateFromDb.healthiness
        this.log.debug(`${this.providerId}: Synced with storage: new health state ${this.healthiness}`)
      }
      this.lastDbSyncTimestampInMs = Date.now()
      this.log.debug(`${this.providerId}: Successfully synced with DB and updated states`)
      this.logDbSyncSuccess()
    } catch (err: any) {
      this.log.error(`${this.providerId}: Encountered unhandled error when sync provider state: ${JSON.stringify(err)}`)
      this.logDbSyncFailure()
      // Won't throw. A fail of sync won't stop us from serving requests.
    } finally {
      this.syncingDb = false
    }
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
