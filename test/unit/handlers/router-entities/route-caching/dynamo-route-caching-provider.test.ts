import chai, { expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import 'reflect-metadata'
import { setupTables } from '../../../../mocha/dbSetup'
import { DynamoRouteCachingProvider } from '../../../../../lib/handlers/router-entities/route-caching'
import { Protocol } from '@uniswap/router-sdk'
import { CurrencyAmount, TradeType } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import { FeeAmount, Pool } from '@uniswap/v3-sdk'
import { WNATIVE_ON } from '../../../../utils/tokens'
import {
  CacheMode,
  CachedRoute,
  CachedRoutes,
  ChainId,
  UNI_MAINNET,
  USDC_MAINNET,
  V3Route,
} from '@uniswap/smart-order-router'

chai.use(chaiAsPromised)

const TEST_ROUTE_TABLE = {
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

const WETH = WNATIVE_ON(ChainId.MAINNET)

const TEST_WETH_USDC_POOL = new Pool(
  WETH,
  USDC_MAINNET,
  FeeAmount.HIGH,
  /* sqrtRatio */ '2437312313659959819381354528',
  /* liquidity */ '10272714736694327408',
  /* tickCurrent */ -69633
)

const TEST_USDC_UNI_POOL = new Pool(
  USDC_MAINNET,
  UNI_MAINNET,
  FeeAmount.HIGH,
  /* sqrtRatio */ '2437312313659959819381354528',
  /* liquidity */ '10272714736694327408',
  /* tickCurrent */ -69633
)

const TEST_UNI_USDC_POOL = new Pool(
  UNI_MAINNET,
  USDC_MAINNET,
  FeeAmount.HIGH,
  /* sqrtRatio */ '2437312313659959819381354528',
  /* liquidity */ '10272714736694327408',
  /* tickCurrent */ -69633
)

const TEST_WETH_USDC_V3_ROUTE = new V3Route([TEST_WETH_USDC_POOL], WETH, USDC_MAINNET)
const TEST_USDC_UNI_V3_ROUTE = new V3Route([TEST_USDC_UNI_POOL], USDC_MAINNET, UNI_MAINNET)
const TEST_UNI_USDC_ROUTE = new V3Route([TEST_UNI_USDC_POOL], UNI_MAINNET, USDC_MAINNET)

const TEST_CACHED_ROUTE = new CachedRoute({ route: TEST_WETH_USDC_V3_ROUTE, percent: 100 })
const TEST_CACHED_ROUTES = new CachedRoutes({
  routes: [TEST_CACHED_ROUTE],
  chainId: TEST_CACHED_ROUTE.route.chainId,
  tokenIn: WETH,
  tokenOut: USDC_MAINNET,
  protocolsCovered: [TEST_CACHED_ROUTE.protocol],
  blockNumber: 0,
  tradeType: TradeType.EXACT_INPUT,
  originalAmount: '1',
  blocksToLive: 5,
})

const TEST_CACHED_ROUTE_2 = new CachedRoute({ route: TEST_USDC_UNI_V3_ROUTE, percent: 100 })
const TEST_CACHED_ROUTES_2 = new CachedRoutes({
  routes: [TEST_CACHED_ROUTE_2],
  chainId: TEST_CACHED_ROUTE_2.route.chainId,
  tokenIn: USDC_MAINNET,
  tokenOut: UNI_MAINNET,
  protocolsCovered: [TEST_CACHED_ROUTE_2.protocol],
  blockNumber: 0,
  tradeType: TradeType.EXACT_INPUT,
  originalAmount: '1',
  blocksToLive: 5,
})

const TEST_UNCACHED_ROUTE = new CachedRoute({ route: TEST_UNI_USDC_ROUTE, percent: 100 })
const TEST_UNCACHED_ROUTES = new CachedRoutes({
  routes: [TEST_UNCACHED_ROUTE],
  chainId: TEST_UNCACHED_ROUTE.route.chainId,
  tokenIn: UNI_MAINNET,
  tokenOut: USDC_MAINNET,
  protocolsCovered: [TEST_UNCACHED_ROUTE.protocol],
  blockNumber: 0,
  tradeType: TradeType.EXACT_INPUT,
  originalAmount: '1',
  blocksToLive: 5,
})

describe('DynamoRouteCachingProvider', async () => {
  setupTables(TEST_ROUTE_TABLE)
  const dynamoRouteCache = new DynamoRouteCachingProvider({ cachedRoutesTableName: TEST_ROUTE_TABLE.TableName })

  it('Caches routes properly for a token pair that has its cache configured to Livemode', async () => {
    const currencyAmount = CurrencyAmount.fromRawAmount(WETH, JSBI.BigInt(1 * 10 ** WETH.decimals))
    const cacheMode = await dynamoRouteCache.getCacheMode(
      ChainId.MAINNET,
      currencyAmount,
      USDC_MAINNET,
      TradeType.EXACT_INPUT,
      [Protocol.V3]
    )
    expect(cacheMode).to.equal(CacheMode.Livemode)

    const insertedIntoCache = await dynamoRouteCache.setCachedRoute(TEST_CACHED_ROUTES, currencyAmount)
    expect(insertedIntoCache).to.be.true

    const cacheModeFromCachedRoutes = await dynamoRouteCache.getCacheModeFromCachedRoutes(
      TEST_CACHED_ROUTES,
      currencyAmount
    )
    expect(cacheModeFromCachedRoutes).to.equal(CacheMode.Livemode)

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
  })

  it('Caches routes properly for a token pair that has its cache configured to Tapcompare', async () => {
    const currencyAmount = CurrencyAmount.fromRawAmount(USDC_MAINNET, JSBI.BigInt(200 * 10 ** USDC_MAINNET.decimals))
    const cacheMode = await dynamoRouteCache.getCacheMode(
      ChainId.MAINNET,
      currencyAmount,
      UNI_MAINNET,
      TradeType.EXACT_INPUT,
      [Protocol.V3]
    )
    expect(cacheMode).to.equal(CacheMode.Tapcompare)

    const insertedIntoCache = await dynamoRouteCache.setCachedRoute(TEST_CACHED_ROUTES_2, currencyAmount)
    expect(insertedIntoCache).to.be.true

    const cacheModeFromCachedRoutes = await dynamoRouteCache.getCacheModeFromCachedRoutes(
      TEST_CACHED_ROUTES_2,
      currencyAmount
    )
    expect(cacheModeFromCachedRoutes).to.equal(CacheMode.Tapcompare)

    // Fetches route successfully from cache, since cache is active in Tapcompare mode.
    const route = await dynamoRouteCache.getCachedRoute(
      ChainId.MAINNET,
      currencyAmount,
      UNI_MAINNET,
      TradeType.EXACT_INPUT,
      [Protocol.V3],
      TEST_CACHED_ROUTES_2.blockNumber
    )
    expect(route).to.not.be.undefined
  })

  it('Does not cache routes for a token pair that has its cache configured in the default Darkmode', async () => {
    const currencyAmount = CurrencyAmount.fromRawAmount(UNI_MAINNET, JSBI.BigInt(1 * 10 ** UNI_MAINNET.decimals))
    const cacheMode = await dynamoRouteCache.getCacheMode(
      ChainId.MAINNET,
      currencyAmount,
      USDC_MAINNET,
      TradeType.EXACT_INPUT,
      [Protocol.V3]
    )
    expect(cacheMode).to.equal(CacheMode.Darkmode)

    const insertedIntoCache = await dynamoRouteCache.setCachedRoute(TEST_UNCACHED_ROUTES, currencyAmount)
    expect(insertedIntoCache).to.be.false

    const cacheModeFromCachedRoutes = await dynamoRouteCache.getCacheModeFromCachedRoutes(
      TEST_UNCACHED_ROUTES,
      currencyAmount
    )
    expect(cacheModeFromCachedRoutes).to.equal(CacheMode.Darkmode)

    // Fetches nothing from the cache since cache is in Darkmode.
    const route = await dynamoRouteCache.getCachedRoute(
      ChainId.MAINNET,
      currencyAmount,
      USDC_MAINNET,
      TradeType.EXACT_INPUT,
      [Protocol.V3],
      TEST_CACHED_ROUTES.blockNumber
    )
    expect(route).to.be.undefined
  })

  it('Finds the CacheMode from a wildcard exact output configuration', async () => {
    const currencyAmount = CurrencyAmount.fromRawAmount(WETH, JSBI.BigInt(100 * 10 ** WETH.decimals))
    const cacheMode = await dynamoRouteCache.getCacheMode(
      ChainId.MAINNET,
      currencyAmount,
      USDC_MAINNET,
      TradeType.EXACT_OUTPUT,
      [Protocol.V3]
    )
    expect(cacheMode).to.equal(CacheMode.Tapcompare)
  })
})
