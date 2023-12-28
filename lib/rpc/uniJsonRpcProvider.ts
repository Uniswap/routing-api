import { LibSupportedChainsType } from './chains'
import { SingleJsonRpcProvider } from './singleJsonRpcProvider'
import { JsonRpcProvider } from '@ethersproject/providers'

export default class UniJsonRpcProvider extends JsonRpcProvider {
  private healthyProviders: SingleJsonRpcProvider[] = []
  private unhealthyProviders: SingleJsonRpcProvider[] = []

  // Used to remember the user-specified precedence or provider URLs. 0 means highest
  private urlPrecedence: Record<string, number> = {}

  constructor(chainId: LibSupportedChainsType, urls: string[]) {
    // Dummy super constructor call is needed.
    super(urls[0], { chainId, name: 'dummy'})

    let urlId = 0
    for (const url of urls) {
      this.healthyProviders.push(new SingleJsonRpcProvider(chainId, url))
      this.urlPrecedence[url] = urlId
      urlId++
    }
  }

  async perform(method: string, params: any): Promise<any> {
    if (this.healthyProviders.length == 0) {
      // TODO(jie): How to throw error?
    } else {
      const selectedProvider = this.healthyProviders[0]
      console.log(`jiejie: Use selected provider: ${selectedProvider.url}`)
      const result = await selectedProvider.perform(method, params);
      this.checkProviderHealthStatus()
      return result
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
        // TODO(jie): 不光是has enough health score，这里还得上一次call距离现在时间得超过一定间隔才行
        //   否则不就不停地evaluate for recovery了吗？
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