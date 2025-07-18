import { log, V4SubgraphPool } from '@uniswap/smart-order-router'
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

      // USDT/USDC
      if (
        pool.id.toLowerCase() === '0xfcb95f2277ef9524fb6a2e2c38209a7a3b955c34c933d2cdb570c1e9240fc475'.toLowerCase() &&
        chainId === ChainId.MAINNET
      ) {
        pool.tvlETH = 400 // (https://bunni.xyz/explore/pools/mainnet/0xfcb95f2277ef9524fb6a2e2c38209a7a3b955c34c933d2cdb570c1e9240fc475)
        pool.tvlUSD = 800000 // (https://bunni.xyz/explore/pools/mainnet/0xfcb95f2277ef9524fb6a2e2c38209a7a3b955c34c933d2cdb570c1e9240fc475)
        additionalAllowedPool += 1
      }

      // USR/USDC
      if (
        pool.id.toLowerCase() === '0x77f73405a72f844e46d26a0bfd6f145c1a45ffcf6e4af5c86811405f29d2e615'.toLowerCase() &&
        chainId === ChainId.MAINNET
      ) {
        pool.tvlETH = 1500 // (https://bunni.xyz/explore/pools/mainnet/0x77f73405a72f844e46d26a0bfd6f145c1a45ffcf6e4af5c86811405f29d2e615)
        pool.tvlUSD = 3000000 // (https://bunni.xyz/explore/pools/mainnet/0x77f73405a72f844e46d26a0bfd6f145c1a45ffcf6e4af5c86811405f29d2e615)
        additionalAllowedPool += 1
      }

      // Flagship ETH-USDC 1.1
      if (
        pool.id.toLowerCase() === '0x278ade56e33a097c673da54989ab41bc66d79d8362c38e7c7f2ae76a1d4e4e9f'.toLowerCase() &&
        chainId === ChainId.BASE
      ) {
        pool.tvlETH = 210 // (https://bunni.xyz/explore/pools/ethereum/0x278ade56e33a097c673da54989ab41bc66d79d8362c38e7c7f2ae76a1d4e4e9f)
        pool.tvlUSD = 420000 // (https://bunni.xyz/explore/pools/ethereum/0x278ade56e33a097c673da54989ab41bc66d79d8362c38e7c7f2ae76a1d4e4e9f)
        additionalAllowedPool += 1
      }

      // USDC-USDT 1.0
      if (
        pool.id.toLowerCase() === '0x52820f86a8b193cbb46184b990085535e5956003b0005569649125cc070d14d0'.toLowerCase() &&
        chainId === ChainId.ARBITRUM_ONE
      ) {
        pool.tvlETH = 210 // (https://bunni.xyz/explore/pools/arbitrum/0x52820f86a8b193cbb46184b990085535e5956003b0005569649125cc070d14d0)
        pool.tvlUSD = 70000 // (https://bunni.xyz/explore/pools/arbitrum/0x52820f86a8b193cbb46184b990085535e5956003b0005569649125cc070d14d0)
        additionalAllowedPool += 1
      }

      // WETH-USDC 1.0
      if (
        pool.id.toLowerCase() === '0x278ade56e33a097c673da54989ab41bc66d79d8362c38e7c7f2ae76a1d4e4e9f'.toLowerCase() &&
        chainId === ChainId.BASE
      ) {
        pool.tvlETH = 1.5 // (https://bunni.xyz/explore/pools/base/0x278ade56e33a097c673da54989ab41bc66d79d8362c38e7c7f2ae76a1d4e4e9f)
        pool.tvlUSD = 3000 // (https://bunni.xyz/explore/pools/base/0x278ade56e33a097c673da54989ab41bc66d79d8362c38e7c7f2ae76a1d4e4e9f)
        additionalAllowedPool += 1
      }

      // ETH-wstETH 1.0
      if (
        pool.id.toLowerCase() === '0xccc788002cf655b20e41330bd9af113fd7df7cdebe68367574ea28cab1d59768'.toLowerCase() &&
        chainId === ChainId.MAINNET
      ) {
        pool.tvlETH = 400 // (https://bunni.xyz/explore/pools/mainnet/0xccc788002cf655b20e41330bd9af113fd7df7cdebe68367574ea28cab1d59768)
        pool.tvlUSD = 800000 // (https://bunni.xyz/explore/pools/mainnet/0xccc788002cf655b20e41330bd9af113fd7df7cdebe68367574ea28cab1d59768)
        additionalAllowedPool += 1
      }

      // ETH-wstETH 1.0
      if (
        pool.id.toLowerCase() === '0xcf3e20a072e6c74916da3e57086fa0f781ff54de4f060194e19aabf4dd94f55c'.toLowerCase() &&
        chainId === ChainId.ARBITRUM_ONE
      ) {
        pool.tvlETH = 300 // (https://bunni.xyz/explore/pools/arbitrum/0xcf3e20a072e6c74916da3e57086fa0f781ff54de4f060194e19aabf4dd94f55c)
        pool.tvlUSD = 600000 // (https://bunni.xyz/explore/pools/arbitrum/0xcf3e20a072e6c74916da3e57086fa0f781ff54de4f060194e19aabf4dd94f55c)
        additionalAllowedPool += 1
      }

      if (
        pool.id.toLowerCase() === '0x18851334c1315b5c92d577e50f3190e599ab6f7460b7859add5473f922c3bf54'.toLowerCase() &&
        chainId === ChainId.BASE
      ) {
        pool.tvlETH = 222 // (https://bunni.xyz/explore/pools/base/0x18851334c1315b5c92d577e50f3190e599ab6f7460b7859add5473f922c3bf54)
        pool.tvlUSD = 666666 // (https://bunni.xyz/explore/pools/base/0x18851334c1315b5c92d577e50f3190e599ab6f7460b7859add5473f922c3bf54)
        additionalAllowedPool += 1
      }

      if (
        pool.id.toLowerCase() === '0xeec51c6b1a9e7c4bb4fc4fa9a02fc4fff3fe94efd044f895d98b5bfbd2ff9433'.toLowerCase() &&
        chainId === ChainId.UNICHAIN
      ) {
        pool.tvlETH = 2292 // (https://bunni.xyz/explore/pools/unichain/0xeec51c6b1a9e7c4bb4fc4fa9a02fc4fff3fe94efd044f895d98b5bfbd2ff9433)
        pool.tvlUSD = 6190000 // (https://bunni.xyz/explore/pools/unichain/0xeec51c6b1a9e7c4bb4fc4fa9a02fc4fff3fe94efd044f895d98b5bfbd2ff9433)
        additionalAllowedPool += 1
      }

      if (
        pool.id.toLowerCase() === '0x9148f00424c4b40a9ec4b03912f091138e9e91a60980550ed97ed7f9dc998cb5'.toLowerCase() &&
        chainId === ChainId.MAINNET
      ) {
        pool.tvlETH = 73.45 // (https://bunni.xyz/explore/pools/mainnet/0x9148f00424c4b40a9ec4b03912f091138e9e91a60980550ed97ed7f9dc998cb5)
        pool.tvlUSD = 397080 // (https://bunni.xyz/explore/pools/mainnet/0x9148f00424c4b40a9ec4b03912f091138e9e91a60980550ed97ed7f9dc998cb5)
        additionalAllowedPool += 1
      }

      // BUNNI UNICHAIN ETH/weETH
      if (
        pool.id.toLowerCase() === '0x6923777072439713c7b8ab34903e0ea96078d7148449bf54f420320d59ede857'.toLowerCase() &&
        chainId === ChainId.UNICHAIN
      ) {
        pool.tvlETH = 1.13 // (https://bunni.xyz/explore/pools/unichain/0x6923777072439713c7b8ab34903e0ea96078d7148449bf54f420320d59ede857)
        pool.tvlUSD = 4100 // (https://bunni.xyz/explore/pools/unichain/0x6923777072439713c7b8ab34903e0ea96078d7148449bf54f420320d59ede857)
        log.info(`Setting tvl for Bunni Unichain ETH/weETH pool ${JSON.stringify(pool)}`)
        additionalAllowedPool += 1
      }

      // BUNNI BNB WETH/DOT
      if (
        pool.id.toLowerCase() === '0x48323603dde908bfbd512c4c723e28ea9c7ee7f5558f7bcc9cafa798c039b9bd'.toLowerCase() &&
        chainId === ChainId.BNB
      ) {
        pool.tvlETH = 0.7 // (https://bunni.xyz/explore/pools/bsc/0x48323603dde908bfbd512c4c723e28ea9c7ee7f5558f7bcc9cafa798c039b9bd)
        pool.tvlUSD = 2540 // (https://bunni.xyz/explore/pools/bsc/0x48323603dde908bfbd512c4c723e28ea9c7ee7f5558f7bcc9cafa798c039b9bd)
        log.info(`Setting tvl for Bunni BNB WETH/DOT pool ${JSON.stringify(pool)}`)
        additionalAllowedPool += 1
      }

      // BUNNI ARBITRUM USND/USDC
      if (
        pool.id.toLowerCase() === '0x75c55eda2c37c47eaf1db8b500171f72f23dc5b16404e904866a6ad1b3a3e537'.toLowerCase() &&
        chainId === ChainId.ARBITRUM_ONE
      ) {
        pool.tvlETH = 198.83 // (https://bunni.xyz/explore/pools/arbitrum/0x75c55eda2c37c47eaf1db8b500171f72f23dc5b16404e904866a6ad1b3a3e537)
        pool.tvlUSD = 716420 // (https://bunni.xyz/explore/pools/arbitrum/0x75c55eda2c37c47eaf1db8b500171f72f23dc5b16404e904866a6ad1b3a3e537)
        log.info(`Setting tvl for Bunni Arbitrum USND/USDC pool ${JSON.stringify(pool)}`)
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

  const allowlistedHooksPools = pools.filter((pool: V4SubgraphPool) => {
    return (
      HOOKS_ADDRESSES_ALLOWLIST[chainId].includes(pool.hooks.toLowerCase()) &&
      !topTvlPools.find((topPool: V4SubgraphPool) => topPool.id.toLowerCase() === pool.id.toLowerCase())
    )
  })

  return topTvlPools.concat(allowlistedHooksPools)
}
