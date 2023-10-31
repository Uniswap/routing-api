import { ChainId, Token } from '@uniswap/sdk-core'
import { log } from '@uniswap/smart-order-router'
import { ProviderConfig } from '@uniswap/smart-order-router/build/main/providers/provider'
import { FeeAmount, Pool } from '@uniswap/v3-sdk'
import { expect } from 'chai'
import { DynamoCachingV3Pool } from '../../../../../../../lib/handlers/pools/pool-caching/v3/cache-dynamo-pool'
import { DynamoDBCachingV3PoolProvider } from '../../../../../../../lib/handlers/pools/pool-caching/v3/dynamo-caching-pool-provider'
import { SUPPORTED_POOLS } from '../../../../../../test-utils/mocked-data'
import { getMockedV3PoolProvider, TEST_ROUTE_TABLE } from '../../../../../../test-utils/mocked-dependencies'
import { setupTables } from '../../../../../dbSetup'

describe('DynamoDBCachingV3PoolProvider', async () => {
  setupTables(TEST_ROUTE_TABLE)

  it('caches pools properly with a given block number', async () => {
    const dynamoPoolCache = new DynamoDBCachingV3PoolProvider(
      ChainId.GOERLI,
      getMockedV3PoolProvider(),
      TEST_ROUTE_TABLE.TableName
    )
    const dynamoCache = new DynamoCachingV3Pool({ tableName: TEST_ROUTE_TABLE.TableName })

    const providerConfig: ProviderConfig = { blockNumber: 111 }
    const blockNumber = await providerConfig.blockNumber

    // First ensure the dynamo cache doesn't have the pools yet
    for (const pool of SUPPORTED_POOLS) {
      const poolAddress = getMockedV3PoolProvider().getPoolAddress(pool.token0, pool.token1, pool.fee).poolAddress
      const hasCachedPool = await dynamoCache.get(`pool-${ChainId.GOERLI}-${poolAddress}`, blockNumber)
      expect(hasCachedPool).to.not.exist
    }

    const tokenPairs: [Token, Token, FeeAmount][] = SUPPORTED_POOLS.map((pool: Pool) => {
      return [pool.token0, pool.token1, pool.fee]
    })
    await dynamoPoolCache.getPools(tokenPairs, providerConfig)

    // Then ensure the dynamo cache has the pools yet
    for (const pool of SUPPORTED_POOLS) {
      const poolAddress = getMockedV3PoolProvider().getPoolAddress(pool.token0, pool.token1, pool.fee).poolAddress
      const hasCachedPool = await dynamoCache.get(`pool-${ChainId.GOERLI}-${poolAddress}`, blockNumber)
      expect(hasCachedPool).to.exist

      expect(hasCachedPool?.token0.chainId).equals(pool.token0.chainId)
      expect(hasCachedPool?.token0.decimals).equals(pool.token0.decimals)
      expect(hasCachedPool?.token0.address).equals(pool.token0.address)

      expect(hasCachedPool?.token1.chainId).equals(pool.token1.chainId)
      expect(hasCachedPool?.token1.decimals).equals(pool.token1.decimals)
      expect(hasCachedPool?.token1.address).equals(pool.token1.address)

      expect(hasCachedPool?.fee).equals(pool.fee)

      expect(hasCachedPool?.sqrtRatioX96.toString()).equals(pool.sqrtRatioX96.toString())

      expect(hasCachedPool?.liquidity.toString()).equals(pool.liquidity.toString())

      expect(hasCachedPool?.tickCurrent).equals(pool.tickCurrent)
    }
  })

  it('caches do not cache when no block number', async () => {
    const dynamoPoolCache = new DynamoDBCachingV3PoolProvider(
      ChainId.GOERLI,
      getMockedV3PoolProvider(),
      TEST_ROUTE_TABLE.TableName
    )
    const dynamoCache = new DynamoCachingV3Pool({ tableName: TEST_ROUTE_TABLE.TableName })

    const providerConfig: ProviderConfig = { blockNumber: undefined }
    const blockNumber = await providerConfig.blockNumber

    // First ensure the dynamo cache doesn't have the pools yet
    for (const pool of SUPPORTED_POOLS) {
      const poolAddress = getMockedV3PoolProvider().getPoolAddress(pool.token0, pool.token1, pool.fee).poolAddress
      log.info(`check if pool pool-${ChainId.GOERLI}-${poolAddress} block ${blockNumber} contains the cache`)
      const hasCachedPool = await dynamoCache.get(`pool-${ChainId.GOERLI}-${poolAddress}`, blockNumber)
      expect(hasCachedPool).to.not.exist
    }

    const tokenPairs: [Token, Token, FeeAmount][] = SUPPORTED_POOLS.map((pool: Pool) => {
      return [pool.token0, pool.token1, pool.fee]
    })
    await dynamoPoolCache.getPools(tokenPairs, providerConfig)

    // Then ensure the dynamo cache won't have the pools
    for (const pool of SUPPORTED_POOLS) {
      const poolAddress = getMockedV3PoolProvider().getPoolAddress(pool.token0, pool.token1, pool.fee).poolAddress
      log.info(`check if pool pool-${ChainId.GOERLI}-${poolAddress} block ${blockNumber} contains the cache`)
      const hasCachedPool = await dynamoCache.get(`pool-${ChainId.GOERLI}-${poolAddress}`, blockNumber)
      expect(hasCachedPool).to.not.equals
    }
  })
})
