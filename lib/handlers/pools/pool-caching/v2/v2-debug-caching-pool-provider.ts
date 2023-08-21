import { IV2PoolProvider, V2PoolAccessor } from '@uniswap/smart-order-router'
import { Token } from '@uniswap/sdk-core'
import { ProviderConfig } from '@uniswap/smart-order-router/build/main/providers/provider'

export class V2DebugCachingPoolProvider implements IV2PoolProvider {
  cachingPoolProvider: IV2PoolProvider
  poolProvider: IV2PoolProvider

  constructor(cachingPoolProvider: IV2PoolProvider, poolProvider: IV2PoolProvider) {
    this.cachingPoolProvider = cachingPoolProvider
    this.poolProvider = poolProvider
  }

  getPoolAddress(tokenA: Token, tokenB: Token): { poolAddress: string; token0: Token; token1: Token } {
    // this is in-memory operation, can just use the existing non-caching pool provider
    return this.poolProvider.getPoolAddress(tokenA, tokenB)
  }

  getPools(tokenPairs: [Token, Token][], providerConfig?: ProviderConfig): Promise<V2PoolAccessor> {
    if (providerConfig?.debugRouting) {
      return this.cachingPoolProvider.getPools(tokenPairs, providerConfig)
    } else {
      return this.poolProvider.getPools(tokenPairs, providerConfig)
    }
  }
}
