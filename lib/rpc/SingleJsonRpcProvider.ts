import { StaticJsonRpcProvider, TransactionRequest } from '@ethersproject/providers'
import { Config, DEFAULT_CONFIG } from './config'
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
import { ProviderStateSyncer, SyncResult } from './ProviderStateSyncer'

interface SingleCallPerf {
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
  private config: Config
  private readonly metricPrefix: string
  private readonly log: Logger

  private enableDbSync: boolean
  private providerStateSyncer: ProviderStateSyncer
  private healthScoreAtLastSync: number = 0

  constructor(network: Network, url: string, log: Logger, config: Config = DEFAULT_CONFIG) {
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
        log
      )
      this.maybeSyncAndUpdateProviderState()
    }
  }

  isHealthy() {
    return this.healthy
  }

  hasEnoughWaitSinceLastCall(): boolean {
    this.log.debug(`${this.url}: score ${this.healthScore}, waited ${Date.now() - this.lastCallTimestampInMs} ms`)
    return Date.now() - this.lastCallTimestampInMs > this.config.RECOVER_EVALUATION_WAIT_PERIOD_IN_MS
  }

  private recordError(method: string) {
    this.healthScore += this.config.ERROR_PENALTY
    this.log.error(
      `${this.url}: method: ${method} error penalty ${this.config.ERROR_PENALTY}, score => ${this.healthScore}`
    )
  }

  private recordHighLatency(method: string) {
    this.healthScore += this.config.HIGH_LATENCY_PENALTY
    this.log.error(
      `${this.url}: method: ${method}, high latency penalty ${this.config.ERROR_PENALTY}, score => ${this.healthScore}`
    )
  }

  private recordProviderRecovery(timeInMs: number) {
    if (this.healthScore === 0) {
      return
    }
    timeInMs = Math.min(timeInMs, this.config.RECOVER_MAX_WAIT_TIME_TO_ACKNOWLEDGE_IN_MS)
    this.healthScore += timeInMs * this.config.RECOVER_SCORE_PER_MS
    if (this.healthScore > 0) {
      this.healthScore = 0
    }
    this.log.debug(
      `${this.url}: healthy: ${this.healthy}, recovery ${timeInMs} * ${this.config.RECOVER_SCORE_PER_MS} = ${
        timeInMs * this.config.RECOVER_SCORE_PER_MS
      }, score => ${this.healthScore}`
    )
  }

  private checkLastCallPerformance(method: string, perf: SingleCallPerf) {
    this.log.debug(`checkLastCallPerformance: method: ${method}`)
    if (!perf.succeed) {
      metric.putMetric(`${this.metricPrefix}_${method}_FAILED`, 1, MetricLoggerUnit.Count)
      this.recordError(method)
    } else if (perf.latencyInMs > this.config.MAX_LATENCY_ALLOWED_IN_MS) {
      metric.putMetric(`${this.metricPrefix}_${method}_SUCCESS_HIGH_LATENCY`, 1, MetricLoggerUnit.Count)
      this.recordHighLatency(method)
    } else {
      metric.putMetric(`${this.metricPrefix}_${method}_SUCCESS`, 1, MetricLoggerUnit.Count)
      this.log.debug(`${this.url} method: ${method} succeeded`)
      // For a success call, we will increase health score.
      if (perf.startTimestampInMs - this.lastCallTimestampInMs > 0) {
        this.recordProviderRecovery(perf.startTimestampInMs - this.lastCallTimestampInMs)
      }
    }
    // No reward for normal operation.
  }

  async evaluateForRecovery() {
    this.log.debug(`${this.url}: Evaluate for recovery...`)
    try {
      await this.getBlockNumber()
    } catch (error: any) {
      this.log.error(`Encounter error for shadow evaluate call: ${JSON.stringify(error)}`)
      // Swallow the error.
    }
  }

  // Notice that AWS metrics have to be non-negative.
  logHealthMetrics() {
    metric.putMetric(`${this.metricPrefix}_health_score`, -this.healthScore, MetricLoggerUnit.None)
  }

  // Wrap another layer only for the sake of ease unit testing.
  // We will test this API to represent the tests of other similar implemented APIs.
  private _getBlockNumber(): Promise<number> {
    return super.getBlockNumber()
  }

  private async wrappedFunctionCall(
    fnName: string,
    fn: (...args: any[]) => Promise<any>,
    ...args: any[]
  ): Promise<any> {
    this.log.debug(`SingleJsonRpcProvider: wrappedFunctionCall: fnName: ${fnName}, fn: ${fn}, args: ${[...args]}`)
    const perf: SingleCallPerf = {
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
      this.checkLastCallPerformance(fnName, perf)
      this.updateHealthyStatus()
      this.lastCallTimestampInMs = perf.startTimestampInMs

      if (this.enableDbSync) {
        this.maybeSyncAndUpdateProviderState()
      }
    }
  }

  private async maybeSyncAndUpdateProviderState() {
    try {
      const syncResult: SyncResult = await this.providerStateSyncer.maybeSyncWithRepository(
        this.healthScore - this.healthScoreAtLastSync,
        this.healthScore
      )
      if (syncResult.synced) {
        this.healthScoreAtLastSync = syncResult.state.healthScore
        this.healthScore = this.healthScoreAtLastSync
        this.log.debug(`Synced with DB: new health score ${this.healthScore}`)
        this.updateHealthyStatus()
      }
    } catch (err: any) {
      this.log.error(`Encountered error when sync provider state: ${JSON.stringify(err)}`)
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

  ///////////////////// Begin of override functions /////////////////////

  override getBlockNumber(): Promise<number> {
    return this.wrappedFunctionCall('getBlockNumber', this._getBlockNumber.bind(this))
  }

  override getBlockWithTransactions(
    blockHashOrBlockTag: BlockTag | string | Promise<BlockTag | string>
  ): Promise<BlockWithTransactions> {
    return this.wrappedFunctionCall(
      'getBlockWithTransactions',
      super.getBlockWithTransactions.bind(this),
      blockHashOrBlockTag
    )
  }

  override getCode(addressOrName: string | Promise<string>, blockTag?: BlockTag | Promise<BlockTag>): Promise<string> {
    return this.wrappedFunctionCall('getCode', super.getCode.bind(this), addressOrName, blockTag)
  }

  override getGasPrice(): Promise<BigNumber> {
    return this.wrappedFunctionCall('getGasPrice', super.getGasPrice.bind(this))
  }

  override getLogs(filter: Filter): Promise<Array<Log>> {
    return this.wrappedFunctionCall('getLogs', super.getLogs.bind(this), filter)
  }

  override getStorageAt(
    addressOrName: string | Promise<string>,
    position: BigNumberish | Promise<BigNumberish>,
    blockTag?: BlockTag | Promise<BlockTag>
  ): Promise<string> {
    return this.wrappedFunctionCall('getStorageAt', super.getStorageAt.bind(this), addressOrName, position, blockTag)
  }

  override getTransaction(transactionHash: string | Promise<string>): Promise<TransactionResponse> {
    return this.wrappedFunctionCall('getTransaction', super.getTransaction.bind(this), transactionHash)
  }

  override getTransactionCount(
    addressOrName: string | Promise<string>,
    blockTag?: BlockTag | Promise<BlockTag>
  ): Promise<number> {
    return this.wrappedFunctionCall(
      'getTransactionCount',
      super.getTransactionCount.bind(this),
      addressOrName,
      blockTag
    )
  }

  override getTransactionReceipt(transactionHash: string | Promise<string>): Promise<TransactionReceipt> {
    return this.wrappedFunctionCall('getTransactionReceipt', super.getTransactionReceipt.bind(this), transactionHash)
  }

  override lookupAddress(address: string | Promise<string>): Promise<string | null> {
    return this.wrappedFunctionCall('lookupAddress', super.lookupAddress.bind(this), address)
  }

  override resolveName(name: string | Promise<string>): Promise<string | null> {
    return this.wrappedFunctionCall('resolveName', super.resolveName.bind(this), name)
  }

  override sendTransaction(signedTransaction: string | Promise<string>): Promise<TransactionResponse> {
    return this.wrappedFunctionCall('sendTransaction', super.sendTransaction.bind(this), signedTransaction)
  }

  override waitForTransaction(
    transactionHash: string,
    confirmations?: number,
    timeout?: number
  ): Promise<TransactionReceipt> {
    return this.wrappedFunctionCall(
      'waitForTransaction',
      super.waitForTransaction.bind(this),
      transactionHash,
      confirmations,
      timeout
    )
  }

  override call(transaction: Deferrable<TransactionRequest>, blockTag?: BlockTag | Promise<BlockTag>): Promise<string> {
    return this.wrappedFunctionCall('call', super.call.bind(this), transaction, blockTag)
  }
  override send(method: string, params: Array<any>): Promise<any> {
    return this.wrappedFunctionCall('send', super.send.bind(this), method, params)
  }
}
