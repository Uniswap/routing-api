import { StaticJsonRpcProvider } from '@ethersproject/providers'
import { CHAIN_IDS_TO_NAMES, LibSupportedChainsType } from './chains'

// const ERROR_PENALTY = 50
// const RETRY_PENALTY = 10
const HEALTH_SCORE_THRESHOLD =  70

export class SingleJsonRpcProvider extends StaticJsonRpcProvider {
  // TODO(jie): This class will implement block-aligned cache, as well as
  //   meta for provider selection and fallback
  private healthScore: number

  constructor(chainId: LibSupportedChainsType, url: string) {
    super(url, { chainId, name: CHAIN_IDS_TO_NAMES[chainId] })
  }

  // TODO(jie): 我应该先去实现recordProviderError()等API
  //   而不要先去把真的RPC call实现出来再说

  // TODO(jie): 搞清楚send()和perform()的区别是什么，搞清楚之后再写！

  public isHealthy(): boolean {
    return this.healthScore >= HEALTH_SCORE_THRESHOLD
  }

  // private recordProviderError() {
  //   this.healthScore -= ERROR_PENALTY
  // }
  //
  // private recordProviderRetry() {
  //   this.healthScore -= RETRY_PENALTY
  // }
}
