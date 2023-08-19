import {
  CachedRoute,
  CachedRoutes,
  CacheMode,
  IRouteCachingProvider,
  log,
  routeToString,
} from '@uniswap/smart-order-router'
import { DynamoDB } from 'aws-sdk'
import { ChainId, Currency, CurrencyAmount, Token, TradeType } from '@uniswap/sdk-core'
import { Protocol } from '@uniswap/router-sdk'
import { CACHED_ROUTES_CONFIGURATION } from './cached-routes-configuration'
import { PairTradeTypeChainId } from './model/pair-trade-type-chain-id'
import { CachedRoutesMarshaller } from '../../marshalling/cached-routes-marshaller'
import { CachedRoutesStrategy } from './model/cached-routes-strategy'
import { ProtocolsBucketBlockNumber } from './model/protocols-bucket-block-number'
import { CachedRoutesBucket } from './model'
import { MixedRoute, V2Route, V3Route } from '@uniswap/smart-order-router/build/main/routers'
import { SECONDS_PER_BLOCK_BY_CHAIN_ID } from '../../shared'

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
interface CachedRouteDbEntry {
  TableName: string
  Item: {
    pairTradeTypeChainId: string
    protocolsBucketBlockNumber: string
    item: Buffer
    ttl: number
  }
}

const DEFAULT_TTL_MINUTES = 2
export class DynamoRouteCachingProvider extends IRouteCachingProvider {
  private readonly ddbClient: DynamoDB.DocumentClient
  private readonly tableName: string
  private readonly ttlMinutes: number

  constructor({ cachedRoutesTableName, ttlMinutes = DEFAULT_TTL_MINUTES }: ConstructorParams) {
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
    const cachingParameters = cachedRoutesStrategy?.getCachingBucket(amount)

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
    protocols: Protocol[],
    _currentBlockNumber: number,
    _optimistic: boolean
  ): Promise<CachedRoutes | undefined> {
    const { tokenIn, tokenOut } = this.determineTokenInOut(amount, quoteToken, tradeType)
    const cachedRoutesStrategy = this.getCachedRoutesStrategy(tokenIn, tokenOut, tradeType, chainId)
    const cachingBucket = cachedRoutesStrategy?.getCachingBucket(amount)

    if (cachingBucket) {
      const partitionKey = new PairTradeTypeChainId({
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        tradeType,
        chainId,
      })
      const partialSortKey = new ProtocolsBucketBlockNumber({
        protocols,
        bucket: cachingBucket.bucket,
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
        Limit: Math.max(cachingBucket.withLastNCachedRoutes, 1),
      }

      try {
        log.info({ queryParams }, `[DynamoRouteCachingProvider] Attempting to get route from cache.`)

        const result = await this.ddbClient.query(queryParams).promise()

        log.info({ result }, `[DynamoRouteCachingProvider] Got the following response from querying cache`)

        if (result.Items && result.Items.length > 0) {
          const cachedRoutesArr: CachedRoutes[] = result.Items.map((record) => {
            // If we got a response with more than 1 item, we extract the binary field from the response
            const itemBinary = record.item
            // Then we convert it into a Buffer
            const cachedRoutesBuffer = Buffer.from(itemBinary)
            // We convert that buffer into string and parse as JSON (it was encoded as JSON when it was inserted into cache)
            const cachedRoutesJson = JSON.parse(cachedRoutesBuffer.toString())
            // Finally we unmarshal that JSON into a `CachedRoutes` object
            return CachedRoutesMarshaller.unmarshal(cachedRoutesJson)
          })

          const routesMap: Map<string, CachedRoute<V3Route | V2Route | MixedRoute>> = new Map()
          var blockNumber: number = 0
          var originalAmount: string = ''

          cachedRoutesArr.forEach((cachedRoutes) => {
            cachedRoutes.routes.forEach((cachedRoute) => {
              // we use the stringified route as identifier
              const routeId = routeToString(cachedRoute.route)
              // Using a map to remove duplicates, we will the different percents of different routes.
              if (!routesMap.has(routeId)) routesMap.set(routeId, cachedRoute)
            })
            // Find the latest blockNumber
            blockNumber = Math.max(blockNumber, cachedRoutes.blockNumber)
            // Keep track of all the originalAmounts
            if (originalAmount === '') {
              originalAmount = `${cachedRoutes.originalAmount} | ${routesMap.size} | ${cachedRoutes.blockNumber}`
            } else {
              originalAmount = `${originalAmount}, ${cachedRoutes.originalAmount} | ${routesMap.size} | ${cachedRoutes.blockNumber}`
            }
          })

          const first = cachedRoutesArr[0]

          // Build a new CachedRoutes object with the values calculated earlier
          const cachedRoutes = new CachedRoutes({
            routes: Array.from(routesMap.values()),
            chainId: first.chainId,
            tokenIn: first.tokenIn,
            tokenOut: first.tokenOut,
            protocolsCovered: first.protocolsCovered,
            blockNumber,
            tradeType: first.tradeType,
            originalAmount,
            blocksToLive: first.blocksToLive,
          })

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
   * Helper function to generate the [CachedRouteDbEntry] object to be stored in the Cached Routes DynamoDB.
   *
   * @param cachedRoutes
   * @param amount
   * @public
   */
  public generateCachedRouteDbEntry(
    cachedRoutes: CachedRoutes,
    amount: CurrencyAmount<Currency>
  ): CachedRouteDbEntry | null {
    const cachedRoutesStrategy = this.getCachedRoutesStrategyFromCachedRoutes(cachedRoutes)
    const cachingBucket = cachedRoutesStrategy?.getCachingBucket(amount)
    const chainId = cachedRoutes.chainId
    const blocksToLive = cachedRoutes.blocksToLive
    const secondsToLivePerBlock = SECONDS_PER_BLOCK_BY_CHAIN_ID[chainId]
    const cachedRoutesTtl =
      blocksToLive > 0 && typeof secondsToLivePerBlock === 'number' ? secondsToLivePerBlock * blocksToLive : 0

    if (cachingBucket && this.isAllowedInCache(cachingBucket, cachedRoutes)) {
      // TTL is minutes from now. multiply ttlMinutes times 60 to convert to seconds, since ttl is in seconds.
      const ttl = Math.floor(Date.now() / 1000) + Math.max(cachedRoutesTtl, this.ttlMinutes * 60)
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
        bucket: cachingBucket.bucket,
        blockNumber: cachedRoutes.blockNumber,
      })

      return {
        TableName: this.tableName,
        Item: {
          pairTradeTypeChainId: partitionKey.toString(),
          protocolsBucketBlockNumber: sortKey.fullKey(),
          item: binaryCachedRoutes,
          ttl: ttl,
        },
      }
    } else {
      return null
    }
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
    const cachedRouteDbEntry = this.generateCachedRouteDbEntry(cachedRoutes, amount)

    if (cachedRouteDbEntry) {
      const putParams = cachedRouteDbEntry

      log.info({ putParams, cachedRoutes }, `[DynamoRouteCachingProvider] Attempting to insert route to cache`)

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
    const cachingParameters = cachedRoutesStrategy?.getCachingBucket(amount)

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

    let withWildcard: PairTradeTypeChainId
    if (tradeType === TradeType.EXACT_INPUT) {
      withWildcard = new PairTradeTypeChainId({
        tokenIn: tokenIn.address,
        tokenOut: '*',
        tradeType: TradeType.EXACT_INPUT,
        chainId: chainId,
      })
    } else {
      withWildcard = new PairTradeTypeChainId({
        tokenIn: '*',
        tokenOut: tokenOut.address,
        tradeType: TradeType.EXACT_OUTPUT,
        chainId: chainId,
      })
    }

    log.info(
      { pairTradeTypeChainId },
      `[DynamoRouteCachingProvider] Looking for cache configuration of ${pairTradeTypeChainId.toString()}
      or ${withWildcard.toString()}`
    )

    return (
      CACHED_ROUTES_CONFIGURATION.get(pairTradeTypeChainId.toString()) ??
      CACHED_ROUTES_CONFIGURATION.get(withWildcard.toString())
    )
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

  /**
   * Helper function that based on the CachingBucket can determine if the route is allowed in cache.
   * There are 2 conditions, currently:
   * 1. `cachingBucket.maxSplits <= 0` indicate that any number of maxSplits is allowed
   * 2. `cachedRoutes.routes.length <= maxSplits` to test that there are fewer splits than allowed
   *
   * @param cachingBucket
   * @param cachedRoutes
   * @private
   */
  private isAllowedInCache(cachingBucket: CachedRoutesBucket, cachedRoutes: CachedRoutes): boolean {
    return cachingBucket.maxSplits <= 0 || cachedRoutes.routes.length <= cachingBucket.maxSplits
  }
}
