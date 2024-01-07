import { StaticJsonRpcProvider } from '@ethersproject/providers'
import { CHAIN_IDS_TO_NAMES } from './chains'
import { Config, DEFAULT_CONFIG } from './config'
import Debug from 'debug'
import { metric, MetricLoggerUnit } from '@uniswap/smart-order-router'
import { ChainId } from '@uniswap/sdk-core'

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
    super(url, { chainId, name: CHAIN_IDS_TO_NAMES[chainId] })
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

  private recordError() {
    this.healthScore += this.config.ERROR_PENALTY
    debug(`${this.url}: error penalty ${this.config.ERROR_PENALTY}, score => ${this.healthScore}`)
  }

  private recordHighLatency() {
    this.healthScore += this.config.HIGH_LATENCY_PENALTY
    debug(`${this.url}: high latency penalty ${this.config.ERROR_PENALTY}, score => ${this.healthScore}`)
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
    if (!this.perf.lastCallSucceed) {
      metric.putMetric(`${this.metricPrefix}_${method}_FAILED`, 1, MetricLoggerUnit.Count)
      this.recordError()
    } else if (this.perf.lastCallLatencyInMs > this.config.MAX_LATENCY_ALLOWED_IN_MS) {
      metric.putMetric(`${this.metricPrefix}_${method}_SUCCESS_HIGH_LATENCY`, 1, MetricLoggerUnit.Count)
      this.recordHighLatency()
    } else {
      metric.putMetric(`${this.metricPrefix}_${method}_SUCCESS`, 1, MetricLoggerUnit.Count)
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

  private _getBlockNumber(): Promise<number> {
    return super.getBlockNumber()
  }

  // override async getBlockNumber(): Promise<number> {
  getBlockNumber(purpose: string = 'serve'): Promise<number> {
    const startTime = Date.now()
    console.log(`${purpose}: record start time: ${startTime}`)
    this.recordPerfBeforeCall(startTime)
    let callSucceed = true
    // return super.getBlockNumber()
    return this._getBlockNumber()
      .then(
        (response) => {
          console.log('in then')
          return response
        },
      )
      .catch(
        error => {
          console.log('in catch')
          callSucceed = false
          throw error
        }
      )
      .finally(() => {
        console.log('in finally')
        const endTime = Date.now()
        console.log(`record end time: ${endTime} (start time we have ${startTime})`)
        this.recordPerfAfterCall(startTime, endTime, callSucceed)
        this.checkLastCallPerformance('getBlockNumber')
      })
  }

  evaluateForRecovery() {
    debug(`${this.url}: Evaluate for recovery...`)
    // try {
    //   debug('Evaluate call started')
    //   await this.getBlockNumber('evaluate')
    //   debug('Evaluate call ended')
    // } catch (error: any) {
    //   debug(`Failed at evaluation for recovery: ${JSON.stringify(error)}`)
    // } finally {
    //   debug(`${this.url}: ...evaluate done, score => ${this.healthScore}`)
    // }
    this.getBlockNumber('evaluate')
  }
}
