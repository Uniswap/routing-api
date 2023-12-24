import { LibSupportedChainsType } from './chains'
import { SingleJsonRpcProvider } from './singleJsonRpcProvider'


export default class UniJsonRpcProvider {
  // TODO(jie): Add session manager
  private healthyProviders: SingleJsonRpcProvider[] = []
  private unhealthyProviders: SingleJsonRpcProvider[] = []

  constructor(chainId: LibSupportedChainsType, urls: string[]) {
    for (const url of urls) {
      this.healthyProviders.push(new SingleJsonRpcProvider(chainId, url))
    }
  }

  private checkHealthStatus() {
    const unhealthyProviders: SingleJsonRpcProvider[] = []
    for (const provider of this.healthyProviders) {
      if (!provider.isHealthy()) {
        unhealthyProviders.push(provider)
      }
    }
    this.unhealthyProviders = unhealthyProviders
    console.log(this.unhealthyProviders)
  }

  // private
}