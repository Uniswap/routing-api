import SingleJsonRpcProvider from './singleJsonRpcProvider'
import { StaticJsonRpcProvider, TransactionRequest } from '@ethersproject/providers'
import Debug from 'debug'
import { isEmpty } from 'lodash'
import { ChainId } from '@uniswap/sdk-core'
import {
  BlockTag,
  BlockWithTransactions,
  Filter,
  Log,
  TransactionReceipt,
  TransactionResponse
} from '@ethersproject/abstract-provider'
import { LRUCache } from 'lru-cache'
import { BigNumber, BigNumberish } from '@ethersproject/bignumber'
import { Network } from '@ethersproject/networks'
import { Deferrable } from '@ethersproject/properties'

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

  private sessionCache: LRUCache<string, SingleJsonRpcProvider> = new LRUCache({ max: 1000 })

  constructor(chainId: ChainId, singleRpcProviders: SingleJsonRpcProvider[], ranking?: number[], weights?: number[]) {
    // Dummy super constructor call is needed.
    super('dummy_url', { chainId, name: 'dummy_network' })
    this.connection.url

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

  private selectPreferredProvider(sessionId?: string): SingleJsonRpcProvider {
    if (this.totallyDisableFallback) {
      const providers = [...this.providers]
      this.reorderProviders(providers)
      debug(`Use provider ${providers[0].url} for chain ${this.chainId.toString()}`)
      return providers[0]
    }

    if (!this.allowProviderSwitch && this.lastUsedProvider !== null) {
      if (this.lastUsedProvider.isHealthy()) {
        debug(`Use provider ${this.lastUsedProvider.url} for chain ${this.chainId.toString()}`)
        return this.lastUsedProvider
      } else {
        throw new Error('Forced to use last used provider which is unhealthy')
      }
    }

    if (sessionId !== undefined && this.sessionCache.has(sessionId)) {
      const provider = this.sessionCache.get(sessionId)!
      if (!provider.isHealthy()) {
        throw new Error('Forced to use the same provider during the session but the provider is unhealthy')
      }
      return provider
    }

    const healthyProviders = this.providers.filter((provider) => provider.isHealthy())
    if (isEmpty(healthyProviders)) {
      throw new Error('No healthy provider available')
    }

    this.reorderProviders(healthyProviders)

    if (isEmpty(this.urlWeight)) {
      debug(`Use provider ${healthyProviders[0].url} for chain ${this.chainId.toString()}`)
      if (sessionId !== undefined) {
        this.sessionCache.set(sessionId, healthyProviders[0])
      }
      return healthyProviders[0]
    }

    const urlWeightSum = this.calculateHealthyProviderUrlWeightSum(healthyProviders)
    const rand = Math.random() * urlWeightSum
    // No need to use binary search since the size of healthy providers is very small.
    let accumulatedWeight: number = 0
    for (const provider of healthyProviders) {
      accumulatedWeight += this.urlWeight[provider.url]
      if (accumulatedWeight >= rand) {
        debug(`Use provider ${provider.url} for chain ${this.chainId.toString()}`)
        if (sessionId !== undefined) {
          this.sessionCache.set(sessionId, provider)
        }
        return provider
      }
    }

    throw new Error('Encounter error when selecting preferred provider')
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
        provider.evaluateForRecovery()
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

  createNewSessionId(): string {
    const sessionId = `${Date.now()}-${Math.floor(Math.random() * 1000)}`
    debug(`New session id ${sessionId}`)
    return sessionId
  }

  ///////////////////// Begin of override functions /////////////////////

  // Notice: We should only intercept public methods that live at the top level and supposed to be called by user code

  override getBlockNumber(sessionId?: string): Promise<number> {
    const selectedProvider = this.selectPreferredProvider(sessionId)
    return selectedProvider
      .getBlockNumber()
      .then((response) => {
        console.log('********* ON UNI THEN *********')
        return response
      })
      .catch((error) => {
        console.log('********* ON UNI CATCH *********')
        throw error
      })
      .finally(() => {
        console.log('********* ON UNI FINALLY *********')
        this.lastUsedProvider = selectedProvider
        this.checkUnhealthyProvider()
      })
  }

  override getBlockWithTransactions(
    blockHashOrBlockTag: BlockTag | string | Promise<BlockTag | string>,
    sessionId?: string
  ): Promise<BlockWithTransactions> {
    const selectedProvider = this.selectPreferredProvider(sessionId)
    return selectedProvider
      .getBlockWithTransactions(blockHashOrBlockTag)
      .then((response) => {
        return response
      })
      .catch((error) => {
        throw error
      })
      .finally(() => {
        this.lastUsedProvider = selectedProvider
        this.checkUnhealthyProvider()
      })
  }

  override getCode(
    addressOrName: string | Promise<string>,
    blockTag?: BlockTag | Promise<BlockTag>,
    sessionId?: string
  ): Promise<string> {
    const selectedProvider = this.selectPreferredProvider(sessionId)
    return selectedProvider
      .getCode(addressOrName, blockTag)
      .then((response) => {
        return response
      })
      .catch((error) => {
        throw error
      })
      .finally(() => {
        this.lastUsedProvider = selectedProvider
        this.checkUnhealthyProvider()
      })
  }

  override getGasPrice(sessionId?: string): Promise<BigNumber> {
    const selectedProvider = this.selectPreferredProvider(sessionId)
    return selectedProvider
      .getGasPrice()
      .then((response) => {
        return response
      })
      .catch((error) => {
        throw error
      })
      .finally(() => {
        this.lastUsedProvider = selectedProvider
        this.checkUnhealthyProvider()
      })
  }

  override getLogs(filter: Filter, sessionId?: string): Promise<Array<Log>> {
    const selectedProvider = this.selectPreferredProvider(sessionId)
    return selectedProvider
      .getLogs(filter)
      .then((response) => {
        return response
      })
      .catch((error) => {
        throw error
      })
      .finally(() => {
        this.lastUsedProvider = selectedProvider
        this.checkUnhealthyProvider()
      })
  }

  override getNetwork(sessionId?: string): Promise<Network> {
    const selectedProvider = this.selectPreferredProvider(sessionId)
    return selectedProvider
      .getNetwork()
      .then((response) => {
        return response
      })
      .catch((error) => {
        throw error
      })
      .finally(() => {
        this.lastUsedProvider = selectedProvider
        this.checkUnhealthyProvider()
      })
  }

  override getStorageAt(
    addressOrName: string | Promise<string>,
    position: BigNumberish | Promise<BigNumberish>,
    blockTag?: BlockTag | Promise<BlockTag>,
    sessionId?: string
  ): Promise<string> {
    const selectedProvider = this.selectPreferredProvider(sessionId)
    return selectedProvider
      .getStorageAt(addressOrName, position, blockTag)
      .then((response) => {
        return response
      })
      .catch((error) => {
        throw error
      })
      .finally(() => {
        this.lastUsedProvider = selectedProvider
        this.checkUnhealthyProvider()
      })
  }

  override getTransaction(transactionHash: string | Promise<string>, sessionId?: string): Promise<TransactionResponse> {
    const selectedProvider = this.selectPreferredProvider(sessionId)
    return selectedProvider
      .getTransaction(transactionHash)
      .then((response) => {
        return response
      })
      .catch((error) => {
        throw error
      })
      .finally(() => {
        this.lastUsedProvider = selectedProvider
        this.checkUnhealthyProvider()
      })
  }

  override getTransactionCount(
    addressOrName: string | Promise<string>,
    blockTag?: BlockTag | Promise<BlockTag>,
    sessionId?: string
  ): Promise<number> {
    const selectedProvider = this.selectPreferredProvider(sessionId)
    return selectedProvider
      .getTransactionCount(addressOrName, blockTag)
      .then((response) => {
        return response
      })
      .catch((error) => {
        throw error
      })
      .finally(() => {
        this.lastUsedProvider = selectedProvider
        this.checkUnhealthyProvider()
      })
  }

  override getTransactionReceipt(
    transactionHash: string | Promise<string>,
    sessionId?: string
  ): Promise<TransactionReceipt> {
    const selectedProvider = this.selectPreferredProvider(sessionId)
    return selectedProvider
      .getTransactionReceipt(transactionHash)
      .then((response) => {
        return response
      })
      .catch((error) => {
        throw error
      })
      .finally(() => {
        this.lastUsedProvider = selectedProvider
        this.checkUnhealthyProvider()
      })
  }

  override lookupAddress(address: string | Promise<string>, sessionId?: string): Promise<string | null> {
    const selectedProvider = this.selectPreferredProvider(sessionId)
    return selectedProvider
      .lookupAddress(address)
      .then((response) => {
        return response
      })
      .catch((error) => {
        throw error
      })
      .finally(() => {
        this.lastUsedProvider = selectedProvider
        this.checkUnhealthyProvider()
      })
  }

  override resolveName(name: string | Promise<string>, sessionId?: string): Promise<string | null> {
    const selectedProvider = this.selectPreferredProvider(sessionId)
    return selectedProvider
      .resolveName(name)
      .then((response) => {
        return response
      })
      .catch((error) => {
        throw error
      })
      .finally(() => {
        this.lastUsedProvider = selectedProvider
        this.checkUnhealthyProvider()
      })
  }

  override sendTransaction(
    signedTransaction: string | Promise<string>,
    sessionId?: string
  ): Promise<TransactionResponse> {
    const selectedProvider = this.selectPreferredProvider(sessionId)
    return selectedProvider
      .sendTransaction(signedTransaction)
      .then((response) => {
        return response
      })
      .catch((error) => {
        throw error
      })
      .finally(() => {
        this.lastUsedProvider = selectedProvider
        this.checkUnhealthyProvider()
      })
  }

  override waitForTransaction(
    transactionHash: string,
    confirmations?: number,
    timeout?: number,
    sessionId?: string
  ): Promise<TransactionReceipt> {
    const selectedProvider = this.selectPreferredProvider(sessionId)
    return selectedProvider
      .waitForTransaction(transactionHash, confirmations, timeout)
      .then((response) => {
        return response
      })
      .catch((error) => {
        throw error
      })
      .finally(() => {
        this.lastUsedProvider = selectedProvider
        this.checkUnhealthyProvider()
      })
  }

  override call(transaction: Deferrable<TransactionRequest>, blockTag?: BlockTag | Promise<BlockTag>, sessionId?: string): Promise<string> {
    const selectedProvider = this.selectPreferredProvider(sessionId)
    return selectedProvider
      .call(transaction, blockTag)
      .then((response) => {
        return response
      })
      .catch((error) => {
        throw error
      })
      .finally(() => {
        this.lastUsedProvider = selectedProvider
        this.checkUnhealthyProvider()
      })
  }

  override send(method: string, params: Array<any>, sessionId?: string): Promise<any> {
    const selectedProvider = this.selectPreferredProvider(sessionId)
    return selectedProvider
      .send(method, params)
      .then((response) => {
        return response
      })
      .catch((error) => {
        throw error
      })
      .finally(() => {
        this.lastUsedProvider = selectedProvider
        this.checkUnhealthyProvider()
      })
  }


}
