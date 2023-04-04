import { CachedRoutes, CacheMode, ChainId, IRouteCachingProvider, log } from '@uniswap/smart-order-router'
import { DynamoDB } from 'aws-sdk'
import { Currency, CurrencyAmount, Token, TradeType } from '@uniswap/sdk-core'
import { Protocol } from '@uniswap/router-sdk'
import { CACHED_ROUTES_CONFIGURATION } from './cached-routes-configuration'
import { PairTradeTypeChainId } from './model/pair-trade-type-chain-id'
import { CachedRoutesMarshaller } from './marshalling/cached-routes-marshaller'
import { CachedRoutesStrategy } from './model/cached-routes-strategy'
import { ProtocolsBucketBlockNumber } from './model/protocols-bucket-block-number'

interface ConstructorParams {
  /**
   * The TableName for the DynamoDB Table. This is wired in from the CDK definition.
   */
  cachedRoutesTableName: string
  /**
   * The amount of minutes that a CachedRoute should live in the database.
   * This is used to limit the database growth, Dynamo will automatically delete expired entries.
   */
  ttlMinutes?: number
}

export class DynamoRouteCachingProvider extends IRouteCachingProvider {
  private readonly ddbClient: DynamoDB.DocumentClient
  private readonly tableName: string
  private readonly ttlMinutes: number

  constructor({ cachedRoutesTableName, ttlMinutes = 2 }: ConstructorParams) {
    super()
    // Since this DDB Table is used for Cache, we will fail fast and limit the timeout.
    this.ddbClient = new DynamoDB.DocumentClient({
      maxRetries: 1,
      retryDelayOptions: {
        base: 20,
      },
      httpOptions: {
        timeout: 100,
      },
    })
    this.tableName = cachedRoutesTableName
    this.ttlMinutes = ttlMinutes
  }

  /**
   * Implementation of the abstract method defined in `IRouteCachingProvider`
   * Given a CachedRoutesStrategy (from CACHED_ROUTES_CONFIGURATION),
   * we will find the BlocksToLive associated to the bucket.
   *
   * @param cachedRoutes
   * @param amount
   * @protected
   */
  protected async _getBlocksToLive(cachedRoutes: CachedRoutes, amount: CurrencyAmount<Currency>): Promise<number> {
    const cachedRoutesStrategy = this.getCachedRoutesStrategyFromCachedRoutes(cachedRoutes)
    const cachingParameters = cachedRoutesStrategy?.getCachingParameters(amount)

    if (cachingParameters) {
      return cachingParameters.blocksToLive
    } else {
      return 0
    }
  }

  /**
   * Implementation of the abstract method defined in `IRouteCachingProvider`
   * Fetch the most recent entry from the DynamoDB table for that pair, tradeType, chainId, protocols and bucket
   *
   * @param chainId
   * @param amount
   * @param quoteToken
   * @param tradeType
   * @param protocols
   * @protected
   */
  protected async _getCachedRoute(
    chainId: ChainId,
    amount: CurrencyAmount<Currency>,
    quoteToken: Token,
    tradeType: TradeType,
    protocols: Protocol[]
  ): Promise<CachedRoutes | undefined> {
    const { tokenIn, tokenOut } = this.determineTokenInOut(amount, quoteToken, tradeType)
    const cachedRoutesStrategy = this.getCachedRoutesStrategy(tokenIn, tokenOut, tradeType, chainId)
    const cachingParameters = cachedRoutesStrategy?.getCachingParameters(amount)

    if (cachingParameters) {
      const partitionKey = new PairTradeTypeChainId({
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        tradeType,
        chainId,
      })
      const partialSortKey = new ProtocolsBucketBlockNumber({
        protocols,
        bucket: cachingParameters.bucket,
      })

      const queryParams = {
        TableName: this.tableName,
        // Since we don't know what's the latest block that we have in cache, we make a query with a partial sort key
        KeyConditionExpression: '#pk = :pk and begins_with(#sk, :sk)',
        ExpressionAttributeNames: {
          '#pk': 'pairTradeTypeChainId',
          '#sk': 'protocolsBucketBlockNumber',
        },
        ExpressionAttributeValues: {
          ':pk': partitionKey.toString(),
          ':sk': partialSortKey.protocolsBucketPartialKey(),
        },
        ScanIndexForward: false, // Reverse order to retrieve most recent item first
        Limit: 1, // Only retrieve the most recent item
      }

      try {
        log.info({ queryParams }, `[DynamoRouteCachingProvider] Attempting to get route from cache.`)

        const result = await this.ddbClient.query(queryParams).promise()

        log.info({ result }, `[DynamoRouteCachingProvider] Got the following response from querying cache`)

        if (result.Items && result.Items.length > 0) {
          // If we got a response with more than 1 item, we extract the binary field from the response
          const itemBinary = result.Items[0]?.item
          // Then we convert it into a Buffer
          const cachedRoutesBuffer = Buffer.from(itemBinary)
          // We convert that buffer into string and parse as JSON (it was encoded as JSON when it was inserted into cache)
          const cachedRoutesJson = JSON.parse(cachedRoutesBuffer.toString())
          // Finally we unmarshal that JSON into a `CachedRoutes` object
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

  /**
   * Implementation of the abstract method defined in `IRouteCachingProvider`
   * Attempts to insert the `CachedRoutes` object into cache, if the CachingStrategy returns the CachingParameters
   *
   * @param cachedRoutes
   * @param amount
   * @protected
   */
  protected async _setCachedRoute(cachedRoutes: CachedRoutes, amount: CurrencyAmount<Currency>): Promise<boolean> {
    const cachedRoutesStrategy = this.getCachedRoutesStrategyFromCachedRoutes(cachedRoutes)
    const cachingParameters = cachedRoutesStrategy?.getCachingParameters(amount)

    if (cachingParameters) {
      // TTL is minutes from now. multiply ttlMinutes times 60 to convert to seconds, since ttl is in seconds.
      const ttl = Math.floor(Date.now() / 1000) + 60 * this.ttlMinutes
      // Marshal the CachedRoutes object in preparation for storing in DynamoDB
      const marshalledCachedRoutes = CachedRoutesMarshaller.marshal(cachedRoutes)
      // Convert the marshalledCachedRoutes to JSON string
      const jsonCachedRoutes = JSON.stringify(marshalledCachedRoutes)
      // Encode the jsonCachedRoutes into Binary
      const binaryCachedRoutes = Buffer.from(jsonCachedRoutes)

      // Primary Key object
      const partitionKey = PairTradeTypeChainId.fromCachedRoutes(cachedRoutes)
      const sortKey = new ProtocolsBucketBlockNumber({
        protocols: cachedRoutes.protocolsCovered,
        bucket: cachingParameters.bucket,
        blockNumber: cachedRoutes.blockNumber,
      })

      const putParams = {
        TableName: this.tableName,
        Item: {
          pairTradeTypeChainId: partitionKey.toString(),
          protocolsBucketBlockNumber: sortKey.fullKey(),
          item: binaryCachedRoutes,
          ttl: ttl,
        },
      }

      log.info(
        { putParams, cachedRoutes, jsonCachedRoutes },
        `[DynamoRouteCachingProvider] Attempting to insert route to cache`
      )

      try {
        await this.ddbClient.put(putParams).promise()
        log.info(`[DynamoRouteCachingProvider] Cached route inserted to cache`)

        return true
      } catch (error) {
        log.error({ error, putParams }, `[DynamoRouteCachingProvider] Cached route failed to insert`)

        return false
      }
    } else {
      // No CachingParameters found, return false to indicate the route was not cached.

      return false
    }
  }

  /**
   * Implementation of the abstract method defined in `IRouteCachingProvider`
   * Obtains the CacheMode from the CachingStrategy, if not found, then return Darkmode.
   *
   * @param chainId
   * @param amount
   * @param quoteToken
   * @param tradeType
   * @param _protocols
   */
  public async getCacheMode(
    chainId: ChainId,
    amount: CurrencyAmount<Currency>,
    quoteToken: Token,
    tradeType: TradeType,
    _protocols: Protocol[]
  ): Promise<CacheMode> {
    const { tokenIn, tokenOut } = this.determineTokenInOut(amount, quoteToken, tradeType)
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
          amount: amount.toExact(),
        },
        `[DynamoRouteCachingProvider] Got CachingParameters for ${amount.toExact()} in ${tokenIn.symbol}/${
          tokenOut.symbol
        }/${tradeType}/${chainId}`
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
          amount: amount.toExact(),
        },
        `[DynamoRouteCachingProvider] Didn't find CachingParameters for ${amount.toExact()} in ${tokenIn.symbol}/${
          tokenOut.symbol
        }/${tradeType}/${chainId}`
      )

      return CacheMode.Darkmode
    }
  }

  /**
   * Helper function to fetch the CachingStrategy using CachedRoutes as input
   *
   * @param cachedRoutes
   * @private
   */
  private getCachedRoutesStrategyFromCachedRoutes(cachedRoutes: CachedRoutes): CachedRoutesStrategy | undefined {
    return this.getCachedRoutesStrategy(
      cachedRoutes.tokenIn,
      cachedRoutes.tokenOut,
      cachedRoutes.tradeType,
      cachedRoutes.chainId
    )
  }

  /**
   * Helper function to obtain the Caching strategy from the CACHED_ROUTES_CONFIGURATION
   *
   * @param tokenIn
   * @param tokenOut
   * @param tradeType
   * @param chainId
   * @private
   */
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

    log.info(
      { pairTradeTypeChainId },
      `[DynamoRouteCachingProvider] Looking for cache configuration of ${pairTradeTypeChainId.toString()}`
    )

    return CACHED_ROUTES_CONFIGURATION.get(pairTradeTypeChainId.toString())
  }

  /**
   * Helper function to determine the tokenIn and tokenOut given the tradeType, quoteToken and amount.currency
   *
   * @param amount
   * @param quoteToken
   * @param tradeType
   * @private
   */
  private determineTokenInOut(
    amount: CurrencyAmount<Currency>,
    quoteToken: Token,
    tradeType: TradeType
  ): { tokenIn: Token; tokenOut: Token } {
    if (tradeType == TradeType.EXACT_INPUT) {
      return { tokenIn: amount.currency.wrapped, tokenOut: quoteToken }
    } else {
      return { tokenIn: quoteToken, tokenOut: amount.currency.wrapped }
    }
  }
}
