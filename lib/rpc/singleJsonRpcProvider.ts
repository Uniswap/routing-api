import { StaticJsonRpcProvider } from '@ethersproject/providers'
import { CHAIN_IDS_TO_NAMES, LibSupportedChainsType } from './chains'
import { Config, DEFAULT_CONFIG } from './config'
import Debug from 'debug'

const debug = Debug("SingleJsonRpcProvider")

class PerfStat {
  lastCallTimestampInMs: number = 0
  lastCallSucceed: boolean = false
  lastCallLatencyInMs: number = 0
  timeWaitedBeforeLastCallInMs: number = 0
}

export class SingleJsonRpcProvider extends StaticJsonRpcProvider {
  // TODO(jie): This class will implement block-aligned cache, as well as
  //   meta for provider selection and fallback
  url: string
  private healthScore
  private isRecovering: boolean
  private perf: PerfStat
  private config: Config

  constructor(chainId: LibSupportedChainsType, url: string, config: Config = DEFAULT_CONFIG) {
    super(url, { chainId, name: CHAIN_IDS_TO_NAMES[chainId] })
    this.url = url
    this.healthScore = 0
    this.isRecovering = false
    this.perf = new PerfStat()
    this.config = config
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
  }

  private recordProviderRecovery(timeInMs: number) {
    this.healthScore += timeInMs * this.config.RECOVER_SCORE_PER_MS
    if (this.healthScore > 0) {
      this.healthScore = 0
    }
    debug(`${this.url}: recovery ${timeInMs} * ${this.config.RECOVER_SCORE_PER_MS} = ${timeInMs * this.config.RECOVER_SCORE_PER_MS}, score => ${this.healthScore}`)
  }

  private checkLastCallPerformance() {
    if (!this.perf.lastCallSucceed) {
      this.recordError()
    } else if (this.perf.lastCallLatencyInMs > this.config.MAX_LATENCY_ALLOWED_IN_MS) {
      this.recordHighLatency()
    } else {
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

  // async detectNetwork(): Promise<Network> {
  //   // return await super.detectNetwork()
  //   return Promise.resolve({name: 'mainnet', chainId: ChainId.MAINNET})
  // }

  private async _perform(method: string, params: { [name: string]: any }): Promise<any> {
    return await super.perform(method, params)
  }

  async perform(method: string, params: { [name: string]: any }): Promise<any> {
    const startTime = Date.now()
    if (this.perf.lastCallTimestampInMs > 0) {
      this.perf.timeWaitedBeforeLastCallInMs = startTime - this.perf.lastCallTimestampInMs
    }
    let callSucceed = true
    try {
      return await this._perform(method, params)
    } catch (error: any) {
      callSucceed = false
      throw error
    } finally {
      const endTime = Date.now()
      this.perf.lastCallTimestampInMs = endTime
      this.perf.lastCallLatencyInMs = endTime - startTime
      this.perf.lastCallSucceed = callSucceed

      this.checkLastCallPerformance()
    }
  }

  async evaluateForRecovery() {
    debug(`${this.url}: evaluate for recovery...`)
    try {
      console.log('evaluate call started')
      await this.getBlockNumber()
      console.log('evaluate call ended')
    } catch (error: any) {
      console.log(`Failed at evaluation for recovery: ${JSON.stringify(error)}`)
    } finally {
      debug(`${this.url}: ...evaluate done, score => ${this.healthScore}`)
    }
  }
}