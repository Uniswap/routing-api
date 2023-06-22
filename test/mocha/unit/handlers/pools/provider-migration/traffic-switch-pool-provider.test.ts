import { TrafficSwitchV3PoolProvider } from '../../../../../../lib/handlers/pools/provider-migration/v3/traffic-switch-v3-pool-provider'
import { DynamoDBCachingV3PoolProvider } from '../../../../../../lib/handlers/pools/pool-caching/v3/dynamo-caching-pool-provider'
import { getMockedV3PoolProvider, TEST_ROUTE_TABLE } from '../../../../../test-utils/mocked-dependencies'
import { CachingV3PoolProvider, MetricLoggerUnit, NodeJSCache } from '@uniswap/smart-order-router'
import NodeCache from 'node-cache'
import sinon from 'sinon'
import { ChainId, Token } from '@uniswap/sdk-core'
import { encodeSqrtRatioX96, FeeAmount, Pool } from '@uniswap/v3-sdk'
import {
  DAI_USDT_LOW,
  SUPPORTED_POOLS,
  USDC_DAI_MEDIUM,
  USDC_WETH_LOW,
  WETH9_USDT_LOW,
} from '../../../../../test-utils/mocked-data'
import { ProviderConfig } from '@uniswap/smart-order-router/build/main/providers/provider'
import { metric } from '@uniswap/smart-order-router/build/main/util/metric'
import { setupTables } from '../../../../dbSetup'
import {
  DAI_MAINNET as DAI,
  USDC_MAINNET as USDC,
} from '@uniswap/smart-order-router/build/main/providers/token-provider'

describe('TrafficSwitchV3PoolProvider', async () => {
  setupTables(TEST_ROUTE_TABLE)
  const spy = sinon.spy(metric, 'putMetric')

  it('switch traffic and sample pools with accurate pricing and liquidity', async () => {
    spy.withArgs('V3_POOL_PROVIDER_POOL_CURRENT_QUOTE_MATCH', 1, MetricLoggerUnit.None)
    spy.withArgs('V3_POOL_PROVIDER_POOL_CURRENT_LIQUIDITY_MATCH', 1, MetricLoggerUnit.None)
    spy.withArgs('V3_POOL_PROVIDER_POOL_CURRENT_ACCURACY_MATCH', 1, MetricLoggerUnit.None)
    spy.withArgs('V3_POOL_PROVIDER_POOL_TARGET_QUOTE_MATCH', 1, MetricLoggerUnit.None)
    spy.withArgs('V3_POOL_PROVIDER_POOL_TARGET_LIQUIDITY_MATCH', 1, MetricLoggerUnit.None)
    spy.withArgs('V3_POOL_PROVIDER_POOL_TARGET_ACCURACY_MATCH', 1, MetricLoggerUnit.None)
    spy.withArgs('V3_POOL_PROVIDER_POOL_TRAFFIC_SAMPLING', 1, MetricLoggerUnit.None)
    spy.withArgs('V3_POOL_PROVIDER_POOL_TRAFFIC_TOTAL', 1, MetricLoggerUnit.None)

    const underlyingPool = getMockedV3PoolProvider()
    const inMemoryPoolCache = new CachingV3PoolProvider(
      ChainId.GOERLI,
      underlyingPool,
      new NodeJSCache(new NodeCache({ stdTTL: 15, useClones: false }))
    )
    const dynamoPoolCache = new DynamoDBCachingV3PoolProvider(
      ChainId.GOERLI,
      underlyingPool,
      TEST_ROUTE_TABLE.TableName
    )
    const trafficSwitchProvider = new (class SwitchTrafficSwitchV3PoolProvider extends TrafficSwitchV3PoolProvider {
      override readonly SHOULD_SWITCH_TRAFFIC = () => true
      override readonly SHOULD_SAMPLE_TRAFFIC = () => true
    })({
      currentPoolProvider: inMemoryPoolCache,
      targetPoolProvider: dynamoPoolCache,
      sourceOfTruthPoolProvider: underlyingPool,
    })

    const tokenPairs: [Token, Token, FeeAmount][] = SUPPORTED_POOLS.map((pool: Pool) => {
      return [pool.token0, pool.token1, pool.fee]
    })
    const providerConfig: ProviderConfig = { blockNumber: 111 }
    await trafficSwitchProvider.getPools(tokenPairs, providerConfig)

    sinon.assert.called(spy)
  })

  it('not switch traffic and sample pools with inaccurate pricing and inaccurate liquidity', async () => {
    const USDC_DAI_LOW_INACCURATE = new Pool(USDC, DAI, FeeAmount.LOW, encodeSqrtRatioX96(2, 2), 9, 0)

    spy.withArgs('V3_POOL_PROVIDER_POOL_CURRENT_QUOTE_MISMATCH', 1, MetricLoggerUnit.None)
    spy.withArgs('V3_POOL_PROVIDER_POOL_CURRENT_LIQUIDITY_MISMATCH', 1, MetricLoggerUnit.None)
    spy.withArgs('V3_POOL_PROVIDER_POOL_CURRENT_ACCURACY_MISMATCH', 1, MetricLoggerUnit.None)
    spy.withArgs('V3_POOL_PROVIDER_POOL_TARGET_QUOTE_MISMATCH', 1, MetricLoggerUnit.None)
    spy.withArgs('V3_POOL_PROVIDER_POOL_TARGET_LIQUIDITY_MISMATCH', 1, MetricLoggerUnit.None)
    spy.withArgs('V3_POOL_PROVIDER_POOL_TARGET_ACCURACY_MISMATCH', 1, MetricLoggerUnit.None)
    spy.withArgs('V3_POOL_PROVIDER_POOL_TRAFFIC_TOTAL', 1, MetricLoggerUnit.None)

    const underlyingPool = getMockedV3PoolProvider([
      USDC_DAI_LOW_INACCURATE,
      USDC_DAI_MEDIUM,
      USDC_WETH_LOW,
      WETH9_USDT_LOW,
      DAI_USDT_LOW,
    ])
    const inMemoryPoolCache = new CachingV3PoolProvider(
      ChainId.GOERLI,
      underlyingPool,
      new NodeJSCache(new NodeCache({ stdTTL: 15, useClones: false }))
    )
    const dynamoPoolCache = new DynamoDBCachingV3PoolProvider(
      ChainId.GOERLI,
      underlyingPool,
      TEST_ROUTE_TABLE.TableName
    )
    const trafficSwitchProvider = new (class SwitchTrafficSwitchV3PoolProvider extends TrafficSwitchV3PoolProvider {
      override readonly SHOULD_SWITCH_TRAFFIC = () => false
      override readonly SHOULD_SAMPLE_TRAFFIC = () => true
    })({
      currentPoolProvider: inMemoryPoolCache,
      targetPoolProvider: dynamoPoolCache,
      sourceOfTruthPoolProvider: underlyingPool,
    })

    const tokenPairs: [Token, Token, FeeAmount][] = SUPPORTED_POOLS.map((pool: Pool) => {
      return [pool.token0, pool.token1, pool.fee]
    })
    const providerConfig: ProviderConfig = { blockNumber: 111 }
    await trafficSwitchProvider.getPools(tokenPairs, providerConfig)

    sinon.assert.called(spy)
  })

  it('not switch traffic and sample pools with inaccurate pricing but accurate liquidity', async () => {
    const USDC_DAI_LOW_INACCURATE = new Pool(USDC, DAI, FeeAmount.LOW, encodeSqrtRatioX96(2, 2), 10, 0)

    spy.withArgs('V3_POOL_PROVIDER_POOL_CURRENT_QUOTE_MISMATCH', 1, MetricLoggerUnit.None)
    spy.withArgs('V3_POOL_PROVIDER_POOL_CURRENT_LIQUIDITY_MATCH', 1, MetricLoggerUnit.None)
    spy.withArgs('V3_POOL_PROVIDER_POOL_CURRENT_ACCURACY_MISMATCH', 1, MetricLoggerUnit.None)
    spy.withArgs('V3_POOL_PROVIDER_POOL_TARGET_QUOTE_MISMATCH', 1, MetricLoggerUnit.None)
    spy.withArgs('V3_POOL_PROVIDER_POOL_TARGET_LIQUIDITY_MATCH', 1, MetricLoggerUnit.None)
    spy.withArgs('V3_POOL_PROVIDER_POOL_TARGET_ACCURACY_MISMATCH', 1, MetricLoggerUnit.None)
    spy.withArgs('V3_POOL_PROVIDER_POOL_TRAFFIC_TOTAL', 1, MetricLoggerUnit.None)

    const underlyingPool = getMockedV3PoolProvider([
      USDC_DAI_LOW_INACCURATE,
      USDC_DAI_MEDIUM,
      USDC_WETH_LOW,
      WETH9_USDT_LOW,
      DAI_USDT_LOW,
    ])
    const inMemoryPoolCache = new CachingV3PoolProvider(
      ChainId.GOERLI,
      underlyingPool,
      new NodeJSCache(new NodeCache({ stdTTL: 15, useClones: false }))
    )
    const dynamoPoolCache = new DynamoDBCachingV3PoolProvider(
      ChainId.GOERLI,
      underlyingPool,
      TEST_ROUTE_TABLE.TableName
    )
    const trafficSwitchProvider = new (class SwitchTrafficSwitchV3PoolProvider extends TrafficSwitchV3PoolProvider {
      override readonly SHOULD_SWITCH_TRAFFIC = () => false
      override readonly SHOULD_SAMPLE_TRAFFIC = () => true
    })({
      currentPoolProvider: inMemoryPoolCache,
      targetPoolProvider: dynamoPoolCache,
      sourceOfTruthPoolProvider: underlyingPool,
    })

    const tokenPairs: [Token, Token, FeeAmount][] = SUPPORTED_POOLS.map((pool: Pool) => {
      return [pool.token0, pool.token1, pool.fee]
    })
    const providerConfig: ProviderConfig = { blockNumber: 111 }
    await trafficSwitchProvider.getPools(tokenPairs, providerConfig)

    sinon.assert.called(spy)
  })
})
