import { isPoolFeeDynamic, log, nativeOnChain, V4SubgraphPool } from '@uniswap/smart-order-router'
import { Hook } from '@uniswap/v4-sdk'
import { HOOKS_ADDRESSES_ALLOWLIST, HOOK_POOLS_DATA } from './hooksAddressesAllowlist'
import { ChainId, Currency, Token } from '@uniswap/sdk-core'
import { PriorityQueue } from '@datastructures-js/priority-queue'
import { ADDRESS_ZERO } from '@uniswap/router-sdk'

type V4PoolGroupingKey = string
const TOP_GROUPED_V4_POOLS = 10

function convertV4PoolToGroupingKey(pool: V4SubgraphPool): V4PoolGroupingKey {
  return pool.token0.id.concat(pool.token1.id).concat(pool.feeTier)
}

function isHooksPoolRoutable(pool: V4SubgraphPool, chainId: ChainId): boolean {
  try {
    const tokenA: Currency =
      pool.token0.id === ADDRESS_ZERO
        ? nativeOnChain(chainId)
        : new Token(chainId, pool.token0.id, parseInt(pool.token0.decimals), pool.token0.symbol, pool.token0.name)
    const tokenB: Currency =
      pool.token1.id === ADDRESS_ZERO
        ? nativeOnChain(chainId)
        : new Token(chainId, pool.token1.id, parseInt(pool.token1.decimals), pool.token1.symbol, pool.token1.name)

    return (
      // if hook address is ADDRESS_ZERO, it means the pool is not a hooks pool
      pool.hooks === ADDRESS_ZERO ||
      (!Hook.hasSwapPermissions(pool.hooks) &&
        // If the fee tier is smaller than or equal to 100%, it means the pool is not dynamic fee pool.
        // Swap fee in total can be 100% (https://github.com/Uniswap/v4-core/blob/b619b6718e31aa5b4fa0286520c455ceb950276d/src/libraries/SwapMath.sol#L12)
        // Dynamic fee is at 0x800000 or 838.8608% fee tier.
        // Since pool manager doesn;t check the fee at 100% max during pool initialization (https://github.com/Uniswap/v4-core/blob/main/src/PoolManager.sol#L128)
        // it's more defensive programming to ensure the fee tier is less than or equal to 100%
        Number(pool.feeTier) <= 1000000 &&
        // ROUTE-606: Non-allowlisted hooks might make it in routing if dynamic fee
        // there's a chance dynamic fee has been updated to be <= 100%, but it's still a dyanmic fee hooked pool
        // in this case, the only way to track is to backtrack the computed pool id with 838% fee tier with the current pool id
        !isPoolFeeDynamic(tokenA, tokenB, pool))
    )
  } catch (e) {
    log.error(
      `Error creating tokens for pool ${pool.id} on chain ${chainId} with token0 decimals ${pool.token0.decimals} token1 decimals ${pool.token1.decimals}: ${e}`
    )

    // hardcode to 18 decimals since we cannot parse and pass the token invariant checks
    const tokenA: Currency =
      pool.token0.id === ADDRESS_ZERO
        ? nativeOnChain(chainId)
        : new Token(chainId, pool.token0.id, 18, pool.token0.symbol, pool.token0.name)
    // hardcode to 18 decimals since we cannot parse and pass the token invariant checks
    const tokenB: Currency =
      pool.token1.id === ADDRESS_ZERO
        ? nativeOnChain(chainId)
        : new Token(chainId, pool.token1.id, 18, pool.token1.symbol, pool.token1.name)

    return (
      // if hook address is ADDRESS_ZERO, it means the pool is not a hooks pool
      pool.hooks === ADDRESS_ZERO ||
      (!Hook.hasSwapPermissions(pool.hooks) &&
        // If the fee tier is smaller than or equal to 100%, it means the pool is not dynamic fee pool.
        // Swap fee in total can be 100% (https://github.com/Uniswap/v4-core/blob/b619b6718e31aa5b4fa0286520c455ceb950276d/src/libraries/SwapMath.sol#L12)
        // Dynamic fee is at 0x800000 or 838.8608% fee tier.
        // Since pool manager doesn;t check the fee at 100% max during pool initialization (https://github.com/Uniswap/v4-core/blob/main/src/PoolManager.sol#L128)
        // it's more defensive programming to ensure the fee tier is less than or equal to 100%
        Number(pool.feeTier) <= 1000000 &&
        // ROUTE-606: Non-allowlisted hooks might make it in routing if dynamic fee
        // there's a chance dynamic fee has been updated to be <= 100%, but it's still a dyanmic fee hooked pool
        // in this case, the only way to track is to backtrack the computed pool id with 838% fee tier with the current pool id
        !isPoolFeeDynamic(tokenA, tokenB, pool))
    )
  }
}

// it has to be a min heap in order to preserve the top eth tvl v4 pools
const V4SubgraphPoolComparator = (a: V4SubgraphPool, b: V4SubgraphPool) => {
  return a.tvlETH > b.tvlETH ? 1 : -1
}

export function v4HooksPoolsFiltering(chainId: ChainId, pools: Array<V4SubgraphPool>): Array<V4SubgraphPool> {
  const v4PoolsByTokenPairsAndFees: Record<V4PoolGroupingKey, PriorityQueue<V4SubgraphPool>> = {}

  pools.forEach((pool: V4SubgraphPool) => {
    if (isHooksPoolRoutable(pool, chainId)) {
      const v4Pools =
        v4PoolsByTokenPairsAndFees[convertV4PoolToGroupingKey(pool)] ??
        new PriorityQueue<V4SubgraphPool>(V4SubgraphPoolComparator)

      let additionalAllowedPool = 0

      // Check if this pool is in our approved hook pools list and has override TVL
      // If there is a non-zero override TVL, set the TVL of the pool to ensure it is considered by the routing algorithm
      const hookPoolData = HOOK_POOLS_DATA.find((poolData) => poolData.id.toLowerCase() === pool.id.toLowerCase())

      if (
        hookPoolData &&
        hookPoolData.tvlUSD !== undefined &&
        hookPoolData.tvlUSD > 0 &&
        hookPoolData.tvlETH !== undefined &&
        hookPoolData.tvlETH > 0
      ) {
        pool.tvlETH = hookPoolData.tvlETH
        pool.tvlUSD = hookPoolData.tvlUSD
        log.info(`Setting TVL for pool ${pool.id}: $${hookPoolData.tvlUSD}, ${hookPoolData.tvlETH} ETH`)
        additionalAllowedPool += 1
      }

      let shouldNotAddV4Pool = false

      // Check if this is a Zora pool by looking for "Zora" keyword in the allowlist
      const hookMetadata = HOOKS_ADDRESSES_ALLOWLIST[chainId].find((item) => item.address === pool.hooks.toLowerCase())

      const isZoraPool =
        chainId === ChainId.BASE &&
        hookMetadata &&
        hookMetadata.keywords.some((keyword) => keyword.toLowerCase().includes('zora'))
      if (isZoraPool) {
        if (pool.tvlETH <= 0.001) {
          shouldNotAddV4Pool = true
        }
      }

      if (!shouldNotAddV4Pool) {
        v4Pools.push(pool)
      }

      if (v4Pools.size() > TOP_GROUPED_V4_POOLS + additionalAllowedPool) {
        v4Pools.dequeue()
      }

      v4PoolsByTokenPairsAndFees[pool.token0.id.concat(pool.token1.id).concat(pool.feeTier)] = v4Pools
    }
  })

  const topTvlPools: Array<V4SubgraphPool> = []
  Object.values(v4PoolsByTokenPairsAndFees).forEach((pq: PriorityQueue<V4SubgraphPool>) => {
    topTvlPools.push(...pq.toArray())
  })

  // Create Sets for O(1) lookups in order to compute 'allowlistedHooksPools'
  const topTvlPoolIds = new Set(topTvlPools.map((pool) => pool.id.toLowerCase()))
  const allowlistedHooksAddresses = new Set(
    HOOKS_ADDRESSES_ALLOWLIST[chainId].map((hook) => hook.address.toLowerCase())
  )

  const allowlistedHooksPools = pools.filter((pool: V4SubgraphPool) => {
    return allowlistedHooksAddresses.has(pool.hooks.toLowerCase()) && !topTvlPoolIds.has(pool.id.toLowerCase())
  })

  return topTvlPools.concat(allowlistedHooksPools)
}
