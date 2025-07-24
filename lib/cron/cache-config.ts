import { Protocol } from '@uniswap/router-sdk'
import { V2SubgraphProvider, V3SubgraphProvider, V4SubgraphProvider } from '@uniswap/smart-order-router'
import { ChainId } from '@uniswap/sdk-core'

export const v4SubgraphUrlOverride = (chainId: ChainId) => {
  switch (chainId) {
    case ChainId.SEPOLIA:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/uniswap-v4-sepolia-test/api`
    case ChainId.ARBITRUM_ONE:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/arbitrum-v4/api`
    case ChainId.BASE:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/uniswap-v4-base/api`
    case ChainId.POLYGON:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/uniswap-v4-polygon/api`
    case ChainId.WORLDCHAIN:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/uniswap-v4-worldchain/api`
    case ChainId.ZORA:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/uniswap-v4-zora/api`
    case ChainId.UNICHAIN:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/uniswap-v4-unichain-mainnet/api`
    case ChainId.BNB:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/uniswap-v4-bsc/api`
    case ChainId.BLAST:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/uniswap-v4-blast/api`
    case ChainId.MAINNET:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/ethereum-v4/api`
    case ChainId.SONEIUM:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/uniswap-v4-soneium-mainnet/api`
    default:
      return undefined
  }
}
export const v3SubgraphUrlOverride = (chainId: ChainId) => {
  switch (chainId) {
    case ChainId.MAINNET:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/ethereum-v3/api`
    case ChainId.ARBITRUM_ONE:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/arbitrum-v4/api`
    case ChainId.POLYGON:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/uniswap-v3-polygon/api`
    case ChainId.OPTIMISM:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/uniswap-v3-optimism-ii/api`
    case ChainId.AVALANCHE:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/uniswap-v3-avalanche/api`
    case ChainId.BNB:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/uniswap-v3-bsc-ii/api`
    case ChainId.BLAST:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/uniswap-v3-blast/api`
    case ChainId.BASE:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/uniswap-v3-base/api`
    case ChainId.CELO:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/uniswap-v3-celo/api`
    case ChainId.WORLDCHAIN:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/uniswap-v3-worldchain/api`
    case ChainId.UNICHAIN_SEPOLIA:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/uniswap-v3-astrochain-sepolia/api`
    case ChainId.UNICHAIN:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/uniswap-v3-unichain-mainnet/api`
    case ChainId.ZORA:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/uniswap-v3-zora/api`
    case ChainId.SONEIUM:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/uniswap-v3-soneium-mainnet/api`
    default:
      return undefined
  }
}

export const v2SubgraphUrlOverride = (chainId: ChainId) => {
  switch (chainId) {
    case ChainId.MAINNET:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/ethereum-v2/api`
    case ChainId.ARBITRUM_ONE:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/arbitrum-v2/api`
    case ChainId.POLYGON:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/uniswap-v2-polygon/api`
    case ChainId.OPTIMISM:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/uniswap-v2-optimism/api`
    case ChainId.AVALANCHE:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/uniswap-v2-avalanche/api`
    case ChainId.BNB:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/uniswap-v2-bsc/api`
    case ChainId.BLAST:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/uniswap-v2-blast/api`
    case ChainId.BASE:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/uniswap-v2-base/api`
    case ChainId.WORLDCHAIN:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/uniswap-v2-worldchain/api`
    case ChainId.UNICHAIN_SEPOLIA:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/uniswap-v2-astrochain-sepolia/api`
    case ChainId.MONAD_TESTNET:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/uniswap-v2-monad-testnet/api`
    case ChainId.UNICHAIN:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/uniswap-v2-unichain-mainnet/api`
    case ChainId.SONEIUM:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/uniswap-v2-soneium-mainnet/api`
    default:
      return undefined
  }
}

const v4TrackedEthThreshold = 0.01 // Pools need at least 0.01 of trackedEth to be selected
const v4UntrackedUsdThreshold = 0 // v4 subgraph totalValueLockedUSDUntracked returns 0, even with the pools that have appropriate liqudities and correct pool pricing

export const v3TrackedEthThreshold = 0.01 // Pools need at least 0.01 of trackedEth to be selected
const v3UntrackedUsdThreshold = 25000 // Pools need at least 25K USD (untracked) to be selected (for metrics only)

export const v2TrackedEthThreshold = 0.025 // Pairs need at least 0.025 of trackedEth to be selected
const v2UntrackedUsdThreshold = Number.MAX_VALUE // Pairs need at least 1K USD (untracked) to be selected (for metrics only)

export const chainProtocols = [
  // V3.
  {
    protocol: Protocol.V3,
    chainId: ChainId.MAINNET,
    timeout: 90000,
    provider: new V3SubgraphProvider(
      ChainId.MAINNET,
      3,
      90000,
      true,
      v3TrackedEthThreshold,
      v3UntrackedUsdThreshold,
      v3SubgraphUrlOverride(ChainId.MAINNET)
    ),
  },
  {
    protocol: Protocol.V3,
    chainId: ChainId.ARBITRUM_ONE,
    timeout: 90000,
    provider: new V3SubgraphProvider(
      ChainId.ARBITRUM_ONE,
      5,
      90000,
      true,
      v3TrackedEthThreshold,
      v3UntrackedUsdThreshold,
      v3SubgraphUrlOverride(ChainId.ARBITRUM_ONE)
    ),
  },
  
  // V2.
  {
    protocol: Protocol.V2,
    chainId: ChainId.MAINNET,
    timeout: 840000,
    provider: new V2SubgraphProvider(
      ChainId.MAINNET,
      5,
      900000,
      true,
      1000,
      v2TrackedEthThreshold,
      v2UntrackedUsdThreshold,
      v2SubgraphUrlOverride(ChainId.MAINNET)
    ), // 1000 is the largest page size supported by thegraph
  },
  {
    protocol: Protocol.V2,
    chainId: ChainId.ARBITRUM_ONE,
    timeout: 90000,
    provider: new V2SubgraphProvider(
      ChainId.ARBITRUM_ONE,
      3,
      90000,
      true,
      1000,
      v2TrackedEthThreshold,
      v2UntrackedUsdThreshold,
      v2SubgraphUrlOverride(ChainId.ARBITRUM_ONE)
    ),
  },
  
  // V4
 
  {
    protocol: Protocol.V4,
    chainId: ChainId.MAINNET,
    timeout: 90000,
    provider: new V4SubgraphProvider(
      ChainId.MAINNET,
      3,
      90000,
      true,
      v4TrackedEthThreshold,
      v4UntrackedUsdThreshold,
      v4SubgraphUrlOverride(ChainId.MAINNET)
    ),
  },
  {
    protocol: Protocol.V4,
    chainId: ChainId.ARBITRUM_ONE,
    timeout: 90000,
    provider: new V4SubgraphProvider(
      ChainId.ARBITRUM_ONE,
      3,
      90000,
      true,
      v4TrackedEthThreshold,
      v4UntrackedUsdThreshold,
      v4SubgraphUrlOverride(ChainId.ARBITRUM_ONE)
    ),
  },
]
