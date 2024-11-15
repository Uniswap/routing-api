import { V2SubgraphPool, V3SubgraphPool, V4SubgraphPool } from '@uniswap/smart-order-router'
import { Hook } from '@uniswap/v4-sdk'
import { HOOKS_ADDRESSES_ALLOWLIST } from '../../lib/util/hooksAddressesAllowlist'
import { ChainId } from '@uniswap/sdk-core'

export function routableHooks(pool: V4SubgraphPool): boolean {
  return (
    !Hook.hasSwapPermissions(pool.hooks) &&
    // If the fee tier is smaller than or equal to 100%, it means the pool is not dynamic fee pool.
    // Swap fee in total can be 100% (https://github.com/Uniswap/v4-core/blob/b619b6718e31aa5b4fa0286520c455ceb950276d/src/libraries/SwapMath.sol#L12)
    // Dynamic fee is at 0x800000 or 838.8608% fee tier.
    // Since pool manager doesn;t check the fee at 100% max during pool initialization (https://github.com/Uniswap/v4-core/blob/main/src/PoolManager.sol#L128)
    // it's more defensive programming to ensure the fee tier is less than or equal to 100%
    Number(pool.feeTier) <= 1000000
  )
}

export function v4HooksPoolsFiltering(
  chainId: ChainId,
  pools: Array<V4SubgraphPool | V3SubgraphPool | V2SubgraphPool>
): Array<V4SubgraphPool> {
  const v4PoolsByTokenPairsAndFees: Record<string, Array<V4SubgraphPool>> = {}

  ;(pools as Array<V4SubgraphPool>).forEach((pool: V4SubgraphPool) => {
    if (routableHooks(pool)) {
      const v4Pools = v4PoolsByTokenPairsAndFees[pool.token0.id.concat(pool.token1.id).concat(pool.feeTier)] || []

      v4Pools.push(pool)
      v4Pools.sort((a, b) => (a.tvlETH > b.tvlETH ? -1 : 1))

      if (v4Pools.length > 10) {
        v4Pools.pop()
      }

      v4PoolsByTokenPairsAndFees[pool.token0.id.concat(pool.token1.id).concat(pool.feeTier)] = v4Pools
    }
  })

  const topTvlPools = Object.values(v4PoolsByTokenPairsAndFees).reduce((acc, pools) => {
    return acc.concat(pools)
  })

  const allowlistedHooksPools = (pools as Array<V4SubgraphPool>).filter((pool: V4SubgraphPool) => {
    const shouldFilterOut = !HOOKS_ADDRESSES_ALLOWLIST[chainId].includes(pool.hooks.toLowerCase())

    return !shouldFilterOut
  })

  return topTvlPools.concat(allowlistedHooksPools)
}
