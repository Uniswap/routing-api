import { CachedRoutes, CacheMode, ChainId, IRouteCachingProvider } from '@uniswap/smart-order-router'
import { DynamoDB } from 'aws-sdk'
import { Currency, CurrencyAmount, Token, TradeType } from '@uniswap/sdk-core'
import { Protocol } from '@uniswap/router-sdk'
import { CACHED_ROUTES_CONFIGURATION } from './cached-routes-configuration'
import { PairTradeTypeChainId } from './model/pair-trade-type-chain-id'

export class DynamoRouteCachingProvider extends IRouteCachingProvider {
  private ddbClient: DynamoDB.DocumentClient
  private tableName: string

  constructor(cachedRoutesTableName: string) {
    super()
    this.ddbClient = new DynamoDB.DocumentClient()
    this.tableName = cachedRoutesTableName
  }
  protected _getBlocksToLive(cachedRoutes: CachedRoutes, amount: CurrencyAmount<Currency>): Promise<number> {
    const pairTradeTypeChainId = new PairTradeTypeChainId({
      tokenIn: cachedRoutes.tokenIn.address,
      tokenOut: cachedRoutes.tokenOut.address,
      tradeType: cachedRoutes.tradeType,
      chainId: cachedRoutes.chainId,
    })

    const configuration = CACHED_ROUTES_CONFIGURATION.get(pairTradeTypeChainId)?.getCachingParameters(amount)

    if (configuration) {
      return Promise.resolve(configuration.blocksToLive)
    } else {
      return Promise.resolve(0)
    }
  }

  protected _getCachedRoute(
    chainId: ChainId,
    amount: CurrencyAmount<Currency>,
    quoteToken: Token,
    tradeType: TradeType,
    protocols: Protocol[]
  ): Promise<CachedRoutes | undefined> {
    return Promise.resolve(undefined)
  }

  protected _setCachedRoute(cachedRoutes: CachedRoutes, amount: CurrencyAmount<Currency>): Promise<boolean> {
    return Promise.resolve(false)
  }

  getCacheMode(
    chainId: ChainId,
    amount: CurrencyAmount<Currency>,
    quoteToken: Token,
    tradeType: TradeType,
    _protocols: Protocol[]
  ): Promise<CacheMode> {
    let tokenIn: Token, tokenOut: Token
    if (tradeType == TradeType.EXACT_INPUT) {
      tokenIn = amount.currency.wrapped
      tokenOut = quoteToken
    } else {
      tokenIn = quoteToken
      tokenOut = amount.currency.wrapped
    }

    const pairTradeTypeChainId = new PairTradeTypeChainId({
      tokenIn: tokenIn.address,
      tokenOut: tokenOut.address,
      tradeType: tradeType,
      chainId: chainId,
    })

    const configuration = CACHED_ROUTES_CONFIGURATION.get(pairTradeTypeChainId)?.getCachingParameters(amount)

    if (configuration) {
      return Promise.resolve(configuration.cacheMode)
    } else {
      return Promise.resolve(CacheMode.Darkmode)
    }
  }
}
