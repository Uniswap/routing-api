import { StaticJsonRpcProvider, TransactionRequest } from '@ethersproject/providers'
import { Config, DEFAULT_CONFIG } from './config'
import Debug from 'debug'
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
const debug = Debug('SingleJsonRpcProvider')

class PerfStat {
  lastCallTimestampInMs: number = 0
  lastCallSucceed: boolean = false
  lastCallLatencyInMs: number = 0
  timeWaitedBeforeLastCallInMs: number = 0
}

export default class SingleJsonRpcProvider extends StaticJsonRpcProvider {
  // TODO(jie): Implement block-aligned cache
  url: string
  private healthScore
  private isRecovering: boolean
  private perf: PerfStat
  private config: Config
  private readonly metricPrefix: string

  constructor(chainId: ChainId, url: string, config: Config = DEFAULT_CONFIG) {
    super(url, { chainId, name: ID_TO_NETWORK_NAME(chainId)})
    this.url = url
    this.healthScore = 0
    this.isRecovering = false
    this.perf = new PerfStat()
    this.config = config
    this.metricPrefix = `RPC_${this.network.chainId}_${this.url}`
  }

  isHealthy(): boolean {
    return !this.isRecovering
  }

  hasEnoughWaitSinceLastCall(): boolean {
    debug(`${this.url}: score ${this.healthScore}, waited ${Date.now() - this.perf.lastCallTimestampInMs} ms`)
    return Date.now() - this.perf.lastCallTimestampInMs > this.config.RECOVER_EVALUATION_WAIT_PERIOD_IN_MS
  }

  private recordError(method: string) {
    this.healthScore += this.config.ERROR_PENALTY
    debug(`${this.url}: method: ${method} error penalty ${this.config.ERROR_PENALTY}, score => ${this.healthScore}`)
  }

  private recordHighLatency(method: string) {
    this.healthScore += this.config.HIGH_LATENCY_PENALTY
    debug(`${this.url}: method: ${method}, high latency penalty ${this.config.ERROR_PENALTY}, score => ${this.healthScore}`)
  }

  private recordProviderRecovery(timeInMs: number) {
    if (this.healthScore === 0) {
      return
    }
    this.healthScore += timeInMs * this.config.RECOVER_SCORE_PER_MS
    if (this.healthScore > 0) {
      this.healthScore = 0
    }
    debug(
      `${this.url}: healthy: ${this.isHealthy()}, recovery ${timeInMs} * ${this.config.RECOVER_SCORE_PER_MS} = ${
        timeInMs * this.config.RECOVER_SCORE_PER_MS
      }, score => ${this.healthScore}`
    )
  }

  private checkLastCallPerformance(method: string) {
    debug(`checkLastCallPerformance: method: ${method}`)
    if (!this.perf.lastCallSucceed) {
      metric.putMetric(`${this.metricPrefix}_${method}_FAILED`, 1, MetricLoggerUnit.Count)
      this.recordError(method)
    } else if (this.perf.lastCallLatencyInMs > this.config.MAX_LATENCY_ALLOWED_IN_MS) {
      metric.putMetric(`${this.metricPrefix}_${method}_SUCCESS_HIGH_LATENCY`, 1, MetricLoggerUnit.Count)
      this.recordHighLatency(method)
    } else {
      metric.putMetric(`${this.metricPrefix}_${method}_SUCCESS`, 1, MetricLoggerUnit.Count)
      debug(`${this.url} method: ${method} succeeded`)
      // For a success call, we will increase health score.
      if (this.perf.timeWaitedBeforeLastCallInMs > 0) {
        this.recordProviderRecovery(this.perf.timeWaitedBeforeLastCallInMs)
      }
    }
    if (!this.isRecovering && this.healthScore < this.config.HEALTH_SCORE_FALLBACK_THRESHOLD) {
      this.isRecovering = true
      debug(`${this.url} drops to unhealthy`)
    } else if (this.isRecovering && this.healthScore > this.config.HEALTH_SCORE_RECOVER_THRESHOLD) {
      this.isRecovering = false
      debug(`${this.url} resumes to healthy`)
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
    debug(`${this.url}: Evaluate for recovery...`)
    this.getBlockNumber() // Ignore output in the promise
  }

  // Wrap another layer only for the sake of ease unit testing.
  // We will test this API to represent the tests of other similar implemented APIs.
  private _getBlockNumber(): Promise<number> {
    return super.getBlockNumber()
  }

  ///////////////////// Begin of override functions /////////////////////

  override getBlockNumber(): Promise<number> {
    const startTime = Date.now()
    this.recordPerfBeforeCall(startTime)
    let callSucceed = true
    return this._getBlockNumber()
      .then((response) => {
        return response
      })
      .catch((error) => {
        callSucceed = false
        throw error
      })
      .finally(() => {
        const endTime = Date.now()
        this.recordPerfAfterCall(startTime, endTime, callSucceed)
        this.checkLastCallPerformance('getBlockNumber')
      })
  }

  override getBlockWithTransactions(
    blockHashOrBlockTag: BlockTag | string | Promise<BlockTag | string>
  ): Promise<BlockWithTransactions> {
    const startTime = Date.now()
    this.recordPerfBeforeCall(startTime)
    let callSucceed = true
    return super
      .getBlockWithTransactions(blockHashOrBlockTag)
      .then((response) => {
        return response
      })
      .catch((error) => {
        callSucceed = false
        throw error
      })
      .finally(() => {
        const endTime = Date.now()
        this.recordPerfAfterCall(startTime, endTime, callSucceed)
        this.checkLastCallPerformance('getBlockWithTransactions')
      })
  }

  override getCode(addressOrName: string | Promise<string>, blockTag?: BlockTag | Promise<BlockTag>): Promise<string> {
    const startTime = Date.now()
    this.recordPerfBeforeCall(startTime)
    let callSucceed = true
    return super
      .getCode(addressOrName, blockTag)
      .then((response) => {
        return response
      })
      .catch((error) => {
        callSucceed = false
        throw error
      })
      .finally(() => {
        const endTime = Date.now()
        this.recordPerfAfterCall(startTime, endTime, callSucceed)
        this.checkLastCallPerformance('getCode')
      })
  }

  override getGasPrice(): Promise<BigNumber> {
    const startTime = Date.now()
    this.recordPerfBeforeCall(startTime)
    let callSucceed = true
    return super
      .getGasPrice()
      .then((response) => {
        return response
      })
      .catch((error) => {
        callSucceed = false
        throw error
      })
      .finally(() => {
        const endTime = Date.now()
        this.recordPerfAfterCall(startTime, endTime, callSucceed)
        this.checkLastCallPerformance('getGasPrice')
      })
  }

  override getLogs(filter: Filter): Promise<Array<Log>> {
    const startTime = Date.now()
    this.recordPerfBeforeCall(startTime)
    let callSucceed = true
    return super
      .getLogs(filter)
      .then((response) => {
        return response
      })
      .catch((error) => {
        callSucceed = false
        throw error
      })
      .finally(() => {
        const endTime = Date.now()
        this.recordPerfAfterCall(startTime, endTime, callSucceed)
        this.checkLastCallPerformance('getLogs')
      })
  }

  // Probably no need to capture?
  // override getNetwork(): Promise<Network> {
  //   const startTime = Date.now()
  //   this.recordPerfBeforeCall(startTime)
  //   let callSucceed = true
  //   return super
  //     .getNetwork()
  //     .then((response) => {
  //       return response
  //     })
  //     .catch((error) => {
  //       callSucceed = false
  //       throw error
  //     })
  //     .finally(() => {
  //       const endTime = Date.now()
  //       this.recordPerfAfterCall(startTime, endTime, callSucceed)
  //       this.checkLastCallPerformance('getNetwork')
  //     })
  // }

  override getStorageAt(
    addressOrName: string | Promise<string>,
    position: BigNumberish | Promise<BigNumberish>,
    blockTag?: BlockTag | Promise<BlockTag>
  ): Promise<string> {
    const startTime = Date.now()
    this.recordPerfBeforeCall(startTime)
    let callSucceed = true
    return super
      .getStorageAt(addressOrName, position, blockTag)
      .then((response) => {
        return response
      })
      .catch((error) => {
        callSucceed = false
        throw error
      })
      .finally(() => {
        const endTime = Date.now()
        this.recordPerfAfterCall(startTime, endTime, callSucceed)
        this.checkLastCallPerformance('getStorageAt')
      })
  }

  override getTransaction(transactionHash: string | Promise<string>): Promise<TransactionResponse> {
    const startTime = Date.now()
    this.recordPerfBeforeCall(startTime)
    let callSucceed = true
    return super
      .getTransaction(transactionHash)
      .then((response) => {
        return response
      })
      .catch((error) => {
        callSucceed = false
        throw error
      })
      .finally(() => {
        const endTime = Date.now()
        this.recordPerfAfterCall(startTime, endTime, callSucceed)
        this.checkLastCallPerformance('getTransaction')
      })
  }

  override getTransactionCount(
    addressOrName: string | Promise<string>,
    blockTag?: BlockTag | Promise<BlockTag>
  ): Promise<number> {
    const startTime = Date.now()
    this.recordPerfBeforeCall(startTime)
    let callSucceed = true
    return super
      .getTransactionCount(addressOrName, blockTag)
      .then((response) => {
        return response
      })
      .catch((error) => {
        callSucceed = false
        throw error
      })
      .finally(() => {
        const endTime = Date.now()
        this.recordPerfAfterCall(startTime, endTime, callSucceed)
        this.checkLastCallPerformance('getTransactionCount')
      })
  }

  override getTransactionReceipt(transactionHash: string | Promise<string>): Promise<TransactionReceipt> {
    const startTime = Date.now()
    this.recordPerfBeforeCall(startTime)
    let callSucceed = true
    return super
      .getTransactionReceipt(transactionHash)
      .then((response) => {
        return response
      })
      .catch((error) => {
        callSucceed = false
        throw error
      })
      .finally(() => {
        const endTime = Date.now()
        this.recordPerfAfterCall(startTime, endTime, callSucceed)
        this.checkLastCallPerformance('getTransactionReceipt')
      })
  }

  override lookupAddress(address: string | Promise<string>): Promise<string | null> {
    const startTime = Date.now()
    this.recordPerfBeforeCall(startTime)
    let callSucceed = true
    return super
      .lookupAddress(address)
      .then((response) => {
        return response
      })
      .catch((error) => {
        callSucceed = false
        throw error
      })
      .finally(() => {
        const endTime = Date.now()
        this.recordPerfAfterCall(startTime, endTime, callSucceed)
        this.checkLastCallPerformance('lookupAddress')
      })
  }

  override resolveName(name: string | Promise<string>): Promise<string | null> {
    const startTime = Date.now()
    this.recordPerfBeforeCall(startTime)
    let callSucceed = true
    return super
      .resolveName(name)
      .then((response) => {
        return response
      })
      .catch((error) => {
        callSucceed = false
        throw error
      })
      .finally(() => {
        const endTime = Date.now()
        this.recordPerfAfterCall(startTime, endTime, callSucceed)
        this.checkLastCallPerformance('resolveName')
      })
  }

  override sendTransaction(signedTransaction: string | Promise<string>): Promise<TransactionResponse> {
    const startTime = Date.now()
    this.recordPerfBeforeCall(startTime)
    let callSucceed = true
    return super
      .sendTransaction(signedTransaction)
      .then((response) => {
        return response
      })
      .catch((error) => {
        callSucceed = false
        throw error
      })
      .finally(() => {
        const endTime = Date.now()
        this.recordPerfAfterCall(startTime, endTime, callSucceed)
        this.checkLastCallPerformance('sendTransaction')
      })
  }

  override waitForTransaction(
    transactionHash: string,
    confirmations?: number,
    timeout?: number
  ): Promise<TransactionReceipt> {
    const startTime = Date.now()
    this.recordPerfBeforeCall(startTime)
    let callSucceed = true
    return super
      .waitForTransaction(transactionHash, confirmations, timeout)
      .then((response) => {
        return response
      })
      .catch((error) => {
        callSucceed = false
        throw error
      })
      .finally(() => {
        const endTime = Date.now()
        this.recordPerfAfterCall(startTime, endTime, callSucceed)
        this.checkLastCallPerformance('waitForTransaction')
      })
  }

  override call(transaction: Deferrable<TransactionRequest>, blockTag?: BlockTag | Promise<BlockTag>): Promise<string> {
    const startTime = Date.now()
    this.recordPerfBeforeCall(startTime)
    let callSucceed = true
    return super
      .call(transaction, blockTag)
      .then((response) => {
        return response
      })
      .catch((error) => {
        callSucceed = false
        throw error
      })
      .finally(() => {
        const endTime = Date.now()
        this.recordPerfAfterCall(startTime, endTime, callSucceed)
        this.checkLastCallPerformance('waitForTransaction')
      })
  }

  override send(method: string, params: Array<any>): Promise<any> {
    const startTime = Date.now()
    this.recordPerfBeforeCall(startTime)
    let callSucceed = true
    return super
      .send(method, params)
      .then((response) => {
        return response
      })
      .catch((error) => {
        callSucceed = false
        throw error
      })
      .finally(() => {
        const endTime = Date.now()
        this.recordPerfAfterCall(startTime, endTime, callSucceed)
        this.checkLastCallPerformance('send')
      })
  }
}
