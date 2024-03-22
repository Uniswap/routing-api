import { MAJOR_METHOD_NAMES, SingleJsonRpcProvider } from './SingleJsonRpcProvider'
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
import { DEFAULT_UNI_PROVIDER_CONFIG, UniJsonRpcProviderConfig } from './config'

export class UniJsonRpcProvider extends StaticJsonRpcProvider {
  readonly chainId: ChainId = ChainId.MAINNET

  private readonly providers: SingleJsonRpcProvider[] = []

  // If provided, we will use this weight to decide the probability of choosing
  // one of the healthy providers.
  // If not provided, we will only give non-zero weight to the first provider.
  private urlWeight: Record<string, number> = {}

  private lastUsedProvider: SingleJsonRpcProvider | null = null

  private sessionCache: LRUCache<string, SingleJsonRpcProvider> = new LRUCache({ max: 1000 })

  // If true, it's allowed to use a different provider if the preferred provider isn't healthy.
  private readonly sessionAllowProviderFallbackWhenUnhealthy: boolean = true

  private config: UniJsonRpcProviderConfig

  private readonly log: Logger

  // Force attach a session id to this instance.
  // For later RPC calls, we will treat this as the session id, even if the RPC call itself doesn't specify one.
  attachedSessionId: string | null = null

  /**
   *
   * @param chainId
   * @param singleRpcProviders
   * @param log
   * @param weights
   *  Positive value represents provider weight when selecting from different healthy providers.
   *  It's usually a positive integer value.
   *  Special values:
   *    NEVER(0) means this provider will never be able to be selected.
   *    AS_FALLBACK(-1) means this provider will only be able to be selected when no healthy provider has positive weights. In that case, the first healthy provider with -1 will be selected.
   *  Not providing this argument means using -1 for all weight values.
   * @param sessionAllowProviderFallbackWhenUnhealthy
   * @param config
   */
  constructor(
    chainId: ChainId,
    singleRpcProviders: SingleJsonRpcProvider[],
    log: Logger,
    weights?: number[],
    sessionAllowProviderFallbackWhenUnhealthy?: boolean,
    config: UniJsonRpcProviderConfig = DEFAULT_UNI_PROVIDER_CONFIG
  ) {
    // Dummy super constructor call is needed.
    super('dummy_url', { chainId, name: 'dummy_network' })
    this.log = log
    this.config = config

    if (isEmpty(singleRpcProviders)) {
      throw new Error('Empty singlePrcProviders')
    }

    if (weights !== undefined && singleRpcProviders.length != weights!.length) {
      throw new Error('weights, if provided, should have the same length as providers')
    }

    this.chainId = chainId

    this.providers = singleRpcProviders

    for (let i = 0; i < this.providers.length; i++) {
      const url = this.providers[i].url
      if (weights != undefined) {
        this.urlWeight[url] = weights[i]
      } else {
        this.urlWeight[url] = -1
      }
    }

    if (sessionAllowProviderFallbackWhenUnhealthy !== undefined) {
      this.sessionAllowProviderFallbackWhenUnhealthy = sessionAllowProviderFallbackWhenUnhealthy
    }
  }

  private selectOneOfHealthyProvidersBasedOnWeights(healthyProviders: SingleJsonRpcProvider[]): SingleJsonRpcProvider {
    const urlWeightSum = this.calculateHealthyProviderUrlWeightSum(healthyProviders)
    if (urlWeightSum === 0) {
      for (const provider of healthyProviders) {
        if (this.urlWeight[provider.url] == -1) {
          return provider
        }
      }
      throw new Error(
        'Cannot select provider because url weight sum is 0 but no healthy provider is allowed to be used'
      )
    }

    // Sort providers based on url weight, from large to small
    healthyProviders.sort((a, b) => {
      return this.urlWeight[b.url] - this.urlWeight[a.url]
    })

    const rand = Math.random() * urlWeightSum
    // No need to use binary search since the size of healthy providers is very small.
    let accumulatedWeight: number = 0
    for (const provider of healthyProviders) {
      let weight = this.urlWeight[provider.url]
      if (weight == -1) {
        weight = 0
      }
      accumulatedWeight += weight
      if (accumulatedWeight >= rand) {
        this.log.debug(`accumulatedWeight: ${accumulatedWeight} >= rand: ${rand}, urlWeightSum: ${urlWeightSum}`)
        return provider
      }
    }
    throw new Error('Encounter error when selecting preferred provider')
  }

  private selectPreferredProvider(sessionId?: string): SingleJsonRpcProvider {
    // If session is used, stick to the last provider, if possible.
    if (sessionId !== undefined && this.sessionCache.has(sessionId)) {
      const selectedProvider = this.sessionCache.get(sessionId)!
      if (selectedProvider.isHealthy()) {
        this.log.debug(`Use provider ${selectedProvider.url} for chain ${this.chainId.toString()}`)
        return selectedProvider
      } else if (!this.sessionAllowProviderFallbackWhenUnhealthy) {
        throw new Error(
          `Forced to use the same provider during the session but the provider (${selectedProvider.providerName}) is unhealthy`
        )
      }
    }

    this.logProviderHealthScores()

    const healthyProviders = this.providers.filter((provider) => provider.isHealthy())
    if (isEmpty(healthyProviders)) {
      throw new Error('No healthy provider available')
    }

    const selectedProvider = this.selectOneOfHealthyProvidersBasedOnWeights(healthyProviders)
    this.log.debug(`Use provider ${selectedProvider.url} for chain ${this.chainId.toString()}`)

    if (sessionId !== undefined) {
      this.sessionCache.set(sessionId, selectedProvider)
    }

    return selectedProvider
  }

  private calculateHealthyProviderUrlWeightSum(healthyProviders: SingleJsonRpcProvider[]): number {
    let urlWeightSum = 0
    for (const provider of healthyProviders) {
      let weight = this.urlWeight[provider.url]
      if (weight == -1) {
        weight = 0
      }
      urlWeightSum += weight
    }
    return urlWeightSum
  }

  // Shadow call to all unhealthy providers to get some idea about their latest health state.
  private checkUnhealthyProviders(selectedProvider: SingleJsonRpcProvider) {
    this.log.debug('After serving a call, check unhealthy providers')
    const unhealthyProviders = this.providers.filter((provider) => !provider.isHealthy())
    let count = 0
    for (const provider of unhealthyProviders) {
      if (provider.url === selectedProvider.url) {
        continue
      }
      if (
        !provider.isEvaluatingHealthiness() &&
        provider.hasEnoughWaitSinceLastHealthinessEvaluation(1000 * this.config.HEALTH_EVALUATION_WAIT_PERIOD_IN_S)
      ) {
        // Fire and forget. Don't care about its result and it won't throw.
        // It's done this way because We don't want to block the return of this function.
        provider.evaluateHealthiness()
        count++
      }
    }
    this.log.debug(`Evaluate ${count} unhealthy providers`)
  }

  // Shadow call to other health providers that are not selected for performing current request
  // to gather their health states from time to time.
  private checkOtherHealthyProvider(selectedProvider: SingleJsonRpcProvider, methodName: string, args: any[]) {
    const healthyProviders = this.providers.filter((provider) => provider.isHealthy())
    let count = 0
    for (let provider of healthyProviders) {
      if (provider.url === selectedProvider.url) {
        continue
      }
      if (
        !provider.isEvaluatingLatency() &&
        MAJOR_METHOD_NAMES.includes(methodName) &&
        provider.hasEnoughWaitSinceLastLatencyEvaluation(1000 * this.config.LATENCY_EVALUATION_WAIT_PERIOD_IN_S)
      ) {
        // Fire and forget. Don't care about its result and it won't throw.
        // It's done this way because We don't want to block the return of this function.
        provider.evaluateLatency(methodName, args)
        count++
      }
    }
    this.log.debug(`Evaluated ${count} other healthy providers`)
  }

  logProviderHealthScores() {
    for (const provider of this.providers.filter((provider) => provider.isHealthy())) {
      this.log.debug(`Healthy provider, url: ${provider.url}, score: ${provider['healthScore']}`)
      provider.logHealthMetrics()
    }
    for (const provider of this.providers.filter((provider) => !provider.isHealthy())) {
      this.log.debug(`Unhealthy provider, url: ${provider.url}, score: ${provider['healthScore']}`)
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

  createNewSessionId(): string {
    const sessionId = `${Date.now()}-${Math.floor(Math.random() * 1000)}`
    this.log.debug(`New session id ${sessionId}`)
    return sessionId
  }

  forceAttachToNewSession() {
    this.attachedSessionId = this.createNewSessionId()
  }

  private async wrappedFunctionCall(fnName: string, sessionId?: string, ...args: any[]): Promise<any> {
    if (this.attachedSessionId !== null) {
      this.log.debug(
        `UniJsonRpcProvider for chain ${this.chainId} currently attached to session id ${this.attachedSessionId}`
      )
      sessionId = this.attachedSessionId
    }

    this.log.debug(
      `UniJsonRpcProvider: wrappedFunctionCall: fnName: ${fnName}, sessionId: ${sessionId}, args: ${[...args]}`
    )
    const selectedProvider = this.selectPreferredProvider(sessionId)
    selectedProvider.logProviderSelection()
    try {
      return await (selectedProvider as any)[`${fnName}`](...args)
    } catch (error: any) {
      this.log.error(JSON.stringify(error))
      throw error
    } finally {
      this.lastUsedProvider = selectedProvider
      if (this.config.ENABLE_SHADOW_LATENCY_EVALUATION) {
        this.checkOtherHealthyProvider(selectedProvider, fnName, args)
      }
      this.checkUnhealthyProviders(selectedProvider)
    }
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
