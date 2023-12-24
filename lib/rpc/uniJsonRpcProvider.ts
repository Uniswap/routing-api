import { LibSupportedChainsType } from './chains'
import { SingleJsonRpcProvider } from './singleJsonRpcProvider'

export default class UniJsonRpcProvider {
  private healthyProviders: SingleJsonRpcProvider[] = []
  private unhealthyProviders: SingleJsonRpcProvider[] = []

  // Used to remember the user-specified precedence or provider URLs. 0 means highest
  private urlPrecedence: Record<string, number> = {}

  constructor(chainId: LibSupportedChainsType, urls: string[]) {
    let urlId = 0
    for (const url of urls) {
      this.healthyProviders.push(new SingleJsonRpcProvider(chainId, url))
      this.urlPrecedence[url] = urlId
      urlId++
    }
  }

  private reorderHealthyProviders() {
    this.healthyProviders.sort((a, b) => {
      return this.urlPrecedence[a.url] - this.urlPrecedence[b.url]
    })
  }

  private checkProviderHealthStatus() {
    const healthy: SingleJsonRpcProvider[] = []
    const unhealthy: SingleJsonRpcProvider[] = []

    // Check health providers.
    for (const provider of this.healthyProviders) {
      if (provider.isHealthy()) {
        healthy.push(provider)
      } else {
        unhealthy.push(provider)
      }
    }

    for (const provider of this.unhealthyProviders) {
      if (provider.isHealthy()) {
        healthy.push(provider)
      } else {
        if (provider.hasEnoughRecovery()) {
          provider.evaluateForRecovery()
        }
        unhealthy.push(provider)
      }
    }

    this.healthyProviders = healthy
    this.unhealthyProviders = unhealthy
    this.reorderHealthyProviders()
  }

}