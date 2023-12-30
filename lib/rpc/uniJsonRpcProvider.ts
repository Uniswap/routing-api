import { LibSupportedChainsType } from './chains'
import { SingleJsonRpcProvider } from './singleJsonRpcProvider'
import { StaticJsonRpcProvider } from '@ethersproject/providers'
import { Config, DEFAULT_CONFIG } from './config'

export default class UniJsonRpcProvider extends StaticJsonRpcProvider {
  private healthyProviders: SingleJsonRpcProvider[] = []
  private unhealthyProviders: SingleJsonRpcProvider[] = []

  // Used to remember the user-specified precedence or provider URLs. 0 means highest
  private urlPrecedence: Record<string, number> = {}

  private lastUsedProvider: SingleJsonRpcProvider | null = null

  constructor(chainId: LibSupportedChainsType, urls: string[], config: Config = DEFAULT_CONFIG) {
    // Dummy super constructor call is needed.
    super('dummy_url', { chainId, name: 'dummy_network'})

    let urlId = 0
    for (const url of urls) {
      this.healthyProviders.push(new SingleJsonRpcProvider(chainId, url, config))
      this.urlPrecedence[url] = urlId
      urlId++
    }
  }

   get currentHealthyUrls() {
    return this.healthyProviders.map((provider) => provider.url)
  }

  get currentUnhealthyUrls() {
    return this.unhealthyProviders.map((provider) => provider.url)
  }

  get lastUsedUrl() {
    return this.lastUsedProvider?.url
  }

  async perform(method: string, params: any): Promise<any> {
    if (this.healthyProviders.length == 0) {
      throw new Error('No healthy providers available')
    }

    const selectedProvider = this.healthyProviders[0]
    this.lastUsedProvider = selectedProvider
    console.log(`jiejie: Use selected provider: ${selectedProvider.url}`)
    try {
      return await selectedProvider.perform(method, params);
    } finally {
      this.checkProviderHealthStatus()
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

  private debugPrintProviderHealthScores() {
    console.log('=== Healthy Providers ===')
    for (const provider of this.healthyProviders) {
      console.log(`\turl: ${provider.url}, \tscore: ${provider['healthScore']}`)
    }
    console.log('=== Unhealthy Providers ===')
    for (const provider of this.unhealthyProviders) {
      console.log(`\turl: ${provider.url}, \tscore: ${provider['healthScore']}`)
    }
  }

}