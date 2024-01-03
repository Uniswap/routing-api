import { SingleJsonRpcProvider } from './singleJsonRpcProvider'
import { StaticJsonRpcProvider } from '@ethersproject/providers'
import Debug from 'debug'
import { isEmpty } from 'lodash'
import { ChainId } from '@uniswap/sdk-core'

const debug = Debug('UniJsonRpcProvider')

export default class UniJsonRpcProvider extends StaticJsonRpcProvider {
  private readonly chainId: ChainId = ChainId.MAINNET

  private readonly providers: SingleJsonRpcProvider[] = []

  // Used to remember the user-specified precedence or provider URLs. 0 means highest
  private readonly urlPrecedence: Record<string, number> = {}

  // If provided, we will use this weight to decide the probability of choosing
  // one of the healthy providers.
  private readonly urlWeight: Record<string, number> = {}

  private lastUsedProvider: SingleJsonRpcProvider | null = null

  private allowProviderSwitch: boolean = true

  private totallyDisableFallback: boolean = false

  constructor(chainId: ChainId, singleRpcProviders: SingleJsonRpcProvider[], ranking?: number[], weights?: number[]) {
    // Dummy super constructor call is needed.
    super('dummy_url', { chainId, name: 'dummy_network' })

    if (isEmpty(singleRpcProviders)) {
      throw new Error('Empty singlePrcProviders')
    }

    if (ranking !== undefined && weights !== undefined && weights && ranking.length != weights.length) {
      throw new Error('urls and weights need to have the same length')
    }

    this.chainId = chainId
    this.providers = singleRpcProviders
    for (let i = 0; i < this.providers.length; i++) {
      const url = this.providers[i].url
      if (ranking !== undefined) {
        if (ranking[i] < 0) {
          throw new Error(`Invalid rank: ${ranking[i]}. Rank needs to be a positive number`)
        }
        this.urlPrecedence[url] = ranking[i]
      } else {
        this.urlPrecedence[url] = i
      }
      if (weights != undefined) {
        if (weights[i] <= 0) {
          throw new Error(`Invalid weight: ${weights[i]}. Weight needs to be a positive number`)
        }
        this.urlWeight[url] = weights[i]
      }
    }
  }

  get currentHealthyUrls() {
    const healthyProviders = this.providers.filter((provider) => provider.isHealthy())
    return healthyProviders.map((provider) => provider.url)
  }

  get currentUnhealthyUrls() {
    const unhealthyProviders = this.providers.filter((provider) => !provider.isHealthy())
    return unhealthyProviders.map((provider) => provider.url)
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

  disableFallback() {
    this.totallyDisableFallback = true
  }

  private selectPreferredProvider(): SingleJsonRpcProvider {
    if (this.totallyDisableFallback) {
      const providers = [...this.providers]
      this.reorderProviders(providers)
      return providers[0]
    }

    if (!this.allowProviderSwitch && this.lastUsedProvider !== null) {
      if (this.lastUsedProvider.isHealthy()) {
        return this.lastUsedProvider
      } else {
        throw new Error('Forced to use last used provider which is unhealthy')
      }
    }

    const healthyProviders = this.providers.filter((provider) => provider.isHealthy())
    if (isEmpty(healthyProviders)) {
      throw new Error('No healthy provider available')
    }

    this.reorderProviders(healthyProviders)

    if (isEmpty(this.urlWeight)) {
      return healthyProviders[0]
    }

    const urlWeightSum = this.calculateHealthyProviderUrlWeightSum(healthyProviders)
    const rand = Math.random() * urlWeightSum
    // No need to use binary search since the size of healthy providers is very small.
    let accumulatedWeight: number = 0
    for (const provider of healthyProviders) {
      accumulatedWeight += this.urlWeight[provider.url]
      if (accumulatedWeight >= rand) {
        return provider
      }
    }

    throw new Error('Encounter error when selecting preferred provider')
  }

  async perform(method: string, params: any): Promise<any> {
    const selectedProvider = this.selectPreferredProvider()
    this.lastUsedProvider = selectedProvider
    debug(`Use provider ${selectedProvider.url} for chain ${this.chainId.toString()}`)
    try {
      return await selectedProvider.perform(method, params)
    } finally {
      this.checkUnhealthyProvider()
    }
  }

  private reorderProviders(providers: SingleJsonRpcProvider[]) {
    providers.sort((a, b) => {
      return this.urlPrecedence[a.url] - this.urlPrecedence[b.url]
    })
  }

  private calculateHealthyProviderUrlWeightSum(healthyProviders: SingleJsonRpcProvider[]): number {
    if (!isEmpty(this.urlWeight)) {
      let urlWeightSum = 0
      for (const provider of healthyProviders) {
        urlWeightSum += this.urlWeight[provider.url]
      }
      return urlWeightSum
    } else {
      throw new Error('Weights are not provided')
    }
  }

  private checkUnhealthyProvider() {
    debug('after a call, checkUnhealthyProvider')

    for (const provider of this.providers) {
      if (!provider.isHealthy() && provider.hasEnoughWaitSinceLastCall()) {
        provider.evaluateForRecovery()  // not blocking
      }
    }
  }

  debugPrintProviderHealthScores() {
    debug('=== Healthy Providers ===')
    for (const provider of this.providers.filter((provider) => provider.isHealthy())) {
      debug(`\turl: ${provider.url}, \tscore: ${provider['healthScore']}`)
    }
    debug('=== Unhealthy Providers ===')
    for (const provider of this.providers.filter((provider) => !provider.isHealthy())) {
      debug(`\turl: ${provider.url}, \tscore: ${provider['healthScore']}`)
    }
  }
}
