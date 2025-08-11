import { log, V4SubgraphPool } from '@uniswap/smart-order-router'
import { Hook } from '@uniswap/v4-sdk'
import { HOOKS_ADDRESSES_ALLOWLIST } from './hooksAddressesAllowlist'
import { ChainId } from '@uniswap/sdk-core'
import { PriorityQueue } from '@datastructures-js/priority-queue'
import { BUNNI_POOLS_CONFIG } from './bunni-pools'

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

      let additionalAllowedPool = 0

      // OPTIMISM ETH/WETH
      if (
        pool.id.toLowerCase() === '0xbf3d38951e485c811bb1fc7025fcd1ef60c15fda4c4163458facb9bedfe26f83'.toLowerCase() &&
        chainId === ChainId.OPTIMISM
      ) {
        pool.tvlETH = 826 // https://app.uniswap.org/explore/pools/optimism/0x1fb3cf6e48F1E7B10213E7b6d87D4c073C7Fdb7b
        pool.tvlUSD = 1482475 // https://app.uniswap.org/explore/pools/optimism/0x1fb3cf6e48F1E7B10213E7b6d87D4c073C7Fdb7b
        log.info(`Setting tvl for OPTIMISM ETH/WETH pool ${JSON.stringify(pool)}`)
        additionalAllowedPool += 1
      }

      // UNICHAIN ETH/WETH
      if (
        pool.id.toLowerCase() === '0xba246b8420b5aeb13e586cd7cbd32279fa7584d7f4cbc9bd356a6bb6200d16a6'.toLowerCase() &&
        chainId === ChainId.UNICHAIN
      ) {
        pool.tvlETH = 33482 // https://app.uniswap.org/explore/pools/unichain/0x3258f413c7a88cda2fa8709a589d221a80f6574f63df5a5b6774485d8acc39d9
        pool.tvlUSD = 60342168 // https://app.uniswap.org/explore/pools/unichain/0x3258f413c7a88cda2fa8709a589d221a80f6574f63df5a5b6774485d8acc39d9
        log.info(`Setting tvl for UNICHAIN ETH/WETH pool ${JSON.stringify(pool)}`)
        additionalAllowedPool += 1
      }

      // BASE ETH/WETH
      if (
        pool.id.toLowerCase() === '0xbb2aefc6c55a0464b944c0478869527ba1a537f05f90a1bb82e1196c6e9403e2'.toLowerCase() &&
        chainId === ChainId.BASE
      ) {
        pool.tvlETH = 6992 // https://app.uniswap.org/explore/pools/base/0xd0b53D9277642d899DF5C87A3966A349A798F224
        pool.tvlUSD = 12580000 // https://app.uniswap.org/explore/pools/base/0xd0b53D9277642d899DF5C87A3966A349A798F224
        log.info(`Setting tvl for BASE ETH/WETH pool ${JSON.stringify(pool)}`)
        additionalAllowedPool += 1
      }

      // ETH/flETH
      if (
        pool.id.toLowerCase() === '0x14287e3268eb628fcebd2d8f0730b01703109e112a7a41426a556d10211d2086'.toLowerCase() &&
        chainId === ChainId.BASE
      ) {
        pool.tvlETH = 1000 // similar to flETH/FLNCH pool (https://app.uniswap.org/explore/pools/base/0xf8f4afa64c443ff00630d089205140814c9c0ce79ff293d05913a161fcc7ec4a)
        pool.tvlUSD = 5500000 // similar to flETH/FLNCH pool (https://app.uniswap.org/explore/pools/base/0xf8f4afa64c443ff00630d089205140814c9c0ce79ff293d05913a161fcc7ec4a)
        log.info(`Setting tvl for flETH/FLNCH pool ${JSON.stringify(pool)}`)
        additionalAllowedPool += 1
      }

      // Check if this pool is in our Bunni pools configuration
      const bunniPool = BUNNI_POOLS_CONFIG.find(
        (config) => config.id.toLowerCase() === pool.id.toLowerCase() && config.chainId === chainId
      )

      if (bunniPool) {
        pool.tvlETH = bunniPool.tvlETH
        pool.tvlUSD = bunniPool.tvlUSD
        log.info(`Setting tvl for ${bunniPool.comment} pool ${JSON.stringify(pool)}`)
        additionalAllowedPool += 1
      }

      v4Pools.push(pool)

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
  const allowlistedHooksAddresses = new Set(HOOKS_ADDRESSES_ALLOWLIST[chainId].map((hook) => hook.toLowerCase()))

  const allowlistedHooksPools = pools.filter((pool: V4SubgraphPool) => {
    return allowlistedHooksAddresses.has(pool.hooks.toLowerCase()) && !topTvlPoolIds.has(pool.id.toLowerCase())
  })

  return topTvlPools.concat(allowlistedHooksPools)
}
