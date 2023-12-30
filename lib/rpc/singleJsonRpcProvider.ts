import { StaticJsonRpcProvider } from '@ethersproject/providers'
import { CHAIN_IDS_TO_NAMES, LibSupportedChainsType } from './chains'
import { Network } from '@ethersproject/networks'
import { ChainId } from '@uniswap/sdk-core'
import { Config, DEFAULT_CONFIG } from './config'

// TODO(jie): Tune them!
// const ERROR_PENALTY = -50
// const HIGH_LATENCY_PENALTY = -50
// const HEALTH_SCORE_THRESHOLD =  ERROR_PENALTY * 3
// const MAX_LATENCY_ALLOWED_IN_MS = 500
// const RECOVER_SCORE_PER_SECOND = 1
// const RECOVER_EVALUATION_THRESHOLD = -20
// const RECOVER_EVALUATION_WAIT_PERIOD_IN_MS = 5000 // in ms = -20

class PerfStat {
  lastCallTimestampInMs: number = 0
  lastCallSucceed: boolean = false
  lastCallLatencyInMs: number = 0
  timeWaitedBeforeLastCallInMs: number = 0
}

export class SingleJsonRpcProvider extends StaticJsonRpcProvider {
  // TODO(jie): This class will implement block-aligned cache, as well as
  //   meta for provider selection and fallback
  private healthScore
  url: string
  private perf: PerfStat
  private config: Config

  constructor(chainId: LibSupportedChainsType, url: string, config: Config = DEFAULT_CONFIG) {
    super(url, { chainId, name: CHAIN_IDS_TO_NAMES[chainId] })
    this.healthScore = 0
    this.url = url
    this.perf = new PerfStat()
    this.config = config
  }

  isHealthy(): boolean {
    return this.healthScore >= this.config.HEALTH_SCORE_THRESHOLD
  }

  hasEnoughRecovery(): boolean {
    return Date.now() - this.perf.lastCallTimestampInMs > this.config.RECOVER_EVALUATION_WAIT_PERIOD_IN_MS
      && this.healthScore >= this.config.RECOVER_EVALUATION_THRESHOLD
  }

  private recordError() {
    this.healthScore += this.config.ERROR_PENALTY
  }

  private recordHighLatency() {
    this.healthScore += this.config.HIGH_LATENCY_PENALTY
  }

  private recordProviderRecovery(timeInMs: number) {
    this.healthScore += timeInMs * this.config.RECOVER_SCORE_PER_SECOND
    if (this.healthScore > 0) {
      this.healthScore = 0
    }
  }

  private checkCallPerformance() {
    if (this.perf.timeWaitedBeforeLastCallInMs > 0) {
      this.recordProviderRecovery(this.perf.timeWaitedBeforeLastCallInMs)
    }
    if (!this.perf.lastCallSucceed) {
      this.recordError()
    } else if (this.perf.lastCallLatencyInMs > this.config.MAX_LATENCY_ALLOWED_IN_MS) {
      this.recordHighLatency()
    }
    // No reward for normal operation.
  }

  async detectNetwork(): Promise<Network> {
    // return await super.detectNetwork()
    return Promise.resolve({name: 'mainnet', chainId: ChainId.MAINNET})
  }

  // async getNetwork(): Promise<Network> {
  //   return await super.getNetwork()
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

      this.checkCallPerformance()
    }
  }

  async evaluateForRecovery() {
    try {
      await this.getBlockNumber()
    } catch (error: any) {
      console.log(`Failed at evaluation for recovery: ${JSON.stringify(error)}`)
    }
  }
}
