import { IV3PoolProvider, V3PoolAccessor } from '@uniswap/smart-order-router'
import { ChainId, Token } from '@uniswap/sdk-core'
import { ProviderConfig } from '@uniswap/smart-order-router/build/main/providers/provider'
import { FeeAmount, Pool } from '@uniswap/v3-sdk'
import { IDynamoCache } from '../cache-dynamo'
import { DynamoCachingV3Pool } from './cache-dynamo-pool'

export class DynamoDBCachingV3PoolProvider implements IV3PoolProvider {
  private readonly dynamoCache: IDynamoCache<string, number, Pool>
  private readonly POOL_CACHE_KEY = (chainId: ChainId, address: string) => `pool-${chainId}-${address}`

  constructor(protected chainId: ChainId, protected poolProvider: IV3PoolProvider, tableName: string) {
    this.dynamoCache = new DynamoCachingV3Pool({ tableName, ttlMinutes: 1 })
  }

  public getPoolAddress(
    tokenA: Token,
    tokenB: Token,
    feeAmount: FeeAmount
  ): {
    poolAddress: string
    token0: Token
    token1: Token
  } {
    return this.poolProvider.getPoolAddress(tokenA, tokenB, feeAmount)
  }

  public async getPools(
    tokenPairs: [Token, Token, FeeAmount][],
    providerConfig?: ProviderConfig
  ): Promise<V3PoolAccessor> {
    const poolAddressSet: Set<string> = new Set<string>()
    const poolsToGetTokenPairs: Array<[Token, Token, FeeAmount]> = []
    const poolsToGetAddresses: string[] = []
    const poolAddressToPool: { [poolAddress: string]: Pool } = {}
    const blockNumber: number | undefined = await providerConfig?.blockNumber

    for (const [tokenA, tokenB, feeAmount] of tokenPairs) {
      const { poolAddress, token0, token1 } = this.getPoolAddress(tokenA, tokenB, feeAmount)

      if (poolAddressSet.has(poolAddress)) {
        continue
      }

      poolAddressSet.add(poolAddress)

      const partitionKey = this.POOL_CACHE_KEY(this.chainId, poolAddress)
      const cachedPool = await this.dynamoCache.get(partitionKey, blockNumber)
      if (cachedPool) {
        poolAddressToPool[poolAddress] = cachedPool
        continue
      }

      poolsToGetTokenPairs.push([token0, token1, feeAmount])
      poolsToGetAddresses.push(poolAddress)
    }

    if (poolsToGetAddresses.length > 0) {
      const poolAccessor = await this.poolProvider.getPools(poolsToGetTokenPairs, providerConfig)
      for (const address of poolsToGetAddresses) {
        const pool = poolAccessor.getPoolByAddress(address)
        if (pool) {
          poolAddressToPool[address] = pool

          const partitionKey = this.POOL_CACHE_KEY(this.chainId, address)
          await this.dynamoCache.set(pool, partitionKey, blockNumber)
        }
      }
    }

    return {
      getPool: (tokenA: Token, tokenB: Token, feeAmount: FeeAmount): Pool | undefined => {
        const { poolAddress } = this.getPoolAddress(tokenA, tokenB, feeAmount)
        return poolAddressToPool[poolAddress]
      },
      getPoolByAddress: (address: string): Pool | undefined => poolAddressToPool[address],
      getAllPools: (): Pool[] => Object.values(poolAddressToPool),
    }
  }
}
