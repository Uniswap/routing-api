import { StaticJsonRpcProvider, TransactionRequest } from '@ethersproject/providers'
import { Config, DEFAULT_CONFIG } from './config'
import { ID_TO_NETWORK_NAME, metric, MetricLoggerUnit } from '@uniswap/smart-order-router'
import { ChainId } from '@uniswap/sdk-core'
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

class PerfStat {
  lastCallTimestampInMs: number = 0
  lastCallSucceed: boolean = false
  lastCallLatencyInMs: number = 0
  timeWaitedBeforeLastCallInMs: number = 0
}

export class SingleJsonRpcProvider extends StaticJsonRpcProvider {
  // TODO(jie): Implement block-aligned cache
  readonly url: string
  readonly providerName: string

  private healthScore
  private healthy: boolean
  private perf: PerfStat
  private config: Config
  private readonly metricPrefix: string
  private readonly log: Logger

  constructor(chainId: ChainId, url: string, log: Logger, config: Config = DEFAULT_CONFIG) {
    super(url, { chainId, name: ID_TO_NETWORK_NAME(chainId) })
    this.url = url
    this.log = log
    this.log.debug('shit')
    this.providerName = deriveProviderName(url)
    this.healthScore = 0
    this.healthy = true
    this.perf = new PerfStat()
    this.config = config
    this.metricPrefix = `RPC_${this.providerName}_${this.network.chainId}`
  }

  isHealthy() {
    return this.healthy
  }

  hasEnoughWaitSinceLastCall(): boolean {
    console.log(`${this.url}: score ${this.healthScore}, waited ${Date.now() - this.perf.lastCallTimestampInMs} ms`)
    return Date.now() - this.perf.lastCallTimestampInMs > this.config.RECOVER_EVALUATION_WAIT_PERIOD_IN_MS
  }

  private recordError(method: string) {
    this.healthScore += this.config.ERROR_PENALTY
    console.log(
      `${this.url}: method: ${method} error penalty ${this.config.ERROR_PENALTY}, score => ${this.healthScore}`
    )
  }

  private recordHighLatency(method: string) {
    this.healthScore += this.config.HIGH_LATENCY_PENALTY
    console.log(
      `${this.url}: method: ${method}, high latency penalty ${this.config.ERROR_PENALTY}, score => ${this.healthScore}`
    )
  }

  private recordProviderRecovery(timeInMs: number) {
    if (this.healthScore === 0) {
      return
    }
    this.healthScore += timeInMs * this.config.RECOVER_SCORE_PER_MS
    if (this.healthScore > 0) {
      this.healthScore = 0
    }
    console.log(
      `${this.url}: healthy: ${this.healthy}, recovery ${timeInMs} * ${this.config.RECOVER_SCORE_PER_MS} = ${
        timeInMs * this.config.RECOVER_SCORE_PER_MS
      }, score => ${this.healthScore}`
    )
  }

  private checkLastCallPerformance(method: string) {
    console.log(`checkLastCallPerformance: method: ${method}`)
    if (!this.perf.lastCallSucceed) {
      metric.putMetric(`${this.metricPrefix}_${method}_FAILED`, 1, MetricLoggerUnit.Count)
      this.recordError(method)
    } else if (this.perf.lastCallLatencyInMs > this.config.MAX_LATENCY_ALLOWED_IN_MS) {
      metric.putMetric(`${this.metricPrefix}_${method}_SUCCESS_HIGH_LATENCY`, 1, MetricLoggerUnit.Count)
      this.recordHighLatency(method)
    } else {
      metric.putMetric(`${this.metricPrefix}_${method}_SUCCESS`, 1, MetricLoggerUnit.Count)
      console.log(`${this.url} method: ${method} succeeded`)
      // For a success call, we will increase health score.
      if (this.perf.timeWaitedBeforeLastCallInMs > 0) {
        this.recordProviderRecovery(this.perf.timeWaitedBeforeLastCallInMs)
      }
    }
    if (this.healthy && this.healthScore < this.config.HEALTH_SCORE_FALLBACK_THRESHOLD) {
      this.healthy = false
      console.log(`${this.url} drops to unhealthy`)
    } else if (!this.healthy && this.healthScore > this.config.HEALTH_SCORE_RECOVER_THRESHOLD) {
      this.healthy = true
      console.log(`${this.url} resumes to healthy`)
    }
    // No reward for normal operation.
  }

  private recordPerfBeforeCall(startTimeInMs: number) {
    if (this.perf.lastCallTimestampInMs > 0) {
      this.perf.timeWaitedBeforeLastCallInMs = startTimeInMs - this.perf.lastCallTimestampInMs
    }
  }

  private recordPerfAfterCall(startTimeInMs: number, endTimeInMs: number, callSucceed: boolean) {
    this.perf.lastCallTimestampInMs = endTimeInMs
    this.perf.lastCallLatencyInMs = endTimeInMs - startTimeInMs
    this.perf.lastCallSucceed = callSucceed
  }

  evaluateForRecovery() {
    console.log(`${this.url}: Evaluate for recovery...`)
    this.getBlockNumber() // Ignore output in the promise
  }

  // Wrap another layer only for the sake of ease unit testing.
  // We will test this API to represent the tests of other similar implemented APIs.
  private _getBlockNumber(): Promise<number> {
    return super.getBlockNumber()
  }

  private wrappedFunctionCall(fnName: string, fn: any, ...args: any[]): Promise<any> {
    console.log(`SingleJsonRpcProvider: wrappedFunctionCall: fnName: ${fnName}, fn: ${fn}, args: ${[...args]}`)
    const startTime = Date.now()
    this.recordPerfBeforeCall(startTime)
    let callSucceed = true
    return fn(...args)
      .then((response: any) => {
        return response
      })
      .catch((error: any) => {
        callSucceed = false
        console.log(JSON.stringify(error))
        throw error
      })
      .finally(() => {
        const endTime = Date.now()
        this.recordPerfAfterCall(startTime, endTime, callSucceed)
        this.checkLastCallPerformance(fnName)
      })
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
