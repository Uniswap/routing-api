import { SingleJsonRpcProvider } from './singleJsonRpcProvider'
import { StaticJsonRpcProvider } from '@ethersproject/providers'
import { Config, DEFAULT_CONFIG } from './config'
import Debug from 'debug'
import { isEmpty } from 'lodash'
import { ChainId } from '@uniswap/sdk-core'

const debug = Debug('UniJsonRpcProvider')

// TODO(jie): 开始和routing API的code进行一定集成

export default class UniJsonRpcProvider extends StaticJsonRpcProvider {
  private healthyProviders: SingleJsonRpcProvider[] = []
  private unhealthyProviders: SingleJsonRpcProvider[] = []

  // Used to remember the user-specified precedence or provider URLs. 0 means highest
  private urlPrecedence: Record<string, number> = {}

  // If provided, we will use this weight to decide the probability of choosing
  // one of the healthy providers.
  private urlWeight: Record<string, number> = {}
  private urlWeightSum: number = 0

  private lastUsedProvider: SingleJsonRpcProvider | null = null

  private allowProviderSwitch: boolean = true

  constructor(chainId: ChainId, urls: string[], weights?: number[], config: Config = DEFAULT_CONFIG) {
    // Dummy super constructor call is needed.
    super('dummy_url', { chainId, name: 'dummy_network'})

    if (weights && weights.length != urls.length) {
      throw new Error('urls and weights need to have the same length')
    }

    let weightSum = 0
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i]
      this.healthyProviders.push(new SingleJsonRpcProvider(chainId, url, config))
      this.urlPrecedence[url] = i
      if (weights) {
        if (weights[i] <= 0) {
          throw new Error(`Invalid weight: ${weights[i]}. Weight needs to be a positive number`)
        }
        this.urlWeight[url] = weights[i]
        weightSum += weights[i]
      }
    }
    this.urlWeightSum = weightSum
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

  enableProviderAutoSwitch() {
    this.allowProviderSwitch = true
  }

  disableProviderAutoSwitch() {
    this.allowProviderSwitch = false
  }

  private selectPreferredProvider(): SingleJsonRpcProvider {
    if (!this.allowProviderSwitch && this.lastUsedProvider !== null) {
      if (this.lastUsedProvider.isHealthy()) {
        return this.lastUsedProvider
      } else {
        throw new Error('Forced to use last used provider which is unhealthy')
      }
    }

    if (isEmpty(this.urlWeight)) {
      return this.healthyProviders[0]
    }
    const rand = Math.random() * this.urlWeightSum
    // No need to use binary search since the size of healthy providers is very small.
    let accumulatedWeight: number = 0
    for (const provider of  this.healthyProviders) {
      accumulatedWeight += this.urlWeight[provider.url]
      if (accumulatedWeight >= rand) {
        return provider
      }
    }
    throw new Error("Encounter error when selecting preferred provider")
  }

  async perform(method: string, params: any): Promise<any> {
    if (this.healthyProviders.length == 0) {
      throw new Error('No healthy providers available')
    }

    const selectedProvider = this.selectPreferredProvider()
    this.lastUsedProvider = selectedProvider
    debug(`Use selected provider: ${selectedProvider.url}`)
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

  private updateHealthyProviderUrlWeightSum() {
    // Update url weight sum for healthy providers.
    if (!isEmpty(this.urlWeight)) {
      this.urlWeightSum = 0
      for (const provider of this.healthyProviders) {
        this.urlWeightSum += this.urlWeight[provider.url]
      }
    }
  }

  private checkProviderHealthStatus() {
    debug('after a call, checkProviderHealthStatus')
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
        unhealthy.push(provider)
        if (provider.hasEnoughWaitSinceLastCall()) {
          provider.evaluateForRecovery()  // not blocking
        }
      }
    }

    this.healthyProviders = healthy
    this.unhealthyProviders = unhealthy
    this.reorderHealthyProviders()
    debug(`reordered healthy providers, top provider ${this.healthyProviders[0].url}`)

    this.updateHealthyProviderUrlWeightSum()
  }

  private debugPrintProviderHealthScores() {
    debug('=== Healthy Providers ===')
    for (const provider of this.healthyProviders) {
      debug(`\turl: ${provider.url}, \tscore: ${provider['healthScore']}`)
    }
    debug('=== Unhealthy Providers ===')
    for (const provider of this.unhealthyProviders) {
      debug(`\turl: ${provider.url}, \tscore: ${provider['healthScore']}`)
    }
  }
}
