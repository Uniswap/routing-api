import { Protocol } from '@uniswap/router-sdk'
import { V2SubgraphProvider, V3SubgraphProvider, V4SubgraphProvider } from '@uniswap/smart-order-router'
import { ChainId } from '@uniswap/sdk-core'
import { EulerSwapHooksSubgraphProvider } from '@uniswap/smart-order-router/'

// during local cdk stack update, the env vars are not populated
// make sure to fill in the env vars below
// we have two alchemy accounts to split the load, v3 and v4 subgraphs are on
// the second account while v2 is on the first
// process.env.ALCHEMY_QUERY_KEY = ''
// process.env.ALCHEMY_QUERY_KEY_2 = ''

export const v4SubgraphUrlOverride = (chainId: ChainId) => {
  switch (chainId) {
    case ChainId.SEPOLIA:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v4-sepolia-test/api`
    case ChainId.ARBITRUM_ONE:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v4-arbitrum/api`
    case ChainId.BASE:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v4-base/api`
    case ChainId.POLYGON:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v4-polygon/api`
    case ChainId.WORLDCHAIN:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v4-worldchain/api`
    case ChainId.ZORA:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v4-zora/api`
    case ChainId.UNICHAIN:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v4-unichain-mainnet/api`
    case ChainId.BNB:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v4-bsc/api`
    case ChainId.BLAST:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v4-blast/api`
    case ChainId.MAINNET:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v4-mainnet/api`
    case ChainId.SONEIUM:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v4-soneium-mainnet/api`
    case ChainId.OPTIMISM:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v4-optimism/api`
    default:
      return undefined
  }
}

export const v3SubgraphUrlOverride = (chainId: ChainId) => {
  switch (chainId) {
    case ChainId.MAINNET:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v3-mainnet/api`
    case ChainId.ARBITRUM_ONE:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v3-arbitrum-ii/api`
    case ChainId.POLYGON:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v3-polygon/api`
    case ChainId.OPTIMISM:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v3-optimism-ii/api`
    case ChainId.AVALANCHE:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v3-avalanche/api`
    case ChainId.BNB:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v3-bsc-ii/api`
    case ChainId.BLAST:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v3-blast/api`
    case ChainId.BASE:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v3-base/api`
    case ChainId.CELO:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v3-celo/api`
    case ChainId.WORLDCHAIN:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v3-worldchain/api`
    case ChainId.UNICHAIN_SEPOLIA:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v3-astrochain-sepolia/api`
    case ChainId.UNICHAIN:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v3-unichain-mainnet/api`
    case ChainId.ZORA:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v3-zora/api`
    case ChainId.SONEIUM:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v3-soneium-mainnet/api`
    default:
      return undefined
  }
}

export const v2SubgraphUrlOverride = (chainId: ChainId) => {
  switch (chainId) {
    case ChainId.MAINNET:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/uniswap/uniswap-v2-mainnet/api`
    case ChainId.ARBITRUM_ONE:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/uniswap/uniswap-v2-arbitrum/api`
    case ChainId.POLYGON:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/uniswap/uniswap-v2-polygon/api`
    case ChainId.OPTIMISM:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/uniswap/uniswap-v2-optimism/api`
    case ChainId.AVALANCHE:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/uniswap/uniswap-v2-avalanche/api`
    case ChainId.BNB:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/uniswap/uniswap-v2-bsc/api`
    case ChainId.BLAST:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/uniswap/uniswap-v2-blast/api`
    case ChainId.BASE:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/uniswap/uniswap-v2-base/api`
    case ChainId.WORLDCHAIN:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/uniswap/uniswap-v2-worldchain/api`
    case ChainId.UNICHAIN_SEPOLIA:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/uniswap/uniswap-v2-astrochain-sepolia/api`
    case ChainId.MONAD_TESTNET:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/uniswap/uniswap-v2-monad-testnet/api`
    case ChainId.UNICHAIN:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/uniswap/uniswap-v2-unichain-mainnet/api`
    case ChainId.SONEIUM:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/uniswap/uniswap-v2-soneium-mainnet/api`
    default:
      return undefined
  }
}

const v4TrackedEthThreshold = 0.01 // Pools need at least 0.01 of trackedEth to be selected
const v4BaseTrackedEthThreshold = 0.1 // Pools on Base need at least 0.1 of trackedEth to be selected
const v4UntrackedUsdThreshold = 0 // v4 subgraph totalValueLockedUSDUntracked returns 0, even with the pools that have appropriate liqudities and correct pool pricing

export const v3TrackedEthThreshold = 0.01 // Pools need at least 0.01 of trackedEth to be selected
export const v3BaseTrackedEthThreshold = 0.1 // Pools on Base need at least 0.1 of trackedEth to be selected
const v3UntrackedUsdThreshold = 25000 // Pools need at least 25K USD (untracked) to be selected (for metrics only)

export const v2TrackedEthThreshold = 0.025 // Pairs need at least 0.025 of trackedEth to be selected
export const v2BaseTrackedEthThreshold = 0.1 // Pairs on Base need at least 0.1 of trackedEth to be selected
const v2UntrackedUsdThreshold = Number.MAX_VALUE // Pairs need at least 1K USD (untracked) to be selected (for metrics only)

export interface ChainProtocol {
  protocol: Protocol
  chainId: ChainId
  timeout: number
  provider: V2SubgraphProvider | V3SubgraphProvider | V4SubgraphProvider
  eulerHooksProvider?: EulerSwapHooksSubgraphProvider
}

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
  {
    protocol: Protocol.V3,
    chainId: ChainId.POLYGON,
    timeout: 90000,
    provider: new V3SubgraphProvider(
      ChainId.POLYGON,
      3,
      90000,
      true,
      v3TrackedEthThreshold,
      v3UntrackedUsdThreshold,
      v3SubgraphUrlOverride(ChainId.POLYGON)
    ),
  },
  // Waiting for Alchemy subgraph
  {
    protocol: Protocol.V3,
    chainId: ChainId.OPTIMISM,
    timeout: 90000,
    provider: new V3SubgraphProvider(
      ChainId.OPTIMISM,
      3,
      90000,
      true,
      v3TrackedEthThreshold,
      v3UntrackedUsdThreshold,
      v3SubgraphUrlOverride(ChainId.OPTIMISM)
    ),
  },
  {
    protocol: Protocol.V3,
    chainId: ChainId.CELO,
    timeout: 90000,
    provider: new V3SubgraphProvider(
      ChainId.CELO,
      3,
      90000,
      true,
      v3TrackedEthThreshold,
      v3UntrackedUsdThreshold,
      v3SubgraphUrlOverride(ChainId.CELO)
    ),
  },
  {
    protocol: Protocol.V3,
    chainId: ChainId.BNB,
    timeout: 90000,
    provider: new V3SubgraphProvider(
      ChainId.BNB,
      3,
      90000,
      true,
      v3TrackedEthThreshold,
      v3UntrackedUsdThreshold,
      v3SubgraphUrlOverride(ChainId.BNB)
    ),
  },
  {
    protocol: Protocol.V3,
    chainId: ChainId.AVALANCHE,
    timeout: 90000,
    provider: new V3SubgraphProvider(
      ChainId.AVALANCHE,
      3,
      90000,
      true,
      v3TrackedEthThreshold,
      v3UntrackedUsdThreshold,
      v3SubgraphUrlOverride(ChainId.AVALANCHE)
    ),
  },
  {
    protocol: Protocol.V3,
    chainId: ChainId.BASE,
    timeout: 90000,
    provider: new V3SubgraphProvider(
      ChainId.BASE,
      3,
      900000, // base has more pools than other chains, so we need to increase the timeout
      true,
      v3BaseTrackedEthThreshold,
      v3UntrackedUsdThreshold,
      v3SubgraphUrlOverride(ChainId.BASE)
    ),
  },
  {
    protocol: Protocol.V3,
    chainId: ChainId.BLAST,
    timeout: 90000,
    provider: new V3SubgraphProvider(
      ChainId.BLAST,
      3,
      90000,
      true,
      v3TrackedEthThreshold,
      v3UntrackedUsdThreshold,
      v3SubgraphUrlOverride(ChainId.BLAST)
    ),
  },
  {
    protocol: Protocol.V3,
    chainId: ChainId.UNICHAIN,
    timeout: 90000,
    provider: new V3SubgraphProvider(
      ChainId.UNICHAIN,
      3,
      90000,
      true,
      v3TrackedEthThreshold,
      v3UntrackedUsdThreshold,
      v3SubgraphUrlOverride(ChainId.UNICHAIN)
    ),
  },
  {
    protocol: Protocol.V3,
    chainId: ChainId.WORLDCHAIN,
    timeout: 90000,
    provider: new V3SubgraphProvider(
      ChainId.WORLDCHAIN,
      3,
      90000,
      true,
      v3TrackedEthThreshold,
      v3UntrackedUsdThreshold,
      v3SubgraphUrlOverride(ChainId.WORLDCHAIN)
    ),
  },
  {
    protocol: Protocol.V3,
    chainId: ChainId.ZORA,
    timeout: 90000,
    provider: new V3SubgraphProvider(
      ChainId.ZORA,
      3,
      360000, // zora has more pools than other chains, so we need to increase the timeout
      true,
      v3TrackedEthThreshold,
      v3UntrackedUsdThreshold,
      v3SubgraphUrlOverride(ChainId.ZORA)
    ),
  },
  {
    protocol: Protocol.V3,
    chainId: ChainId.SONEIUM,
    timeout: 90000,
    provider: new V3SubgraphProvider(
      ChainId.SONEIUM,
      3,
      90000,
      true,
      v3TrackedEthThreshold,
      v3UntrackedUsdThreshold,
      v3SubgraphUrlOverride(ChainId.SONEIUM)
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
  {
    protocol: Protocol.V2,
    chainId: ChainId.POLYGON,
    timeout: 90000,
    provider: new V2SubgraphProvider(
      ChainId.POLYGON,
      3,
      90000,
      true,
      1000,
      v2TrackedEthThreshold,
      v2UntrackedUsdThreshold,
      v2SubgraphUrlOverride(ChainId.POLYGON)
    ),
  },
  {
    protocol: Protocol.V2,
    chainId: ChainId.OPTIMISM,
    timeout: 90000,
    provider: new V2SubgraphProvider(
      ChainId.OPTIMISM,
      3,
      90000,
      true,
      1000,
      v2TrackedEthThreshold,
      v2UntrackedUsdThreshold,
      v2SubgraphUrlOverride(ChainId.OPTIMISM)
    ),
  },
  {
    protocol: Protocol.V2,
    chainId: ChainId.BNB,
    timeout: 90000,
    provider: new V2SubgraphProvider(
      ChainId.BNB,
      3,
      90000,
      true,
      1000,
      v2TrackedEthThreshold,
      v2UntrackedUsdThreshold,
      v2SubgraphUrlOverride(ChainId.BNB)
    ),
  },
  {
    protocol: Protocol.V2,
    chainId: ChainId.AVALANCHE,
    timeout: 90000,
    provider: new V2SubgraphProvider(
      ChainId.AVALANCHE,
      3,
      90000,
      true,
      1000,
      v2TrackedEthThreshold,
      v2UntrackedUsdThreshold,
      v2SubgraphUrlOverride(ChainId.AVALANCHE)
    ),
  },
  {
    protocol: Protocol.V2,
    chainId: ChainId.BASE,
    timeout: 840000,
    provider: new V2SubgraphProvider(
      ChainId.BASE,
      5,
      900000,
      true,
      10000,
      v2BaseTrackedEthThreshold,
      v2UntrackedUsdThreshold,
      v2SubgraphUrlOverride(ChainId.BASE)
    ),
  },
  {
    protocol: Protocol.V2,
    chainId: ChainId.BLAST,
    timeout: 90000,
    provider: new V2SubgraphProvider(
      ChainId.BLAST,
      3,
      90000,
      true,
      1000,
      v2TrackedEthThreshold,
      v2UntrackedUsdThreshold,
      v2SubgraphUrlOverride(ChainId.BLAST)
    ),
  },
  {
    protocol: Protocol.V2,
    chainId: ChainId.WORLDCHAIN,
    timeout: 90000,
    provider: new V2SubgraphProvider(
      ChainId.WORLDCHAIN,
      3,
      90000,
      true,
      1000,
      v2TrackedEthThreshold,
      v2UntrackedUsdThreshold,
      v2SubgraphUrlOverride(ChainId.WORLDCHAIN)
    ),
  },
  {
    protocol: Protocol.V2,
    chainId: ChainId.MONAD_TESTNET,
    timeout: 90000,
    provider: new V2SubgraphProvider(
      ChainId.MONAD_TESTNET,
      3,
      90000,
      true,
      1000,
      v2TrackedEthThreshold,
      v2UntrackedUsdThreshold,
      v2SubgraphUrlOverride(ChainId.MONAD_TESTNET)
    ),
  },
  {
    protocol: Protocol.V2,
    chainId: ChainId.UNICHAIN,
    timeout: 90000,
    provider: new V2SubgraphProvider(
      ChainId.UNICHAIN,
      3,
      90000,
      true,
      1000,
      v2TrackedEthThreshold,
      v2UntrackedUsdThreshold,
      v2SubgraphUrlOverride(ChainId.UNICHAIN)
    ),
  },
  {
    protocol: Protocol.V2,
    chainId: ChainId.SONEIUM,
    timeout: 90000,
    provider: new V2SubgraphProvider(
      ChainId.SONEIUM,
      3,
      90000,
      true,
      1000,
      v2TrackedEthThreshold,
      v2UntrackedUsdThreshold,
      v2SubgraphUrlOverride(ChainId.SONEIUM)
    ),
  },
  // V4
  {
    protocol: Protocol.V4,
    chainId: ChainId.SEPOLIA,
    timeout: 90000,
    provider: new V4SubgraphProvider(
      ChainId.SEPOLIA,
      3,
      90000,
      true,
      v4TrackedEthThreshold,
      v4UntrackedUsdThreshold,
      v4SubgraphUrlOverride(ChainId.SEPOLIA)
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
  {
    protocol: Protocol.V4,
    chainId: ChainId.BASE,
    timeout: 90000,
    provider: new V4SubgraphProvider(
      ChainId.BASE,
      3,
      90000,
      true,
      v4BaseTrackedEthThreshold,
      v4UntrackedUsdThreshold,
      v4SubgraphUrlOverride(ChainId.BASE)
    ),
  },
  {
    protocol: Protocol.V4,
    chainId: ChainId.POLYGON,
    timeout: 90000,
    provider: new V4SubgraphProvider(
      ChainId.POLYGON,
      3,
      90000,
      true,
      v4TrackedEthThreshold,
      v4UntrackedUsdThreshold,
      v4SubgraphUrlOverride(ChainId.POLYGON)
    ),
  },
  {
    protocol: Protocol.V4,
    chainId: ChainId.WORLDCHAIN,
    timeout: 90000,
    provider: new V4SubgraphProvider(
      ChainId.WORLDCHAIN,
      3,
      90000,
      true,
      v4TrackedEthThreshold,
      v4UntrackedUsdThreshold,
      v4SubgraphUrlOverride(ChainId.WORLDCHAIN)
    ),
  },
  {
    protocol: Protocol.V4,
    chainId: ChainId.ZORA,
    timeout: 90000,
    provider: new V4SubgraphProvider(
      ChainId.ZORA,
      3,
      90000,
      true,
      v4TrackedEthThreshold,
      v4UntrackedUsdThreshold,
      v4SubgraphUrlOverride(ChainId.ZORA)
    ),
  },
  {
    protocol: Protocol.V4,
    chainId: ChainId.UNICHAIN,
    timeout: 90000,
    provider: new V4SubgraphProvider(
      ChainId.UNICHAIN,
      3,
      90000,
      true,
      v4TrackedEthThreshold,
      v4UntrackedUsdThreshold,
      v4SubgraphUrlOverride(ChainId.UNICHAIN)
    ),
    eulerHooksProvider: new EulerSwapHooksSubgraphProvider(
      ChainId.UNICHAIN,
      3,
      90000,
      true,
      v4SubgraphUrlOverride(ChainId.UNICHAIN)
    ),
  },
  {
    protocol: Protocol.V4,
    chainId: ChainId.BLAST,
    timeout: 90000,
    provider: new V4SubgraphProvider(
      ChainId.BLAST,
      3,
      90000,
      true,
      v4TrackedEthThreshold,
      v4UntrackedUsdThreshold,
      v4SubgraphUrlOverride(ChainId.BLAST)
    ),
  },
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
    eulerHooksProvider: new EulerSwapHooksSubgraphProvider(
      ChainId.MAINNET,
      3,
      90000,
      true,
      v4SubgraphUrlOverride(ChainId.MAINNET)
    ),
  },
  {
    protocol: Protocol.V4,
    chainId: ChainId.SONEIUM,
    timeout: 90000,
    provider: new V4SubgraphProvider(
      ChainId.SONEIUM,
      3,
      90000,
      true,
      v4TrackedEthThreshold,
      v4UntrackedUsdThreshold,
      v4SubgraphUrlOverride(ChainId.SONEIUM)
    ),
  },
  {
    protocol: Protocol.V4,
    chainId: ChainId.OPTIMISM,
    timeout: 90000,
    provider: new V4SubgraphProvider(
      ChainId.OPTIMISM,
      3,
      90000,
      true,
      v4TrackedEthThreshold,
      v4UntrackedUsdThreshold,
      v4SubgraphUrlOverride(ChainId.OPTIMISM)
    ),
  },
  {
    protocol: Protocol.V4,
    chainId: ChainId.BNB,
    timeout: 90000,
    provider: new V4SubgraphProvider(
      ChainId.BNB,
      3,
      90000,
      true,
      v4TrackedEthThreshold,
      v4UntrackedUsdThreshold,
      v4SubgraphUrlOverride(ChainId.BNB)
    ),
  },
]
