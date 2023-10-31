import { V3PoolProvider } from '@uniswap/smart-order-router'
import { Pool } from '@uniswap/v3-sdk'
import {
  buildMockV3PoolAccessor,
  DAI_USDT_LOW,
  USDC_DAI_LOW,
  USDC_DAI_MEDIUM,
  USDC_WETH_LOW,
  WETH9_USDT_LOW,
} from './mocked-data'
import sinon from 'sinon'

export function getMockedV3PoolProvider(
  pools: Pool[] = [USDC_DAI_LOW, USDC_DAI_MEDIUM, USDC_WETH_LOW, WETH9_USDT_LOW, DAI_USDT_LOW]
): V3PoolProvider {
  const mockV3PoolProvider = sinon.createStubInstance(V3PoolProvider)

  mockV3PoolProvider.getPools.resolves(buildMockV3PoolAccessor(pools))
  mockV3PoolProvider.getPoolAddress.callsFake((tA, tB, fee) => ({
    poolAddress: Pool.getAddress(tA, tB, fee),
    token0: tA,
    token1: tB,
  }))

  return mockV3PoolProvider
}

export const TEST_ROUTE_TABLE = {
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
