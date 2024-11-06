import chai, { expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import 'reflect-metadata'
import { setupTables } from '../../../../dbSetup'
import {
  DynamoRouteCachingProvider,
  PairTradeTypeChainId,
} from '../../../../../../lib/handlers/router-entities/route-caching'
import { ADDRESS_ZERO, Protocol } from '@uniswap/router-sdk'
import { ChainId, CurrencyAmount, Ether, TradeType } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import { encodeSqrtRatioX96, FeeAmount, Pool as V3Pool } from '@uniswap/v3-sdk'
import { Pool as V4Pool } from '@uniswap/v4-sdk'
import { WNATIVE_ON } from '../../../../../utils/tokens'
import {
  CacheMode,
  CachedRoute,
  CachedRoutes,
  UNI_MAINNET,
  USDC_MAINNET,
  V3Route,
  nativeOnChain,
  MetricLoggerUnit,
} from '@uniswap/smart-order-router'
import { DynamoDBTableProps } from '../../../../../../bin/stacks/routing-database-stack'
import { V4Route } from '@uniswap/smart-order-router/build/main/routers'
import { NEW_CACHED_ROUTES_ROLLOUT_PERCENT } from '../../../../../../lib/util/newCachedRoutesRolloutPercent'
import sinon, { SinonSpy } from 'sinon'
import { metric } from '@uniswap/smart-order-router/build/main/util/metric'
import { DynamoDB } from 'aws-sdk'

chai.use(chaiAsPromised)

const TEST_ROUTE_CACHING_TABLE = {
  TableName: 'RouteCachingDB',
  KeySchema: [
    {
      AttributeName: 'pairTradeTypeChainId',
      KeyType: 'HASH',
    },
    {
      AttributeName: 'protocolsBucketBlockNumber',
      KeyType: 'RANGE',
    },
  ],
  AttributeDefinitions: [
    {
      AttributeName: 'pairTradeTypeChainId',
      AttributeType: 'S',
    },
    {
      AttributeName: 'protocolsBucketBlockNumber',
      AttributeType: 'S',
    },
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 1,
    WriteCapacityUnits: 1,
  },
}

const TEST_ROUTE_DB_TABLE = {
  TableName: DynamoDBTableProps.RoutesDbTable.Name,
  KeySchema: [
    {
      AttributeName: 'pairTradeTypeChainId',
      KeyType: 'HASH',
    },
    {
      AttributeName: 'routeId',
      KeyType: 'RANGE',
    },
  ],
  AttributeDefinitions: [
    {
      AttributeName: 'pairTradeTypeChainId',
      AttributeType: 'S',
    },
    {
      AttributeName: 'routeId',
      AttributeType: 'N',
    },
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 1,
    WriteCapacityUnits: 1,
  },
}

const WETH = WNATIVE_ON(ChainId.MAINNET)

const TEST_WETH_USDC_POOL = new V3Pool(
  WETH,
  USDC_MAINNET,
  FeeAmount.HIGH,
  /* sqrtRatio */ '2437312313659959819381354528',
  /* liquidity */ '10272714736694327408',
  /* tickCurrent */ -69633
)

const TEST_UNI_USDC_POOL = new V3Pool(
  UNI_MAINNET,
  USDC_MAINNET,
  FeeAmount.HIGH,
  /* sqrtRatio */ '2437312313659959819381354528',
  /* liquidity */ '10272714736694327408',
  /* tickCurrent */ -69633
)

const TEST_ETH_USDC_V4_POOL = new V4Pool(
  USDC_MAINNET,
  Ether.onChain(ChainId.MAINNET),
  FeeAmount.LOW,
  10,
  ADDRESS_ZERO,
  encodeSqrtRatioX96(1, 1),
  500,
  0
)

const TEST_WETH_USDC_V3_ROUTE = new V3Route([TEST_WETH_USDC_POOL], WETH, USDC_MAINNET)
const TEST_UNI_USDC_ROUTE = new V3Route([TEST_UNI_USDC_POOL], UNI_MAINNET, USDC_MAINNET)
const TES_USDC_ETH_V4_ROUTE = new V4Route([TEST_ETH_USDC_V4_POOL], USDC_MAINNET, nativeOnChain(ChainId.MAINNET))
const TEST_CACHED_ROUTE = new CachedRoute({ route: TEST_WETH_USDC_V3_ROUTE, percent: 100 })
const TEST_CACHED_ROUTES = new CachedRoutes({
  routes: [TEST_CACHED_ROUTE],
  chainId: TEST_CACHED_ROUTE.route.chainId,
  currencyIn: WETH,
  currencyOut: USDC_MAINNET,
  protocolsCovered: [TEST_CACHED_ROUTE.protocol],
  blockNumber: 0,
  tradeType: TradeType.EXACT_INPUT,
  originalAmount: '1',
  blocksToLive: 5,
})
const TEST_CACHED_V4_ROUTE = new CachedRoute({ route: TES_USDC_ETH_V4_ROUTE, percent: 100 })
const TEST_CACHED_V4_ROUTES = new CachedRoutes({
  routes: [TEST_CACHED_V4_ROUTE],
  chainId: TEST_CACHED_V4_ROUTE.route.chainId,
  currencyIn: nativeOnChain(ChainId.MAINNET),
  currencyOut: USDC_MAINNET,
  protocolsCovered: [TEST_CACHED_V4_ROUTE.protocol],
  blockNumber: 0,
  tradeType: TradeType.EXACT_INPUT,
  originalAmount: '1',
  blocksToLive: 5,
})

const TEST_UNCACHED_ROUTE = new CachedRoute({ route: TEST_UNI_USDC_ROUTE, percent: 100 })
const TEST_UNCACHED_ROUTES = new CachedRoutes({
  routes: [TEST_UNCACHED_ROUTE],
  chainId: TEST_UNCACHED_ROUTE.route.chainId,
  currencyIn: UNI_MAINNET,
  currencyOut: USDC_MAINNET,
  protocolsCovered: [TEST_UNCACHED_ROUTE.protocol],
  blockNumber: 0,
  tradeType: TradeType.EXACT_INPUT,
  originalAmount: '1',
  blocksToLive: 5,
})

describe('DynamoRouteCachingProvider', async () => {
  let spy: SinonSpy

  beforeEach(() => {
    spy = sinon.spy(metric, 'putMetric')
  })

  afterEach(() => {
    spy.restore()
  })

  setupTables(TEST_ROUTE_CACHING_TABLE, TEST_ROUTE_DB_TABLE)
  const dynamoRouteCache = new DynamoRouteCachingProvider({
    routesTableName: DynamoDBTableProps.RoutesDbTable.Name,
    routesCachingRequestFlagTableName: DynamoDBTableProps.RoutesDbCachingRequestFlagTable.Name,
    cachingQuoteLambdaName: 'test',
  })

  it('Cached routes hits new cached routes lambda', async () => {
    spy.withArgs('CachingQuoteForRoutesDbRequestSentToLambdanewcachinglambda', 1, MetricLoggerUnit.Count)
    spy.withArgs('RoutesDbEntryPlainTextRouteFound', 1, MetricLoggerUnit.Count)
    spy.withArgs('RoutesDbEntrySerializedRouteFound', 1, MetricLoggerUnit.Count)

    // testnet rolls out at 100%
    const newCachedRoutesRolloutPercent = NEW_CACHED_ROUTES_ROLLOUT_PERCENT[ChainId.SEPOLIA]

    const dynamoRouteCache = new DynamoRouteCachingProvider({
      routesTableName: DynamoDBTableProps.RoutesDbTable.Name,
      routesCachingRequestFlagTableName: DynamoDBTableProps.RoutesDbCachingRequestFlagTable.Name,
      cachingQuoteLambdaName: Math.random() * 100 < (newCachedRoutesRolloutPercent ?? 0) ? 'newcachinglambda' : 'test',
    })

    const currencyAmount = CurrencyAmount.fromRawAmount(WETH, JSBI.BigInt(1 * 10 ** WETH.decimals))

    const cacheMode = await dynamoRouteCache.getCacheMode(
      ChainId.MAINNET,
      currencyAmount,
      USDC_MAINNET,
      TradeType.EXACT_INPUT,
      [Protocol.V3, Protocol.V4]
    )
    expect(cacheMode).to.equal(CacheMode.Livemode)

    const insertedIntoCache = await dynamoRouteCache.setCachedRoute(TEST_CACHED_ROUTES, currencyAmount)
    expect(insertedIntoCache).to.be.true

    // Fetches route successfully from cache when it has been cached.
    const route = await dynamoRouteCache.getCachedRoute(
      ChainId.MAINNET,
      currencyAmount,
      USDC_MAINNET,
      TradeType.EXACT_INPUT,
      [Protocol.V3],
      TEST_CACHED_ROUTES.blockNumber
    )
    expect(route).to.not.be.undefined

    const queryParams = {
      TableName: DynamoDBTableProps.RoutesDbTable.Name,
      KeyConditionExpression: '#pk = :pk',
      ExpressionAttributeNames: {
        '#pk': 'pairTradeTypeChainId',
      },
      ExpressionAttributeValues: {
        ':pk': PairTradeTypeChainId.fromCachedRoutes(TEST_CACHED_ROUTES).toString(),
      },
    }
    const cachedRoutes = await new DynamoDB.DocumentClient({
      maxRetries: 1,
      retryDelayOptions: {
        base: 20,
      },
      httpOptions: {
        timeout: 100,
      },
    })
      .query(queryParams)
      .promise()

    cachedRoutes.Items?.forEach(async (item) => {
      expect(item).to.not.be.undefined
      // We nullify the plainRoutes column and update the Item in-place in the table,
      // so that we make sure when we get cached routes again, we will hit the serialized route path.
      item.plainRoutes = undefined

      const putRequest = {
        TableName: DynamoDBTableProps.RoutesDbTable.Name,
        Item: item,
      }

      await new DynamoDB.DocumentClient({
        maxRetries: 1,
        retryDelayOptions: {
          base: 20,
        },
        httpOptions: {
          timeout: 100,
        },
      })
        .put(putRequest)
        .promise()
    })

    const updatedRoute = await dynamoRouteCache.getCachedRoute(
      ChainId.MAINNET,
      currencyAmount,
      USDC_MAINNET,
      TradeType.EXACT_INPUT,
      [Protocol.V3],
      TEST_CACHED_ROUTES.blockNumber
    )
    expect(updatedRoute).to.not.be.undefined

    sinon.assert.called(spy)
  })

  it('Caches routes properly for a token pair that has its cache configured to Livemode', async () => {
    const currencyAmount = CurrencyAmount.fromRawAmount(WETH, JSBI.BigInt(1 * 10 ** WETH.decimals))
    const currencyAmountETH = CurrencyAmount.fromRawAmount(
      nativeOnChain(ChainId.MAINNET),
      JSBI.BigInt(1 * 10 ** nativeOnChain(ChainId.MAINNET).decimals)
    )

    const cacheMode = await dynamoRouteCache.getCacheMode(
      ChainId.MAINNET,
      currencyAmount,
      USDC_MAINNET,
      TradeType.EXACT_INPUT,
      [Protocol.V3, Protocol.V4]
    )
    expect(cacheMode).to.equal(CacheMode.Livemode)

    const insertedIntoCache = await dynamoRouteCache.setCachedRoute(TEST_CACHED_ROUTES, currencyAmount)
    expect(insertedIntoCache).to.be.true

    const insertedIntoCacheV4 = await dynamoRouteCache.setCachedRoute(TEST_CACHED_V4_ROUTES, currencyAmountETH)
    expect(insertedIntoCacheV4).to.be.true

    const cacheModeFromCachedRoutes = await dynamoRouteCache.getCacheModeFromCachedRoutes(
      TEST_CACHED_ROUTES,
      currencyAmount
    )
    expect(cacheModeFromCachedRoutes).to.equal(CacheMode.Livemode)

    const cacheModeFromCachedV4Routes = await dynamoRouteCache.getCacheModeFromCachedRoutes(
      TEST_CACHED_V4_ROUTES,
      currencyAmount
    )
    expect(cacheModeFromCachedV4Routes).to.equal(CacheMode.Livemode)

    // Fetches route successfully from cache when it has been cached.
    const route = await dynamoRouteCache.getCachedRoute(
      ChainId.MAINNET,
      currencyAmount,
      USDC_MAINNET,
      TradeType.EXACT_INPUT,
      [Protocol.V3],
      TEST_CACHED_ROUTES.blockNumber
    )
    expect(route).to.not.be.undefined

    const v4route = await dynamoRouteCache.getCachedRoute(
      ChainId.MAINNET,
      currencyAmountETH,
      USDC_MAINNET,
      TradeType.EXACT_INPUT,
      [Protocol.V4],
      TEST_CACHED_V4_ROUTES.blockNumber
    )
    expect(v4route).to.not.be.undefined
  })

  it('Still uses RoutesDB Table for the default configuration', async () => {
    const currencyAmount = CurrencyAmount.fromRawAmount(UNI_MAINNET, JSBI.BigInt(1 * 10 ** UNI_MAINNET.decimals))
    const cacheMode = await dynamoRouteCache.getCacheMode(
      ChainId.MAINNET,
      currencyAmount,
      USDC_MAINNET,
      TradeType.EXACT_INPUT,
      [Protocol.V3]
    )
    expect(cacheMode).to.equal(CacheMode.Livemode)

    const insertedIntoCache = await dynamoRouteCache.setCachedRoute(TEST_UNCACHED_ROUTES, currencyAmount)
    expect(insertedIntoCache).to.be.true

    const cacheModeFromCachedRoutes = await dynamoRouteCache.getCacheModeFromCachedRoutes(
      TEST_UNCACHED_ROUTES,
      currencyAmount
    )
    expect(cacheModeFromCachedRoutes).to.equal(CacheMode.Livemode)

    // Fetches nothing from the cache since cache is in Darkmode.
    const route = await dynamoRouteCache.getCachedRoute(
      ChainId.MAINNET,
      currencyAmount,
      USDC_MAINNET,
      TradeType.EXACT_INPUT,
      [Protocol.V3],
      TEST_CACHED_ROUTES.blockNumber
    )
    expect(route).to.not.be.undefined
  })
})
