import { ChainId, ICache, IV3PoolProvider, V3PoolAccessor } from '@uniswap/smart-order-router'
import { Token } from '@uniswap/sdk-core'
import { ProviderConfig } from '@uniswap/smart-order-router/build/main/providers/provider'
import { FeeAmount, Pool } from '@uniswap/v3-sdk'
import { DynamoDB } from 'aws-sdk'

export class DynamoPoolProvider implements IV3PoolProvider {
  private readonly ddbClient: DynamoDB.DocumentClient
  private readonly tableName: string
  private readonly ttlMinutes: number
  private POOL_CACHE_KEY = (chainId: ChainId, address: string) =>
    `pool-${chainId}-${address}`

  constructor(protected chainId: ChainId, protected poolProvider: IV3PoolProvider) {
    this.ddbClient = new DynamoDB.DocumentClient({
      maxRetries: 1,
      retryDelayOptions: {
        base: 20,
      },
      httpOptions: {
        timeout: 100,
      },
    })
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

    for (const [tokenA, tokenB, feeAmount] of tokenPairs) {
      const { poolAddress, token0, token1 } = this.getPoolAddress(tokenA, tokenB, feeAmount)

      if (poolAddressSet.has(poolAddress)) {
        continue
      }

      poolAddressSet.add(poolAddress)

      const getParams = {
        TableName: this.tableName,
        Key: {
          poolAddress: this.POOL_CACHE_KEY(this.chainId, poolAddress),
          blockNumber: (await providerConfig?.blockNumber) ?? 0,
        },
      }
      const cachedPoolBinary = (await this.ddbClient.get(getParams).promise()).Item?.item
      const cachedPoolBuffer = Buffer.from(cachedPoolBinary)
      // TODO unmarshall the pool object
      const cachedPool: Pool = JSON.parse(cachedPoolBuffer.toString())

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
          // TODO: marshall the pool object
          const binaryCachedPool: Buffer = Buffer.from(JSON.stringify(pool))

          const putParams = {
            TableName: this.tableName,
            Item: {
              poolAddress: this.POOL_CACHE_KEY(this.chainId, address),
              blockNumber: (await providerConfig?.blockNumber) ?? 0,
              item: binaryCachedPool,
              ttl: this.ttlMinutes,
            },
          }

          this.ddbClient.put(putParams)
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
