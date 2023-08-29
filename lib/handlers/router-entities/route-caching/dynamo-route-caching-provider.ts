import {
  CachedRoute,
  CachedRoutes,
  CacheMode,
  ID_TO_NETWORK_NAME,
  IRouteCachingProvider,
  log,
  metric,
  MetricLoggerUnit,
  routeToString,
} from '@uniswap/smart-order-router'
import { AWSError, DynamoDB, Lambda } from 'aws-sdk'
import { ChainId, Currency, CurrencyAmount, Fraction, Token, TradeType } from '@uniswap/sdk-core'
import { Protocol } from '@uniswap/router-sdk'
import { CACHED_ROUTES_CONFIGURATION } from './cached-routes-configuration'
import { PairTradeTypeChainId } from './model/pair-trade-type-chain-id'
import { CachedRoutesMarshaller } from '../../marshalling/cached-routes-marshaller'
import { CachedRoutesStrategy } from './model/cached-routes-strategy'
import { ProtocolsBucketBlockNumber } from './model/protocols-bucket-block-number'
import { CachedRoutesBucket } from './model'
import { MixedRoute, V2Route, V3Route } from '@uniswap/smart-order-router/build/main/routers'
import { SECONDS_PER_BLOCK_BY_CHAIN_ID } from '../../shared'
import { PromiseResult } from 'aws-sdk/lib/request'

interface ConstructorParams {
  /**
   * The TableName for the DynamoDB Table that stores routes
   */
  routesTableName: string
  /**
   * The TableName for the DynamoDB Table that stores whether a request has been sent for caching related to routesDb
   */
  routesCachingRequestFlagTableName: string
  /**
   * The TableName for the DynamoDB Table that stores cached routes.
   */
  cachedRoutesTableName: string
  /**
   * The Lambda Function Name for the Lambda that will be invoked to fill the cache
   */
  cachingQuoteLambdaName: string
  /**
   * The TableName for the DynamoDB Table that stores whether a request has been sent for caching related to cachedRoutes
   */
  cachingRequestFlagTableName: string
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

enum CachedRoutesSource {
  CachedRoutes = 'CachedRoutes',
  RoutesDb = 'RoutesDb',
}

const DEFAULT_TTL_MINUTES = 2
export class DynamoRouteCachingProvider extends IRouteCachingProvider {
  private readonly ddbClient: DynamoDB.DocumentClient
  private readonly lambdaClient: Lambda
  private readonly routesTableName: string
  private readonly routesCachingRequestFlagTableName: string
  private readonly cachingRoutesTableName: string
  private readonly cachingQuoteLambdaName: string
  private readonly cachingRequestFlagTableName: string
  private readonly ttlMinutes: number

  private readonly ROUTES_DB_TTL = 24 * 60 * 60 // 24 hours
  private readonly ROUTES_DB_FLAG_TTL = 2 * 60 // 2 minutes
  private readonly DEFAULT_BLOCKS_TO_LIVE_ROUTES_DB = 2
  private readonly DEFAULT_CACHEMODE_ROUTES_DB = CacheMode.Tapcompare
  // For the Ratio we are approximating Phi (Golden Ratio) by creating a fraction with 2 consecutive Fibonacci numbers
  private readonly ROUTES_DB_BUCKET_RATIO: Fraction = new Fraction(514229, 317811)
  private readonly ROUTES_TO_TAKE_FROM_ROUTES_DB = 5

  constructor({
    routesTableName,
    routesCachingRequestFlagTableName,
    cachedRoutesTableName,
    cachingQuoteLambdaName,
    cachingRequestFlagTableName,
    ttlMinutes = DEFAULT_TTL_MINUTES,
  }: ConstructorParams) {
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
    this.lambdaClient = new Lambda()
    this.routesTableName = routesTableName
    this.routesCachingRequestFlagTableName = routesCachingRequestFlagTableName
    this.cachingRoutesTableName = cachedRoutesTableName
    this.cachingQuoteLambdaName = cachingQuoteLambdaName
    this.cachingRequestFlagTableName = cachingRequestFlagTableName
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
      return this.DEFAULT_BLOCKS_TO_LIVE_ROUTES_DB
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
    currentBlockNumber: number,
    optimistic: boolean
  ): Promise<CachedRoutes | undefined> {
    const { tokenIn, tokenOut } = this.determineTokenInOut(amount, quoteToken, tradeType)

    const partitionKey = new PairTradeTypeChainId({
      tokenIn: tokenIn.address,
      tokenOut: tokenOut.address,
      tradeType,
      chainId,
    })

    const cachedRoutesPromise = this.getCachedRoutesFromCachedRoutesDb(
      tokenIn,
      tokenOut,
      chainId,
      amount,
      tradeType,
      protocols,
      currentBlockNumber,
      optimistic,
      partitionKey
    )

    const routesDbPromise = this.getRoutesFromRoutesDb(partitionKey, chainId, amount, currentBlockNumber, optimistic)

    const [cachedRoutes, routesDb] = await Promise.all([cachedRoutesPromise, routesDbPromise])

    return cachedRoutes || routesDb
  }

  private async getCachedRoutesFromCachedRoutesDb(
    tokenIn: Token,
    tokenOut: Token,
    chainId: ChainId,
    amount: CurrencyAmount<Currency>,
    tradeType: TradeType,
    protocols: Protocol[],
    currentBlockNumber: number,
    optimistic: boolean,
    partitionKey: PairTradeTypeChainId
  ): Promise<CachedRoutes | undefined> {
    const cachedRoutesStrategy = this.getCachedRoutesStrategy(tokenIn, tokenOut, tradeType, chainId)
    const cachingBucket = cachedRoutesStrategy?.getCachingBucket(amount)

    if (cachingBucket) {
      const sortKey = new ProtocolsBucketBlockNumber({
        protocols,
        bucket: cachingBucket.bucket,
        blockNumber: currentBlockNumber,
      })

      try {
        const queryParams = {
          TableName: this.cachingRoutesTableName,
          // Since we don't know what's the latest block that we have in cache, we make a query with a partial sort key
          KeyConditionExpression: '#pk = :pk and begins_with(#sk, :sk)',
          ExpressionAttributeNames: {
            '#pk': 'pairTradeTypeChainId',
            '#sk': 'protocolsBucketBlockNumber',
          },
          ExpressionAttributeValues: {
            ':pk': partitionKey.toString(),
            ':sk': sortKey.protocolsBucketPartialKey(),
          },
          ScanIndexForward: false, // Reverse order to retrieve most recent item first
          Limit: Math.max(cachingBucket.withLastNCachedRoutes, 1),
        }

        const result = await this.ddbClient.query(queryParams).promise()

        if (result.Items && result.Items.length > 0) {
          return this.parseCachedRoutes(
            result,
            chainId,
            currentBlockNumber,
            optimistic,
            partitionKey,
            amount,
            CachedRoutesSource.CachedRoutes,
            sortKey
          )
        } else {
          metric.putMetric('CachedRoutesEntriesNotFound', 1, MetricLoggerUnit.Count)
          log.warn(`[DynamoRouteCachingProvider] No items found in the query response for ${partitionKey.toString()}`)
        }
      } catch (error) {
        metric.putMetric('CachedRoutesFetchError', 1, MetricLoggerUnit.Count)
        log.error(
          { partitionKey, sortKey, error },
          `[DynamoRouteCachingProvider] Error while fetching route from cache`
        )
      }
    }

    return undefined
  }

  private async getRoutesFromRoutesDb(
    partitionKey: PairTradeTypeChainId,
    chainId: ChainId,
    amount: CurrencyAmount<Currency>,
    currentBlockNumber: number,
    optimistic: boolean
  ): Promise<CachedRoutes | undefined> {
    // If no cachedRoutes were found, we try to fetch from the RoutesDb
    metric.putMetric('RoutesDbQuery', 1, MetricLoggerUnit.Count)

    try {
      const queryParams = {
        TableName: this.routesTableName,
        KeyConditionExpression: '#pk = :pk',
        ExpressionAttributeNames: {
          '#pk': 'pairTradeTypeChainId',
        },
        ExpressionAttributeValues: {
          ':pk': partitionKey.toString(),
        },
      }

      const result = await this.ddbClient.query(queryParams).promise()
      if (result.Items && result.Items.length > 0) {
        metric.putMetric('RoutesDbPreFilterEntriesFound', result.Items.length, MetricLoggerUnit.Count)
        // At this point we might have gotten all the routes we have discovered in the last 24 hours for this pair
        // We will sort the routes by blockNumber, and take the first `ROUTES_TO_TAKE_FROM_ROUTES_DB` routes
        const filteredItems = result.Items.sort((a, b) => b.blockNumber - a.blockNumber).slice(
          0,
          this.ROUTES_TO_TAKE_FROM_ROUTES_DB
        )

        result.Items = filteredItems

        return this.parseCachedRoutes(
          result,
          chainId,
          currentBlockNumber,
          optimistic,
          partitionKey,
          amount,
          CachedRoutesSource.RoutesDb
        )
      } else {
        metric.putMetric('RoutesDbEntriesNotFound', 1, MetricLoggerUnit.Count)
        log.warn(`[DynamoRouteCachingProvider] No items found in the query response for ${partitionKey.toString()}`)
      }
    } catch (error) {
      metric.putMetric('RoutesDbFetchError', 1, MetricLoggerUnit.Count)
      log.error({ partitionKey, error }, `[DynamoRouteCachingProvider] Error while fetching route from RouteDb`)
    }

    return undefined
  }

  private parseCachedRoutes(
    result: PromiseResult<DynamoDB.DocumentClient.QueryOutput, AWSError>,
    chainId: ChainId,
    currentBlockNumber: number,
    optimistic: boolean,
    partitionKey: PairTradeTypeChainId,
    amount: CurrencyAmount<Currency>,
    cachedRoutesSource: CachedRoutesSource,
    sortKey?: ProtocolsBucketBlockNumber
  ): CachedRoutes {
    metric.putMetric(`${cachedRoutesSource}EntriesFound`, result.Items!.length, MetricLoggerUnit.Count)
    const cachedRoutesArr: CachedRoutes[] = result.Items!.map((record) => {
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
    let blockNumber: number = 0
    let originalAmount: string = ''

    cachedRoutesArr.forEach((cachedRoutes) => {
      metric.putMetric(`${cachedRoutesSource}PerBlockFound`, cachedRoutes.routes.length, MetricLoggerUnit.Count)
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

    metric.putMetric(`Unique${cachedRoutesSource}Found`, cachedRoutes.routes.length, MetricLoggerUnit.Count)

    log.info({ cachedRoutes }, `[DynamoRouteCachingProvider] Returning the cached and unmarshalled route.`)

    const blocksDifference = currentBlockNumber - blockNumber
    metric.putMetric(`${cachedRoutesSource}BlockDifference`, blocksDifference, MetricLoggerUnit.Count)
    metric.putMetric(
      `${cachedRoutesSource}BlockDifference_${ID_TO_NETWORK_NAME(chainId)}`,
      blocksDifference,
      MetricLoggerUnit.Count
    )

    const notExpiredCachedRoute = cachedRoutes.notExpired(currentBlockNumber, optimistic)
    if (notExpiredCachedRoute) {
      metric.putMetric(`${cachedRoutesSource}NotExpired`, 1, MetricLoggerUnit.Count)
    } else {
      metric.putMetric(`${cachedRoutesSource}Expired`, 1, MetricLoggerUnit.Count)
    }

    if (
      optimistic && // If we are in optimistic mode
      notExpiredCachedRoute // and the cachedRoutes are not expired (if they are expired, the regular request will insert cache)
    ) {
      if (cachedRoutesSource === CachedRoutesSource.CachedRoutes) {
        // We send an async caching quote
        // we do not await on this function, it's a fire and forget
        this.maybeSendCachingQuoteForCachedRoutes(partitionKey, sortKey!, amount)
      } else if (cachedRoutesSource === CachedRoutesSource.RoutesDb) {
        // We send an async caching quote
        // we do not await on this function, it's a fire and forget
        this.maybeSendCachingQuoteForRoutesDb(partitionKey, amount)
      }
    }

    return cachedRoutes
  }

  private async maybeSendCachingQuoteForCachedRoutes(
    partitionKey: PairTradeTypeChainId,
    sortKey: ProtocolsBucketBlockNumber,
    amount: CurrencyAmount<Currency>
  ): Promise<void> {
    const getParams = {
      TableName: this.cachingRequestFlagTableName,
      Key: {
        pairTradeTypeChainId: partitionKey.toString(),
        protocolsBucketBlockNumber: sortKey.fullKey(),
      },
    }

    metric.putMetric('OptimisticCachedRoute', 1, MetricLoggerUnit.Count)

    try {
      const result = await this.ddbClient.get(getParams).promise()
      // if no Item is found it means we need to send a caching request
      if (!result.Item) {
        metric.putMetric('UniqueOptimisticCachedRoute', 1, MetricLoggerUnit.Count)
        this.sendAsyncCachingRequest(partitionKey, sortKey.protocols, amount)
        this.setCachedRoutesCachingIntentFlag(partitionKey, sortKey)
      }
    } catch (e) {
      log.error(`[DynamoRouteCachingProvider] Error checking if caching request was sent: ${e}.`)
    }
  }

  private async maybeSendCachingQuoteForRoutesDb(
    partitionKey: PairTradeTypeChainId,
    amount: CurrencyAmount<Currency>
  ): Promise<void> {
    try {
      const queryParams = {
        TableName: this.routesCachingRequestFlagTableName,
        // We use a ratio to get a range of amounts that are close to the amount we are thinking about inserting
        // If there's an item in the table which range covers our amount, we don't need to send a caching request
        KeyConditionExpression: '#pk = :pk AND #amount BETWEEN :amount AND :amount_ratio',
        ExpressionAttributeNames: {
          '#pk': 'pairTradeTypeChainId',
          '#amount': 'amount',
        },
        ExpressionAttributeValues: {
          ':pk': partitionKey.toString(),
          ':amount': parseFloat(amount.toExact()),
          ':amount_ratio': parseFloat(amount.multiply(this.ROUTES_DB_BUCKET_RATIO).toExact()),
        },
      }

      metric.putMetric('CachingQuoteForRoutesDbCheck', 1, MetricLoggerUnit.Count)

      const result = await this.ddbClient.query(queryParams).promise()

      // if no Item is found it means we need to send a caching request
      if (result.Items && result.Items.length == 0) {
        metric.putMetric('CachingQuoteForRoutesDbRequestSent', 1, MetricLoggerUnit.Count)
        this.sendAsyncCachingRequest(partitionKey, [Protocol.V2, Protocol.V3, Protocol.MIXED], amount)
        this.setRoutesDbCachingIntentFlag(partitionKey, amount)
      } else {
        metric.putMetric('CachingQuoteForRoutesDbRequestNotNeeded', 1, MetricLoggerUnit.Count)
      }
    } catch (e) {
      log.error(`[DynamoRouteCachingProvider] Error checking if caching request for RoutesDb was sent: ${e}.`)
    }
  }

  private sendAsyncCachingRequest(
    partitionKey: PairTradeTypeChainId,
    protocols: Protocol[],
    amount: CurrencyAmount<Currency>
  ): void {
    const payload = {
      queryStringParameters: {
        tokenInAddress: partitionKey.tokenIn,
        tokenInChainId: partitionKey.chainId.toString(),
        tokenOutAddress: partitionKey.tokenOut,
        tokenOutChainId: partitionKey.chainId.toString(),
        amount: amount.quotient.toString(),
        type: partitionKey.tradeType === 0 ? 'exactIn' : 'exactOut',
        protocols: protocols.map((protocol) => protocol.toLowerCase()).join(','),
        intent: 'caching',
      },
    }

    const params = {
      FunctionName: this.cachingQuoteLambdaName,
      InvocationType: 'Event',
      Payload: JSON.stringify(payload),
    }

    log.info(`[DynamoRouteCachingProvider] Sending async caching request to lambda ${JSON.stringify(params)}`)

    this.lambdaClient.invoke(params).promise()
  }

  private setCachedRoutesCachingIntentFlag(
    partitionKey: PairTradeTypeChainId,
    sortKey: ProtocolsBucketBlockNumber
  ): void {
    const putParams = {
      TableName: this.cachingRequestFlagTableName,
      Item: {
        pairTradeTypeChainId: partitionKey.toString(),
        protocolsBucketBlockNumber: sortKey.fullKey(),
        ttl: Math.floor(Date.now() / 1000) + this.ttlMinutes * 60,
        caching: true,
      },
    }

    this.ddbClient.put(putParams).promise()
  }

  private setRoutesDbCachingIntentFlag(partitionKey: PairTradeTypeChainId, amount: CurrencyAmount<Currency>): void {
    const putParams = {
      TableName: this.routesCachingRequestFlagTableName,
      Item: {
        pairTradeTypeChainId: partitionKey.toString(),
        amount: parseFloat(amount.toExact()),
        ttl: Math.floor(Date.now() / 1000) + this.ROUTES_DB_FLAG_TTL,
        caching: true,
      },
    }

    this.ddbClient.put(putParams).promise()
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
        TableName: this.cachingRoutesTableName,
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
    const [cachedRoutesInsert, routesDbInsert] = await Promise.all([
      this.insertCachedRouteDBEntry(cachedRoutes, amount),
      this.insertRoutesDbEntry(cachedRoutes),
    ])

    return cachedRoutesInsert && routesDbInsert
  }

  private async insertCachedRouteDBEntry(
    cachedRoutes: CachedRoutes,
    amount: CurrencyAmount<Currency>
  ): Promise<boolean> {
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

  private async insertRoutesDbEntry(cachedRoutes: CachedRoutes): Promise<boolean> {
    const routesDbEntries = cachedRoutes.routes.map((route) => {
      const individualCachedRoutes = new CachedRoutes({
        routes: [route],
        chainId: cachedRoutes.chainId,
        tokenIn: cachedRoutes.tokenIn,
        tokenOut: cachedRoutes.tokenOut,
        protocolsCovered: cachedRoutes.protocolsCovered,
        blockNumber: cachedRoutes.blockNumber,
        tradeType: cachedRoutes.tradeType,
        originalAmount: cachedRoutes.originalAmount,
      })
      const ttl = Math.floor(Date.now() / 1000) + this.ROUTES_DB_TTL
      // Marshal the CachedRoutes object in preparation for storing in DynamoDB
      const marshalledCachedRoutes = CachedRoutesMarshaller.marshal(individualCachedRoutes)
      // Convert the marshalledCachedRoutes to JSON string
      const jsonCachedRoutes = JSON.stringify(marshalledCachedRoutes)
      // Encode the jsonCachedRoutes into Binary
      const binaryCachedRoutes = Buffer.from(jsonCachedRoutes)

      const partitionKey = PairTradeTypeChainId.fromCachedRoutes(cachedRoutes)

      return {
        PutRequest: {
          Item: {
            pairTradeTypeChainId: partitionKey.toString(),
            routeId: route.routeId,
            blockNumber: cachedRoutes.blockNumber,
            item: binaryCachedRoutes,
            ttl: ttl,
          },
        },
      }
    })

    if (routesDbEntries.length > 0) {
      try {
        const batchWriteParams = {
          RequestItems: {
            [this.routesTableName]: routesDbEntries,
          },
        }
        await this.ddbClient.batchWrite(batchWriteParams).promise()
        log.info(`[DynamoRouteCachingProvider] Route Entries inserted to database`)

        return true
      } catch (error) {
        log.error({ error, routesDbEntries }, `[DynamoRouteCachingProvider] Route Entries failed to insert`)

        return false
      }
    } else {
      log.warn(`[DynamoRouteCachingProvider] No Route Entries to insert`)
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

      return this.DEFAULT_CACHEMODE_ROUTES_DB
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
