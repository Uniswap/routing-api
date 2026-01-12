import {
  AlphaRouterConfig,
  CachedRoute,
  CachedRoutes,
  CacheMode,
  ID_TO_NETWORK_NAME,
  INTENT,
  IRouteCachingProvider,
  log,
  metric,
  MetricLoggerUnit,
  routeToString,
  SupportedRoutes,
} from '@uniswap/smart-order-router'
import { AWSError, DynamoDB, Lambda } from 'aws-sdk'
import { ChainId, Currency, CurrencyAmount, Fraction, Token, TradeType } from '@uniswap/sdk-core'
import { Protocol } from '@uniswap/router-sdk'
import { SwapOptions } from '@uniswap/smart-order-router'
import { PairTradeTypeChainId } from './model/pair-trade-type-chain-id'
import { CachedRoutesMarshaller } from '../../marshalling/cached-routes-marshaller'
import { PromiseResult } from 'aws-sdk/lib/request'
import { DEFAULT_BLOCKS_TO_LIVE_ROUTES_DB } from '../../../util/defaultBlocksToLiveRoutesDB'
import { getSymbolOrAddress } from '../../../util/getSymbolOrAddress'
import { serializeRouteIds } from '@uniswap/smart-order-router/build/main/util/serializeRouteIds'
import { UniversalRouterVersion } from '@uniswap/universal-router-sdk'
import { computeProtocolsInvolvedIfMixed } from '../../../util/computeProtocolsInvolvedIfMixed'

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
   * The Lambda Function Name for the Lambda that will be invoked to fill the cache
   */
  cachingQuoteLambdaName?: string
}

export class DynamoRouteCachingProvider extends IRouteCachingProvider {
  private readonly ddbClient: DynamoDB.DocumentClient
  private readonly lambdaClient: Lambda
  private readonly routesTableName: string
  private readonly routesCachingRequestFlagTableName: string
  private readonly cachingQuoteLambdaName?: string

  private readonly DEFAULT_CACHEMODE_ROUTES_DB = CacheMode.Livemode
  private readonly ROUTES_DB_TTL = 24 * 60 * 60 // 24 hours
  private readonly ROUTES_DB_FLAG_TTL = 2 * 60 // 2 minutes

  private readonly ROUTES_DB_BUCKET_RATIO: Fraction = new Fraction(514229, 317811)
  private readonly ROUTES_TO_TAKE_FROM_ROUTES_DB = 8
  private readonly BLOCKS_DIFF_BETWEEN_CACHING_QUOTES: Map<ChainId, number> = new Map([[ChainId.MAINNET, 3]])

  private readonly DEFAULT_BLOCKS_DIFF_CACHING = 15

  constructor({ routesTableName, routesCachingRequestFlagTableName, cachingQuoteLambdaName }: ConstructorParams) {
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
    this.cachingQuoteLambdaName = cachingQuoteLambdaName
  }

  /**
   * Implementation of the abstract method defined in `IRouteCachingProvider`
   * Given a CachedRoutesStrategy (from CACHED_ROUTES_CONFIGURATION),
   * we will find the BlocksToLive associated to the bucket.
   *
   * @param cachedRoutes
   * @param _
   * @protected
   */
  protected async _getBlocksToLive(cachedRoutes: CachedRoutes, _: CurrencyAmount<Currency>): Promise<number> {
    return DEFAULT_BLOCKS_TO_LIVE_ROUTES_DB[cachedRoutes.chainId]
  }

  /**
   * Implementation of the abstract method defined in `IRouteCachingProvider`
   * Fetch the most recent entry from the DynamoDB table for that pair, tradeType, chainId, protocols and bucket
   *
   * @param chainId
   * @param amount
   * @param quoteCurrency
   * @param tradeType
   * @param protocols
   * @param currentBlockNumber
   * @param optimistic
   * @param alphaRouterConfig
   * @param swapOptions
   * @protected
   */
  protected override async _getCachedRoute(
    chainId: ChainId,
    amount: CurrencyAmount<Currency>,
    quoteCurrency: Currency,
    tradeType: TradeType,
    protocols: Protocol[],
    currentBlockNumber: number,
    optimistic: boolean,
    alphaRouterConfig?: AlphaRouterConfig,
    swapOptions?: SwapOptions
  ): Promise<CachedRoutes | undefined> {
    const { currencyIn, currencyOut } = this.determineCurrencyInOut(amount, quoteCurrency, tradeType)

    // for getting the cached routes, we dont know if the cached route will contains a v4 pool or not, so we try to see if the input protocols contain v4
    const includesV4Pool = protocols.includes(Protocol.V4)

    const partitionKey = new PairTradeTypeChainId({
      currencyIn: PairTradeTypeChainId.deriveCurrencyAddress(includesV4Pool, currencyIn),
      currencyOut: PairTradeTypeChainId.deriveCurrencyAddress(includesV4Pool, currencyOut),
      tradeType,
      chainId,
    })

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
        const filteredItems = result.Items
          // Older routes might not have the protocol field, so we keep them if they don't have it
          .filter((record) => !record.protocol || protocols.includes(record.protocol))
          // Older routes might not have the protocolsInvolved field, so we keep them if they don't have it
          .filter((record) => {
            return (
              !record.protocolsInvolved ||
              !protocols.includes(Protocol.MIXED) ||
              // if UR header is v2.0, then it does not make sense to have mixed route filter by protocols
              // only when UR header is v1.2, we explicitly delete the V4 from protocols in
              // https://github.com/Uniswap/smart-order-router/blob/main/src/routers/alpha-router/alpha-router.ts#L1461
              alphaRouterConfig?.universalRouterVersion === UniversalRouterVersion.V2_0 ||
              // We want to roll out the mixed route with UR v1_2 with percent control,
              // along with the cached routes so that we can test the performance of the mixed route with UR v1_2ss
              (alphaRouterConfig?.enableMixedRouteWithUR1_2 &&
                // requested protocols do not involve MIXED, so there is no need to filter by protocolsInvolved
                // we know MIXED is getting requested, in this case, we need to ensure that protocolsInvolved contains all the requested protocols
                (record.protocolsInvolved as String)
                  .split(',')
                  .every((protocol) => protocols.includes(protocol as Protocol)))
            )
          })
          .sort((a, b) => b.blockNumber - a.blockNumber)
          .slice(0, this.ROUTES_TO_TAKE_FROM_ROUTES_DB)

        if (protocols.includes(Protocol.MIXED)) {
          filteredItems.forEach((record) => {
            if (
              record.protocolsInvolved &&
              !(record.protocolsInvolved as String)
                .split(',')
                .every((protocol) => protocols.includes(protocol as Protocol))
            ) {
              metric.putMetric(
                'RoutesDbFilteredEntriesMixedRoutesContainNonMatchingProtocols',
                1,
                MetricLoggerUnit.Count
              )
              log.error(`Cached Route entry ${JSON.stringify(record)} contains non matching protocols ${protocols}`)
            }
          })
        }

        result.Items = filteredItems

        return this.parseCachedRoutes(
          result,
          chainId,
          currentBlockNumber,
          optimistic,
          partitionKey,
          amount,
          protocols,
          alphaRouterConfig,
          swapOptions
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
    protocols: Protocol[],
    alphaRouterConfig?: AlphaRouterConfig,
    swapOptions?: SwapOptions
  ): CachedRoutes {
    metric.putMetric(`RoutesDbEntriesFound`, result.Items!.length, MetricLoggerUnit.Count)
    const cachedRoutesArr: CachedRoutes[] = result.Items!.map((record) => {
      if (record.plainRoutes && record.plainRoutes?.toString().trim() !== '') {
        metric.putMetric(`RoutesDbEntryPlainTextRouteFound`, 1, MetricLoggerUnit.Count)

        const cachedRoutesJson = JSON.parse(record.plainRoutes)
        return CachedRoutesMarshaller.unmarshal(cachedRoutesJson)
      } else {
        // Once this metric drops to zero, then we can stop writing binaryCachedRoutes into the item column
        metric.putMetric(`RoutesDbEntrySerializedRouteFound`, 1, MetricLoggerUnit.Count)

        // If we got a response with more than 1 item, we extract the binary field from the response
        const itemBinary = record.item
        // Then we convert it into a Buffer
        const cachedRoutesBuffer = Buffer.from(itemBinary)
        // We convert that buffer into string and parse as JSON (it was encoded as JSON when it was inserted into cache)
        const cachedRoutesJson = JSON.parse(cachedRoutesBuffer.toString())
        // Finally we unmarshal that JSON into a `CachedRoutes` object
        return CachedRoutesMarshaller.unmarshal(cachedRoutesJson)
      }
    })

    const routesMap: Map<string, CachedRoute<SupportedRoutes>> = new Map()
    let blockNumber: number = 0
    let originalAmount: string = ''

    // Log metrics how often we might be using expired cached routes when we shouldn't.
    // Plan to fix this by filtering below, but for now we want to know how often this happens and where.
    const numberOfExpiredCachedRoutes = cachedRoutesArr.filter(
      (cachedRoutes) => !cachedRoutes.notExpired(currentBlockNumber, optimistic)
    ).length
    const numberOfNotExpiredCachedRoutes = cachedRoutesArr.length - numberOfExpiredCachedRoutes
    if (numberOfExpiredCachedRoutes > 0 && numberOfNotExpiredCachedRoutes > 0) {
      metric.putMetric(`RoutesDbArrayWithMixedExpiredCachedRoutes_Opt_${optimistic}`, 1, MetricLoggerUnit.Count)
      metric.putMetric(
        `RoutesDbArrayWithMixedExpiredCachedRoutes_${ID_TO_NETWORK_NAME(chainId)}_Opt_${optimistic}`,
        1,
        MetricLoggerUnit.Count
      )
      // log number of expired cached routes
      metric.putMetric(
        `RoutesDbArrayWithMixedExpiredCachedRoutesCount_Opt_${optimistic}`,
        numberOfExpiredCachedRoutes,
        MetricLoggerUnit.Count
      )
      metric.putMetric(
        `RoutesDbArrayWithMixedExpiredCachedRoutesCount_${ID_TO_NETWORK_NAME(chainId)}_Opt_${optimistic}`,
        numberOfExpiredCachedRoutes,
        MetricLoggerUnit.Count
      )
      // and total
      metric.putMetric(
        `RoutesDbArrayWithMixedExpiredCachedRoutesTotal_Opt_${optimistic}`,
        cachedRoutesArr.length,
        MetricLoggerUnit.Count
      )
      metric.putMetric(
        `RoutesDbArrayWithMixedExpiredCachedRoutesTotal_${ID_TO_NETWORK_NAME(chainId)}_Opt_${optimistic}`,
        cachedRoutesArr.length,
        MetricLoggerUnit.Count
      )
    } else {
      metric.putMetric(`RoutesDbArrayWithoutMixedExpiredCachedRoutes_Opt_${optimistic}`, 1, MetricLoggerUnit.Count)
      metric.putMetric(
        `RoutesDbArrayWithoutMixedExpiredCachedRoutes_${ID_TO_NETWORK_NAME(chainId)}_Opt_${optimistic}`,
        1,
        MetricLoggerUnit.Count
      )
    }

    cachedRoutesArr.forEach((cachedRoutes) => {
      metric.putMetric(`RoutesDbPerBlockFound`, cachedRoutes.routes.length, MetricLoggerUnit.Count)
      cachedRoutes.routes.forEach((cachedRoute) => {
        // we use the stringified route as identifier
        const routeId = routeToString(cachedRoute.route)
        // Using a map to remove duplicates, we will the different percents of different routes.
        // We also filter by protocol, in case we are loading a route from a protocol that wasn't requested
        if (!routesMap.has(routeId) && protocols.includes(cachedRoute.protocol)) {
          routesMap.set(routeId, cachedRoute)
        }
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
      currencyIn: first.currencyIn,
      currencyOut: first.currencyOut,
      protocolsCovered: first.protocolsCovered,
      blockNumber,
      tradeType: first.tradeType,
      originalAmount,
      blocksToLive: first.blocksToLive,
    })

    metric.putMetric(`UniqueRoutesDbFound`, cachedRoutes.routes.length, MetricLoggerUnit.Count)

    log.info({ cachedRoutes }, `[DynamoRouteCachingProvider] Returning the cached and unmarshalled route.`)

    // Normalize blocks difference, if the route is from a new block (which could happen in L2s), consider it same block
    const blocksDifference = Math.max(0, currentBlockNumber - blockNumber)
    metric.putMetric(`RoutesDbBlockDifference`, blocksDifference, MetricLoggerUnit.Count)
    metric.putMetric(`RoutesDbBlockDifference_${ID_TO_NETWORK_NAME(chainId)}`, blocksDifference, MetricLoggerUnit.Count)

    const notExpiredCachedRoute = cachedRoutes.notExpired(currentBlockNumber, optimistic)
    if (notExpiredCachedRoute) {
      metric.putMetric(`RoutesDbNotExpired`, 1, MetricLoggerUnit.Count)
    } else {
      metric.putMetric(`RoutesDbExpired`, 1, MetricLoggerUnit.Count)
    }

    // Caching requests are not `optimistic`, we need to be careful of not removing this flag
    // This condition is protecting us against firing another caching request from inside a caching request
    if (optimistic) {
      // We send an async caching quote
      // we do not await on this function, it's a fire and forget
      this.maybeSendCachingQuoteForRoutesDb(
        partitionKey,
        amount,
        currentBlockNumber,
        cachedRoutes.routes.map((route) => route.routeId),
        alphaRouterConfig,
        swapOptions
      )
    }

    return cachedRoutes
  }

  private async maybeSendCachingQuoteForRoutesDb(
    partitionKey: PairTradeTypeChainId,
    amount: CurrencyAmount<Currency>,
    currentBlockNumber: number,
    cachedRoutesRouteIds: number[],
    alphaRouterConfig?: AlphaRouterConfig,
    swapOptions?: SwapOptions
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
      const shouldSendCachingRequest =
        result.Items &&
        (result.Items.length == 0 || // no caching request has been sent recently
          // or every sampled record is older than maximum blocks diff allowed for the chain
          result.Items.every((record) => {
            const blocksDiff = currentBlockNumber - (record.blockNumber ?? 0)
            const maximumBlocksDiff =
              this.BLOCKS_DIFF_BETWEEN_CACHING_QUOTES.get(partitionKey.chainId) || this.DEFAULT_BLOCKS_DIFF_CACHING
            return blocksDiff > maximumBlocksDiff
          }))

      // if no Item is found it means we need to send a caching request
      if (shouldSendCachingRequest) {
        metric.putMetric('CachingQuoteForRoutesDbRequestSent', 1, MetricLoggerUnit.Count)
        this.sendAsyncCachingRequest(
          partitionKey,
          [Protocol.V2, Protocol.V3, Protocol.V4, Protocol.MIXED],
          amount,
          cachedRoutesRouteIds,
          alphaRouterConfig,
          swapOptions
        )
        this.setRoutesDbCachingIntentFlag(partitionKey, amount, currentBlockNumber)
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
    amount: CurrencyAmount<Currency>,
    cachedRoutesRouteIds: number[],
    alphaRouterConfig?: AlphaRouterConfig,
    swapOptions?: SwapOptions
  ): void {
    const payload = {
      headers: {
        'x-universal-router-version': protocols.includes(Protocol.V4)
          ? UniversalRouterVersion.V2_0
          : UniversalRouterVersion.V1_2,
      },
      queryStringParameters: {
        tokenInAddress: getSymbolOrAddress(partitionKey.currencyIn, partitionKey.chainId),
        tokenInChainId: partitionKey.chainId.toString(),
        tokenOutAddress: getSymbolOrAddress(partitionKey.currencyOut, partitionKey.chainId),
        tokenOutChainId: partitionKey.chainId.toString(),
        amount: amount.quotient.toString(),
        type: partitionKey.tradeType === 0 ? 'exactIn' : 'exactOut',
        protocols: protocols.map((protocol) => protocol.toLowerCase()).join(','),
        intent: INTENT.CACHING,
        requestSource: 'routing-api',
        cachedRoutesRouteIds: serializeRouteIds(cachedRoutesRouteIds),
        enableDebug: alphaRouterConfig?.enableDebug,
        swapOptions: swapOptions?.simulate?.fromAddress,
        enableUniversalRouter: true,
        // note we are still inside sync call, so we need to pass the requestId to the async call
        // requestId is from upstream TAPI
        // then we can correlate the async request with the sync request
        asyncRequestId: alphaRouterConfig?.requestId,
      },
    }

    if (this.cachingQuoteLambdaName) {
      const params = {
        FunctionName: this.cachingQuoteLambdaName,
        InvocationType: 'Event',
        Payload: JSON.stringify(payload),
      }

      log.info(`[DynamoRouteCachingProvider] Sending async caching request to lambda ${JSON.stringify(params)}`)
      metric.putMetric(
        `CachingQuoteForRoutesDbRequestSentToLambda${this.cachingQuoteLambdaName}`,
        1,
        MetricLoggerUnit.Count
      )

      this.lambdaClient.invoke(params).promise()
    }
  }

  private setRoutesDbCachingIntentFlag(
    partitionKey: PairTradeTypeChainId,
    amount: CurrencyAmount<Currency>,
    currentBlockNumber: number
  ): void {
    const putParams = {
      TableName: this.routesCachingRequestFlagTableName,
      Item: {
        pairTradeTypeChainId: partitionKey.toString(),
        amount: parseFloat(amount.toExact()),
        ttl: Math.floor(Date.now() / 1000) + this.ROUTES_DB_FLAG_TTL,
        blockNumber: currentBlockNumber,
      },
    }

    this.ddbClient.put(putParams).promise()
  }

  /**
   * Implementation of the abstract method defined in `IRouteCachingProvider`
   * Attempts to insert the `CachedRoutes` object into cache, if the CachingStrategy returns the CachingParameters
   *
   * @param cachedRoutes
   * @protected
   */
  protected async _setCachedRoute(cachedRoutes: CachedRoutes): Promise<boolean> {
    const routesDbEntries = cachedRoutes.routes.map((route) => {
      const individualCachedRoutes = new CachedRoutes({
        routes: [route],
        chainId: cachedRoutes.chainId,
        currencyIn: cachedRoutes.currencyIn,
        currencyOut: cachedRoutes.currencyOut,
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
      const protocolsInvolved = computeProtocolsInvolvedIfMixed(route)

      return {
        PutRequest: {
          Item: {
            pairTradeTypeChainId: partitionKey.toString(),
            routeId: route.routeId,
            blockNumber: cachedRoutes.blockNumber,
            protocol: route.protocol.toString(),
            item: binaryCachedRoutes,
            plainRoutes: jsonCachedRoutes,
            protocolsInvolved: Array.from(protocolsInvolved).join(','),
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
   * Deletes the cached routes for the given chainId, amount, quoteCurrency, tradeType, protocols, blockNumber
   *
   * @param chainId
   * @param amount
   * @param quoteCurrency
   * @param tradeType
   * @param protocols
   * @param blockNumber
   * @param alphaRouterConfig
   * @param swapOptions
   * @returns
   */
  protected async _deleteCachedRoute(cachedRoutes: CachedRoutes): Promise<boolean> {
    if (cachedRoutes.routes.length === 0) {
      log.warn(`[DynamoRouteCachingProvider] No routes to delete for ${cachedRoutes.toString()}`)
      return false
    }

    const partitionKey = PairTradeTypeChainId.fromCachedRoutes(cachedRoutes)
    const deleteRequests = cachedRoutes.routes.map((route) => ({
      DeleteRequest: {
        Key: {
          pairTradeTypeChainId: partitionKey.toString(),
          routeId: route.routeId,
        },
      },
    }))

    if (deleteRequests.length === 0) {
      log.warn(`[DynamoRouteCachingProvider] No routes to delete for ${partitionKey.toString()}`)
      return false
    }

    try {
      // DynamoDB batchWrite supports max 25 items per call
      const BATCH_SIZE = 25
      for (let i = 0; i < deleteRequests.length; i += BATCH_SIZE) {
        const batch = deleteRequests.slice(i, i + BATCH_SIZE)
        const params = {
          RequestItems: {
            [this.routesTableName]: batch,
          },
        }
        const response = await this.ddbClient.batchWrite(params).promise()

        if (response.UnprocessedItems && Object.keys(response.UnprocessedItems).length > 0) {
          log.warn(
            `[DynamoRouteCachingProvider] Unprocessed items during delete for ${partitionKey.toString()}`,
            response.UnprocessedItems
          )
          // Optionally retry unprocessed items here
        }
      }

      log.info(`[DynamoRouteCachingProvider] Deleted ${deleteRequests.length} route(s) for ${partitionKey.toString()}`)
      return true
    } catch (error) {
      log.error(
        { error, partitionKey: partitionKey.toString() },
        `[DynamoRouteCachingProvider] Failed to delete cached routes`
      )
      return false
    }
  }

  /**
   * Implementation of the abstract method defined in `IRouteCachingProvider`
   * Obtains the CacheMode from the CachingStrategy, if not found, then return Darkmode.
   *
   * @param _chainId
   * @param _amount
   * @param _quoteToken
   * @param _tradeType
   * @param _protocols
   */
  public async getCacheMode(
    _chainId: ChainId,
    _amount: CurrencyAmount<Currency>,
    _quoteToken: Token,
    _tradeType: TradeType,
    _protocols: Protocol[]
  ): Promise<CacheMode> {
    return this.DEFAULT_CACHEMODE_ROUTES_DB
  }

  /**
   * RoutesDB self-correcting mechanism allows us to look at routes that would have been considered expired
   * We override this method to increase our cache coverage.
   *
   * @param cachedRoutes
   * @param _blockNumber
   * @param _optimistic
   * @protected
   */
  protected override filterExpiredCachedRoutes(
    cachedRoutes: CachedRoutes | undefined,
    _blockNumber: number,
    _optimistic: boolean
  ): CachedRoutes | undefined {
    // we can revert it back to never filter expired cached routes in read path
    // we will use blocks-to-live in the write cached routes path
    // also we can verify that cached routes cache invalidation bug error is gone in sepolia, as we removed hardcoding for sepolia
    return cachedRoutes
  }

  /**
   * Helper function to determine the tokenIn and tokenOut given the tradeType, quoteToken and amount.currency
   *
   * @param amount
   * @param quoteCurrency
   * @param tradeType
   * @private
   */
  private determineCurrencyInOut(
    amount: CurrencyAmount<Currency>,
    quoteCurrency: Currency,
    tradeType: TradeType
  ): { currencyIn: Currency; currencyOut: Currency } {
    if (tradeType == TradeType.EXACT_INPUT) {
      return { currencyIn: amount.currency, currencyOut: quoteCurrency }
    } else {
      return { currencyIn: quoteCurrency, currencyOut: amount.currency }
    }
  }
}
