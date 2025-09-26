import { ChainId, Token } from '@juiceswapxyz/sdk-core'
import { FeeAmount, Pool } from '@juiceswapxyz/v3-sdk'
import { IV3PoolProvider, StaticV3SubgraphProvider, V3SubgraphPool } from '@juiceswapxyz/smart-order-router'
import JSBI from 'jsbi'
import { CITREA_STATIC_POOLS } from '../../util/citreaStaticPools'

export class CitreaStaticV3SubgraphProvider extends StaticV3SubgraphProvider {
  private poolCache = new Map<string, V3SubgraphPool[]>()
  private v3PoolProvider: IV3PoolProvider

  constructor(chainId: ChainId, poolProvider: IV3PoolProvider) {
    super(chainId, poolProvider)
    this.v3PoolProvider = poolProvider
  }

  public async getPools(
    tokenIn?: Token,
    tokenOut?: Token,
  ): Promise<V3SubgraphPool[]> {
    if (!tokenIn || !tokenOut) {
      return this.getStaticPools()
    }

    const tokenInAddress = tokenIn.address.toLowerCase()
    const tokenOutAddress = tokenOut.address.toLowerCase()

    const staticPools = this.getStaticPools()
    const staticMatches = staticPools.filter(pool => {
      const hasTokenIn = pool.token0.id === tokenInAddress || pool.token1.id === tokenInAddress
      const hasTokenOut = pool.token0.id === tokenOutAddress || pool.token1.id === tokenOutAddress
      return hasTokenIn && hasTokenOut
    })

    if (staticMatches.length > 0) {
      return staticMatches
    }

    const cacheKey = this.getCacheKey(tokenIn, tokenOut)
    const cached = this.poolCache.get(cacheKey)
    if (cached) {
      return cached
    }

    const discovered = await this.discoverPools(tokenIn, tokenOut)
    if (discovered.length > 0) {
      this.poolCache.set(cacheKey, discovered)
    }

    return discovered
  }

  private getStaticPools(): V3SubgraphPool[] {
    return CITREA_STATIC_POOLS.map(pool => {
      const [token0, token1] = pool.token0.address.toLowerCase() < pool.token1.address.toLowerCase()
        ? [pool.token0, pool.token1]
        : [pool.token1, pool.token0]

      return {
        id: `${token0.address.toLowerCase()}-${token1.address.toLowerCase()}-${pool.fee}`,
        feeTier: pool.fee.toString(),
        liquidity: pool.liquidity || '1000000000000000000',
        token0: {
          id: token0.address.toLowerCase(),
          symbol: token0.symbol,
          name: token0.name,
          decimals: token0.decimals.toString(),
        },
        token1: {
          id: token1.address.toLowerCase(),
          symbol: token1.symbol,
          name: token1.name,
          decimals: token1.decimals.toString(),
        },
        sqrtPrice: '0',
        tick: '0',
        tvlETH: 0,
        tvlUSD: 0,
      } as V3SubgraphPool
    })
  }

  private async discoverPools(tokenIn: Token, tokenOut: Token): Promise<V3SubgraphPool[]> {
    const FEE_TIERS = [FeeAmount.LOW, FeeAmount.MEDIUM, FeeAmount.HIGH]
    const tokenPairs: [Token, Token, FeeAmount][] = FEE_TIERS.map(fee => [tokenIn, tokenOut, fee])

    const poolAccessor = await this.v3PoolProvider.getPools(tokenPairs)
    const pools: V3SubgraphPool[] = []

    for (const fee of FEE_TIERS) {
      const pool = poolAccessor.getPool(tokenIn, tokenOut, fee)
      if (pool && JSBI.greaterThan(pool.liquidity, JSBI.BigInt(0))) {
        const poolAddress = Pool.getAddress(pool.token0, pool.token1, pool.fee)
        pools.push({
          id: poolAddress.toLowerCase(),
          feeTier: fee.toString(),
          liquidity: pool.liquidity.toString(),
          token0: {
            id: pool.token0.address.toLowerCase(),
            symbol: pool.token0.symbol!,
            name: pool.token0.name!,
            decimals: pool.token0.decimals.toString(),
          },
          token1: {
            id: pool.token1.address.toLowerCase(),
            symbol: pool.token1.symbol!,
            name: pool.token1.name!,
            decimals: pool.token1.decimals.toString(),
          },
          sqrtPrice: pool.sqrtRatioX96.toString(),
          tick: pool.tickCurrent.toString(),
          tvlETH: 0,
          tvlUSD: 0,
        } as V3SubgraphPool)
      }
    }

    return pools
  }

  private getCacheKey(tokenIn: Token, tokenOut: Token): string {
    const [addr0, addr1] = tokenIn.address.toLowerCase() < tokenOut.address.toLowerCase()
      ? [tokenIn.address.toLowerCase(), tokenOut.address.toLowerCase()]
      : [tokenOut.address.toLowerCase(), tokenIn.address.toLowerCase()]
    return `${addr0}-${addr1}`
  }
}