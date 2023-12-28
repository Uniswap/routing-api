import { StaticJsonRpcProvider } from '@ethersproject/providers'
import { CHAIN_IDS_TO_NAMES, LibSupportedChainsType } from './chains'

// TODO(jie): Tune them!
const ERROR_PENALTY = 50
const HIGH_LATENCY_PENALTY = 50
const HEALTH_SCORE_THRESHOLD =  70
const MAX_LATENCY_ALLOWED = 500  // in ms
const RECOVER_SCORE_PER_SECOND = 1
const RECOVER_EVALUATION_THRESHOLD = -20

class PerfStat {
  lastCallTimestampInMs: number = 0
  lastCallSucceed: boolean = false
  lastCallLatencyInMs: number = 0
  timeWaitedBeforeLastCallInMs: number = 0
}

export class SingleJsonRpcProvider extends StaticJsonRpcProvider {
  // TODO(jie): This class will implement block-aligned cache, as well as
  //   meta for provider selection and fallback
  private healthScore: number
  url: string
  private perf: PerfStat = new PerfStat()

  constructor(chainId: LibSupportedChainsType, url: string) {
    super(url, { chainId, name: CHAIN_IDS_TO_NAMES[chainId] })
    this.url = url
  }

  isHealthy(): boolean {
    return this.healthScore >= HEALTH_SCORE_THRESHOLD
  }

  hasEnoughRecovery(): boolean {
    return this.healthScore >= RECOVER_EVALUATION_THRESHOLD
  }

  private recordError() {
    this.healthScore -= ERROR_PENALTY
  }

  private recordHighLatency() {
    this.healthScore -= HIGH_LATENCY_PENALTY
  }

  private recordProviderRecovery(timeInMs: number) {
    this.healthScore += timeInMs * RECOVER_SCORE_PER_SECOND
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
    } else if (this.perf.lastCallLatencyInMs > MAX_LATENCY_ALLOWED) {
      this.recordHighLatency()
    }
    // No reward for normal operation.
  }

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
      // TODO(jie): Log here?
      //   反正这个error肯定是不需要处理的
    }
  }
}
