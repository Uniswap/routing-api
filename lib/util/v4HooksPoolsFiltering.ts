import { V4SubgraphPool } from '@uniswap/smart-order-router'
import { Hook } from '@uniswap/v4-sdk'
import { HOOKS_ADDRESSES_ALLOWLIST } from './hooksAddressesAllowlist'
import { ChainId } from '@uniswap/sdk-core'
import { PriorityQueue } from '@datastructures-js/priority-queue'

type V4PoolGroupingKey = string
const TOP_GROUPED_V4_POOLS = 10

function convertV4PoolToGroupingKey(pool: V4SubgraphPool): V4PoolGroupingKey {
  return pool.token0.id.concat(pool.token1.id).concat(pool.feeTier)
}

function isHooksPoolRoutable(pool: V4SubgraphPool): boolean {
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

// it has to be a min heap in order to preserve the top eth tvl v4 pools
const V4SubgraphPoolComparator = (a: V4SubgraphPool, b: V4SubgraphPool) => {
  return a.tvlETH > b.tvlETH ? 1 : -1
}

export function v4HooksPoolsFiltering(chainId: ChainId, pools: Array<V4SubgraphPool>): Array<V4SubgraphPool> {
  const v4PoolsByTokenPairsAndFees: Record<V4PoolGroupingKey, PriorityQueue<V4SubgraphPool>> = {}

  pools.forEach((pool: V4SubgraphPool) => {
    if (isHooksPoolRoutable(pool)) {
      const v4Pools =
        v4PoolsByTokenPairsAndFees[convertV4PoolToGroupingKey(pool)] ??
        new PriorityQueue<V4SubgraphPool>(V4SubgraphPoolComparator)

      v4Pools.push(pool)

      if (v4Pools.size() > TOP_GROUPED_V4_POOLS) {
        v4Pools.dequeue()
      }

      v4PoolsByTokenPairsAndFees[pool.token0.id.concat(pool.token1.id).concat(pool.feeTier)] = v4Pools
    }
  })

  const topTvlPools: Array<V4SubgraphPool> = []
  Object.values(v4PoolsByTokenPairsAndFees).forEach((pq: PriorityQueue<V4SubgraphPool>) => {
    topTvlPools.push(...pq.toArray())
  })

  const allowlistedHooksPools = pools.filter((pool: V4SubgraphPool) => {
    return (
      HOOKS_ADDRESSES_ALLOWLIST[chainId].includes(pool.hooks.toLowerCase()) &&
      !topTvlPools.find((topPool: V4SubgraphPool) => topPool.id.toLowerCase() === pool.id.toLowerCase())
    )
  })

  return topTvlPools.concat(allowlistedHooksPools)
}
