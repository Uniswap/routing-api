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
import { CacheMode, CachedRoute, CachedRoutes, ChainId, USDC_MAINNET, V3Route } from '@uniswap/smart-order-router'

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
    ReadCapacityUnits: 5,
    WriteCapacityUnits: 5,
  },
}

const WETH = WNATIVE_ON(ChainId.MAINNET)

export const TEST_POOL = new Pool(
  WETH,
  USDC_MAINNET,
  FeeAmount.HIGH,
  '2437312313659959819381354528',
  '10272714736694327408',
  -69633
)

const TEST_V3_ROUTE = new V3Route([TEST_POOL], WETH, USDC_MAINNET)

const TEST_CACHED_ROUTE = new CachedRoute({ route: TEST_V3_ROUTE, percent: 100})
const TEST_CACHED_ROUTES = new CachedRoutes({
  routes: [TEST_CACHED_ROUTE],
  chainId: TEST_CACHED_ROUTE.route.chainId,
  tokenIn: WETH,
  tokenOut: USDC_MAINNET,
  protocolsCovered: [TEST_CACHED_ROUTE.protocol],
  blockNumber: 0,
  tradeType: TradeType.EXACT_INPUT,
  originalAmount: '10',
  blocksToLive: 5,
})

describe('DynamoRouteCachingProvider', async () => {
  setupTables(TEST_ROUTE_TABLE)
  const dynamoRouteCache = new DynamoRouteCachingProvider({ cachedRoutesTableName: TEST_ROUTE_TABLE.TableName })
  const currencyAmount = CurrencyAmount.fromRawAmount(WETH, JSBI.BigInt(1))

  it('No routes cached in db returns undefined', async () => {
    const route = await dynamoRouteCache.getCachedRoute(
      1,
      CurrencyAmount.fromRawAmount(USDC_MAINNET, JSBI.BigInt(1)),
      USDC_MAINNET,
      TradeType.EXACT_INPUT,
      [Protocol.V3],
      1
    )
    expect(route).to.be.undefined
  })

  it('Caches routes properly for a token pair that has its cache configured to Livemode', async () => {
    const cacheMode = await dynamoRouteCache.getCacheMode(ChainId.MAINNET, currencyAmount, USDC_MAINNET, TradeType.EXACT_INPUT, [Protocol.V3])
    // Cache needs to be in Livemode for it to be actively caching routes.
    expect(cacheMode).to.equal(CacheMode.Livemode)

    const insertedIntoCache = await dynamoRouteCache.setCachedRoute(TEST_CACHED_ROUTES, currencyAmount)
    expect(insertedIntoCache).to.be.true

    // Fetches route successfully from cache when it has been cached.
    const route = await dynamoRouteCache.getCachedRoute(ChainId.MAINNET, currencyAmount, USDC_MAINNET, TradeType.EXACT_INPUT, [Protocol.V3], TEST_CACHED_ROUTES.blockNumber)
    expect(route).to.not.be.undefined
  })

})
