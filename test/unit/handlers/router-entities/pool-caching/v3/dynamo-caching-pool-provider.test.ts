import { setupTables } from '../../../../../mocha/dbSetup'
import {
  DynamoDBCachingV3PoolProvider
} from '../../../../../../lib/handlers/router-entities/pool-caching/v3/dynamo-caching-pool-provider'
import { ChainId } from '@uniswap/smart-order-router/build/main/util/chains'
import { getMockedV3PoolProvider } from '../../../../../test-utils/mocked-dependencies'
import { SUPPORTED_POOLS } from '../../../../../test-utils/mocked-data'
import { Token } from '@uniswap/sdk-core'
import { FeeAmount, Pool } from '@uniswap/v3-sdk'
import { ProviderConfig } from '@uniswap/smart-order-router/build/main/providers/provider'
import { expect } from 'chai'
import { DynamoCachingV3Pool } from '../../../../../../lib/handlers/router-entities/pool-caching/v3/cache-dynamo-pool'

const TEST_ROUTE_TABLE = {
  TableName: 'PoolCachingV3',
  KeySchema: [
    {
      AttributeName: 'poolAddress',
      KeyType: 'HASH',
    },
    {
      AttributeName: 'blockNumber',
      KeyType: 'RANGE',
    },
  ],
  AttributeDefinitions: [
    {
      AttributeName: 'poolAddress',
      AttributeType: 'S',
    },
    {
      AttributeName: 'blockNumber',
      AttributeType: 'N',
    },
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 1,
    WriteCapacityUnits: 1,
  },
}

describe('DynamoDBCachingV3PoolProvider', async () => {
  setupTables(TEST_ROUTE_TABLE)

  it('caches pools properly with a given block number', async () => {
    const dynamoPoolCache = new DynamoDBCachingV3PoolProvider(ChainId.GÖRLI, getMockedV3PoolProvider(), TEST_ROUTE_TABLE.TableName)
    const dynamoCache = new DynamoCachingV3Pool({ tableName: TEST_ROUTE_TABLE.TableName })

    const providerConfig: ProviderConfig = { blockNumber: 111 }
    const blockNumber = await providerConfig.blockNumber

    // First ensure the dynamo cache doesn't have the pools yet
    for (const pool of SUPPORTED_POOLS) {
      const poolAddress = getMockedV3PoolProvider().getPoolAddress(pool.token0, pool.token1, pool.fee).poolAddress
      const hasCachedPool = await dynamoCache.has(`pool-${ChainId.GÖRLI}-${poolAddress}`, blockNumber)
      expect(hasCachedPool).equals(false)
    }

    const tokenPairs: [Token, Token, FeeAmount][] = SUPPORTED_POOLS.map((pool: Pool) => {
      return [pool.token0, pool.token1, pool.fee]
    })
    await dynamoPoolCache.getPools(tokenPairs, providerConfig)

    // Then ensure the dynamo cache has the pools yet
    for (const pool of SUPPORTED_POOLS) {
      const poolAddress = getMockedV3PoolProvider().getPoolAddress(pool.token0, pool.token1, pool.fee).poolAddress
      const hasCachedPool = await dynamoCache.has(`pool-${ChainId.GÖRLI}-${poolAddress}`, blockNumber)
      expect(hasCachedPool).equals(true)
    }
  })

  it('caches do not cache when no block number', async () => {
    const dynamoPoolCache = new DynamoDBCachingV3PoolProvider(ChainId.GÖRLI, getMockedV3PoolProvider(), TEST_ROUTE_TABLE.TableName)
    const dynamoCache = new DynamoCachingV3Pool({ tableName: TEST_ROUTE_TABLE.TableName })

    const providerConfig: ProviderConfig = { blockNumber: undefined }
    const blockNumber = await providerConfig.blockNumber

    // First ensure the dynamo cache doesn't have the pools yet
    for (const pool of SUPPORTED_POOLS) {
      const poolAddress = getMockedV3PoolProvider().getPoolAddress(pool.token0, pool.token1, pool.fee).poolAddress
      const hasCachedPool = await dynamoCache.has(`pool-${ChainId.GÖRLI}-${poolAddress}`, blockNumber)
      expect(hasCachedPool).equals(false)
    }

    const tokenPairs: [Token, Token, FeeAmount][] = SUPPORTED_POOLS.map((pool: Pool) => {
      return [pool.token0, pool.token1, pool.fee]
    })
    await dynamoPoolCache.getPools(tokenPairs, providerConfig)

    // Then ensure the dynamo cache has the pools yet
    for (const pool of SUPPORTED_POOLS) {
      const poolAddress = getMockedV3PoolProvider().getPoolAddress(pool.token0, pool.token1, pool.fee).poolAddress
      const hasCachedPool = await dynamoCache.has(`pool-${ChainId.GÖRLI}-${poolAddress}`, blockNumber)
      expect(hasCachedPool).equals(false)
    }
  })
})