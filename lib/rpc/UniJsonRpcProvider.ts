import { SingleJsonRpcProvider } from './SingleJsonRpcProvider'
import { StaticJsonRpcProvider, TransactionRequest } from '@ethersproject/providers'
import { isEmpty } from 'lodash'
import { ChainId } from '@uniswap/sdk-core'
import {
  BlockTag,
  BlockWithTransactions,
  Filter,
  Log,
  TransactionReceipt,
  TransactionResponse,
} from '@ethersproject/abstract-provider'
import { LRUCache } from 'lru-cache'
import { BigNumber, BigNumberish } from '@ethersproject/bignumber'
import { Deferrable } from '@ethersproject/properties'
import Logger from 'bunyan'

export class UniJsonRpcProvider extends StaticJsonRpcProvider {
  readonly chainId: ChainId = ChainId.MAINNET

  private readonly providers: SingleJsonRpcProvider[] = []

  // Used to remember the user-specified precedence or provider URLs. 0 means highest
  private readonly urlPrecedence: Record<string, number> = {}

  // If provided, we will use this weight to decide the probability of choosing
  // one of the healthy providers.
  private readonly urlWeight: Record<string, number> = {}

  private lastUsedProvider: SingleJsonRpcProvider | null = null

  private totallyDisableFallback: boolean = false

  private sessionCache: LRUCache<string, SingleJsonRpcProvider> = new LRUCache({ max: 1000 })

  // If true, it's allowed to use a different provider if the preferred provider isn't healthy.
  private allowProviderAutoSwitch: boolean = true

  private readonly log: Logger

  constructor(
    chainId: ChainId,
    singleRpcProviders: SingleJsonRpcProvider[],
    log: Logger,
    ranking?: number[],
    weights?: number[],
    allowProviderAutoSwitch?: boolean
  ) {
    // Dummy super constructor call is needed.
    super('dummy_url', { chainId, name: 'dummy_network' })
    this.connection.url
    this.log = log

    if (isEmpty(singleRpcProviders)) {
      throw new Error('Empty singlePrcProviders')
    }

    if (ranking !== undefined && weights !== undefined && ranking.length != weights.length) {
      throw new Error('urls and weights need to have the same length')
    }

    this.chainId = chainId
    this.providers = singleRpcProviders
    for (let i = 0; i < this.providers.length; i++) {
      const url = this.providers[i].url
      if (ranking !== undefined) {
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

    if (allowProviderAutoSwitch !== undefined) {
      this.allowProviderAutoSwitch = allowProviderAutoSwitch
    }
  }

  private selectPreferredProvider(sessionId?: string): SingleJsonRpcProvider {
    if (this.totallyDisableFallback) {
      const providers = [...this.providers]
      this.reorderProviders(providers)
      this.log.debug(`Use provider ${providers[0].url} for chain ${this.chainId.toString()}`)
      return providers[0]
    }

    if (sessionId !== undefined && this.sessionCache.has(sessionId)) {
      const provider = this.sessionCache.get(sessionId)!
      if (provider.isHealthy()) {
        return provider
      } else if (!this.allowProviderAutoSwitch) {
        throw new Error(
          `Forced to use the same provider during the session but the provider (${provider.providerName}) is unhealthy`
        )
      }
    }

    this.logProviderHealthScores()

    const healthyProviders = this.providers.filter((provider) => provider.isHealthy())
    if (isEmpty(healthyProviders)) {
      throw new Error('No healthy provider available')
    }

    this.reorderProviders(healthyProviders)

    if (isEmpty(this.urlWeight)) {
      this.log.debug(`Use provider ${healthyProviders[0].url} for chain ${this.chainId.toString()}`)
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
        this.log.debug(`accumulatedWeight: ${accumulatedWeight} >= rand: ${rand}, urlWeightSum: ${urlWeightSum}`)
        this.log.debug(`Use provider ${provider.url} for chain ${this.chainId.toString()}`)
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
    this.log.debug('After serving a call, check unhealthy providers')
    let count = 0
    for (const provider of this.providers) {
      if (!provider.isHealthy() && provider.hasEnoughWaitSinceLastCall()) {
        provider.evaluateForRecovery()
        count++
      }
    }
    this.log.debug(`Evaluated ${count} unhealthy providers`)
  }

  logProviderHealthScores() {
    for (const provider of this.providers.filter((provider) => provider.isHealthy())) {
      this.log.debug(`=== Healthy provider ===\turl: ${provider.url}, \tscore: ${provider['healthScore']}`)
      provider.logHealthMetrics()
    }
    for (const provider of this.providers.filter((provider) => !provider.isHealthy())) {
      this.log.debug(`=== Unhealthy provider ===\turl: ${provider.url}, \tscore: ${provider['healthScore']}`)
      provider.logHealthMetrics()
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

  disableFallback() {
    this.totallyDisableFallback = true
  }

  createNewSessionId(): string {
    const sessionId = `${Date.now()}-${Math.floor(Math.random() * 1000)}`
    this.log.debug(`New session id ${sessionId}`)
    return sessionId
  }

  private wrappedFunctionCall(fnName: string, sessionId?: string, ...args: any[]): Promise<any> {
    this.log.debug(
      `UniJsonRpcProvider: wrappedFunctionCall: fnName: ${fnName}, sessionId: ${sessionId}, args: ${[...args]}`
    )
    const selectedProvider = this.selectPreferredProvider(sessionId)
    return (selectedProvider as any)
      [`${fnName}`](...args)
      .then((response: any) => {
        return response
      })
      .catch((error: any) => {
        this.log.error(JSON.stringify(error))
        throw error
      })
      .finally(() => {
        this.lastUsedProvider = selectedProvider
        this.checkUnhealthyProvider()
      })
  }

  ///////////////////// Begin of override functions /////////////////////

  // Notice: We should only intercept public methods that live at the top level and supposed to be called by user code

  override getBlockNumber(sessionId?: string): Promise<number> {
    return this.wrappedFunctionCall('getBlockNumber', sessionId)
  }

  override getBlockWithTransactions(
    blockHashOrBlockTag: BlockTag | string | Promise<BlockTag | string>,
    sessionId?: string
  ): Promise<BlockWithTransactions> {
    return this.wrappedFunctionCall('getBlockWithTransactions', sessionId, blockHashOrBlockTag)
  }

  override getCode(
    addressOrName: string | Promise<string>,
    blockTag?: BlockTag | Promise<BlockTag>,
    sessionId?: string
  ): Promise<string> {
    return this.wrappedFunctionCall('getCode', sessionId, addressOrName, blockTag)
  }

  override getGasPrice(sessionId?: string): Promise<BigNumber> {
    return this.wrappedFunctionCall('getGasPrice', sessionId)
  }

  override getLogs(filter: Filter, sessionId?: string): Promise<Array<Log>> {
    return this.wrappedFunctionCall('getLogs', sessionId, filter)
  }

  override getStorageAt(
    addressOrName: string | Promise<string>,
    position: BigNumberish | Promise<BigNumberish>,
    blockTag?: BlockTag | Promise<BlockTag>,
    sessionId?: string
  ): Promise<string> {
    return this.wrappedFunctionCall('getStorageAt', sessionId, addressOrName, position, blockTag)
  }

  override getTransaction(transactionHash: string | Promise<string>, sessionId?: string): Promise<TransactionResponse> {
    return this.wrappedFunctionCall('getTransaction', sessionId, transactionHash)
  }

  override getTransactionCount(
    addressOrName: string | Promise<string>,
    blockTag?: BlockTag | Promise<BlockTag>,
    sessionId?: string
  ): Promise<number> {
    return this.wrappedFunctionCall('getTransactionCount', sessionId, addressOrName, blockTag)
  }

  override getTransactionReceipt(
    transactionHash: string | Promise<string>,
    sessionId?: string
  ): Promise<TransactionReceipt> {
    return this.wrappedFunctionCall('getTransactionReceipt', sessionId, transactionHash)
  }

  override lookupAddress(address: string | Promise<string>, sessionId?: string): Promise<string | null> {
    return this.wrappedFunctionCall('lookupAddress', sessionId, address)
  }

  override resolveName(name: string | Promise<string>, sessionId?: string): Promise<string | null> {
    return this.wrappedFunctionCall('resolveName', sessionId, name)
  }

  override sendTransaction(
    signedTransaction: string | Promise<string>,
    sessionId?: string
  ): Promise<TransactionResponse> {
    return this.wrappedFunctionCall('sendTransaction', sessionId, signedTransaction)
  }

  override waitForTransaction(
    transactionHash: string,
    confirmations?: number,
    timeout?: number,
    sessionId?: string
  ): Promise<TransactionReceipt> {
    return this.wrappedFunctionCall('waitForTransaction', sessionId, transactionHash, confirmations, timeout)
  }

  override call(
    transaction: Deferrable<TransactionRequest>,
    blockTag?: BlockTag | Promise<BlockTag>,
    sessionId?: string
  ): Promise<string> {
    return this.wrappedFunctionCall('call', sessionId, transaction, blockTag)
  }

  override send(method: string, params: Array<any>, sessionId?: string): Promise<any> {
    return this.wrappedFunctionCall('send', sessionId, method, params)
  }
}
