import { CachedRoutes, CacheMode, ChainId, IRouteCachingProvider, log } from '@uniswap/smart-order-router'
import { DynamoDB } from 'aws-sdk'
import { Currency, CurrencyAmount, Token, TradeType } from '@uniswap/sdk-core'
import { Protocol } from '@uniswap/router-sdk'
import { CACHED_ROUTES_CONFIGURATION } from './cached-routes-configuration'
import { PairTradeTypeChainId } from './model/pair-trade-type-chain-id'
import { CachedRoutesMarshaller } from './marshalling/cached-routes-marshaller'
import { CachedRoutesStrategy } from './model/cached-routes-strategy'

interface ConstructorParams {
  cachedRoutesTableName: string
  ttl_minutes?: number
}

export class DynamoRouteCachingProvider extends IRouteCachingProvider {
  private ddbClient: DynamoDB.DocumentClient
  private tableName: string
  /**
   * Time to live of each element in minutes from now.
   * @private
   */
  private ttl_minutes: number

  constructor({ cachedRoutesTableName, ttl_minutes = 10 }: ConstructorParams) {
    super()
    this.ddbClient = new DynamoDB.DocumentClient()
    this.tableName = cachedRoutesTableName
    // We will evict cache entries from DynamoDB every 10 minutes, this is used to control the size of the database.
    this.ttl_minutes = ttl_minutes
  }

  protected async _getBlocksToLive(cachedRoutes: CachedRoutes, amount: CurrencyAmount<Currency>): Promise<number> {
    const cachedRoutesStrategy = this.getCachedRoutesStrategyFromCachedRoutes(cachedRoutes)
    const cachingParameters = cachedRoutesStrategy?.getCachingParameters(amount)

    if (cachingParameters) {
      return cachingParameters.blocksToLive
    } else {
      return 0
    }
  }

  protected async _getCachedRoute(
    chainId: ChainId,
    amount: CurrencyAmount<Currency>,
    quoteToken: Token,
    tradeType: TradeType,
    protocols: Protocol[]
  ): Promise<CachedRoutes | undefined> {
    const [tokenIn, tokenOut] = this.determineTokenInOut(amount, quoteToken, tradeType)
    const cachedRoutesStrategy = this.getCachedRoutesStrategy(tokenIn, tokenOut, tradeType, chainId)
    const cachingParameters = cachedRoutesStrategy?.getCachingParameters(amount)

    if (cachingParameters) {
      const pk = `${tokenIn.address}/${tokenOut.address}/${tradeType}/${chainId}`
      const sk = `${protocols}/${cachingParameters.bucket}/`

      const queryParams = {
        TableName: this.tableName,
        KeyConditionExpression: '#pk = :pk and begins_with(#sk, :sk)',
        ExpressionAttributeNames: {
          '#pk': 'pairTradeTypeChainId',
          '#sk': 'protocolsAmountBlockNumber',
        },
        ExpressionAttributeValues: {
          ':pk': pk,
          ':sk': sk,
        },
        ScanIndexForward: false, // Reverse order to retrieve most recent item first
        Limit: 1, // Only retrieve the most recent item
      }

      try {
        log.info({ queryParams }, `[DynamoRouteCachingProvider] Attempting to get route from cache.`)

        const result = await this.ddbClient.query(queryParams).promise()

        log.info({ result }, `[DynamoRouteCachingProvider] Got the following response from querying cache`)

        if (result.Items && result.Items.length > 0) {
          const itemBinary = result.Items[0]?.item
          const cachedRoutesBuffer = Buffer.from(itemBinary)
          const cachedRoutesJson = JSON.parse(cachedRoutesBuffer.toString())
          const cachedRoutes: CachedRoutes = CachedRoutesMarshaller.unmarshal(cachedRoutesJson)

          log.info({ cachedRoutes }, `[DynamoRouteCachingProvider] Returning the cached and unmarshalled route.`)

          return cachedRoutes
        } else {
          log.info(`[DynamoRouteCachingProvider] No items found in the query response.`)
        }
      } catch (error) {
        log.error({ queryParams, error }, `[DynamoRouteCachingProvider] Error while fetching route from cache`)
      }
    }

    // We only get here if we didn't find a cachedRoutes
    return undefined
  }

  protected async _setCachedRoute(cachedRoutes: CachedRoutes, amount: CurrencyAmount<Currency>): Promise<boolean> {
    const cachedRoutesStrategy = this.getCachedRoutesStrategyFromCachedRoutes(cachedRoutes)
    const cachingParameters = cachedRoutesStrategy?.getCachingParameters(amount)

    if (cachingParameters) {
      // TTL is 10 minutes from now. 600 seconds  = 10 minutes
      const ttl = Math.floor(Date.now() / 1000) + (60 * this.ttl_minutes)
      const marshalledCachedRoutes = CachedRoutesMarshaller.marshal(cachedRoutes)
      const jsonCachedRoutes = JSON.stringify(marshalledCachedRoutes)

      const putParams = {
        TableName: this.tableName,
        Item: {
          pairTradeTypeChainId: `${cachedRoutes.tokenIn.address}/${cachedRoutes.tokenOut.address}/${cachedRoutes.tradeType}/${cachedRoutes.chainId}`,
          protocolsAmountBlockNumber:`${cachedRoutes.protocolsCovered}/${cachingParameters.bucket}/${cachedRoutes.blockNumber}`,
          item: Buffer.from(jsonCachedRoutes),
          ttl: ttl,
        },
      }

      log.info({ putParams, cachedRoutes, jsonCachedRoutes },`[DynamoRouteCachingProvider] Attempting to insert route to cache`)

      try {
        await this.ddbClient.put(putParams).promise()
        log.info(`[DynamoRouteCachingProvider] Cached route inserted to cache`)
        return true
      } catch (error) {
        log.error({ error, putParams },`[DynamoRouteCachingProvider] Cached route failed to insert`)
        return false
      }
    } else {
      return false
    }
  }

  public async getCacheMode(
    chainId: ChainId,
    amount: CurrencyAmount<Currency>,
    quoteToken: Token,
    tradeType: TradeType,
    _protocols: Protocol[]
  ): Promise<CacheMode> {
    const [tokenIn, tokenOut] = this.determineTokenInOut(amount, quoteToken, tradeType)
    const cachedRoutesStrategy = this.getCachedRoutesStrategy(tokenIn, tokenOut, tradeType, chainId)
    const cachingParameters = cachedRoutesStrategy?.getCachingParameters(amount)

    if (cachingParameters) {
      log.info(
        {
          cachingParameters: cachingParameters,
          tokenIn: tokenIn.address,
          tokenOut: tokenOut.address,
          pair: `${tokenIn.symbol}/${tokenOut.symbol}`,
          chainId,
          tradeType,
          amount: amount.toExact()
        },
        `[DynamoRouteCachingProvider] Got CachingParameters for ${amount.toExact()} in ${tokenIn.symbol}/${tokenOut.symbol}/${tradeType}/${chainId}`
      )

      return cachingParameters.cacheMode
    } else {
      log.info(
        {
          tokenIn: tokenIn.address,
          tokenOut: tokenOut.address,
          pair: `${tokenIn.symbol}/${tokenOut.symbol}`,
          chainId,
          tradeType,
          amount: amount.toExact()
        },
        `[DynamoRouteCachingProvider] Didn't find CachingParameters for ${amount.toExact()} in ${tokenIn.symbol}/${tokenOut.symbol}/${tradeType}/${chainId}`
      )

      return CacheMode.Darkmode
    }
  }

  private getCachedRoutesStrategyFromCachedRoutes(cachedRoutes: CachedRoutes): CachedRoutesStrategy | undefined {
    return this.getCachedRoutesStrategy(
      cachedRoutes.tokenIn,
      cachedRoutes.tokenOut,
      cachedRoutes.tradeType,
      cachedRoutes.chainId
    )
  }

  private getCachedRoutesStrategy(
    tokenIn: Token,
    tokenOut: Token,
    tradeType: TradeType,
    chainId: ChainId
  ): CachedRoutesStrategy | undefined {
    const pairTradeTypeChainId = new PairTradeTypeChainId({
      tokenIn: tokenIn.address,
      tokenOut: tokenOut.address,
      tradeType: tradeType,
      chainId: chainId,
    })

    log.info({pairTradeTypeChainId}, `[DynamoRouteCachingProvider] Looking for cache configuration of ${pairTradeTypeChainId.toString()}`)

    return CACHED_ROUTES_CONFIGURATION.get(pairTradeTypeChainId.toString())
  }

  private determineTokenInOut(
    amount: CurrencyAmount<Currency>,
    quoteToken: Token,
    tradeType: TradeType
  ): [Token, Token] {
    if (tradeType == TradeType.EXACT_INPUT) {
      return [amount.currency.wrapped, quoteToken]
    } else {
      return [quoteToken, amount.currency.wrapped]
    }
  }
}
