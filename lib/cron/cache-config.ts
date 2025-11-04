import { Protocol } from '@uniswap/router-sdk'
import { V2SubgraphProvider, V3SubgraphProvider, V4SubgraphProvider } from '@uniswap/smart-order-router'
import { ChainId } from '@uniswap/sdk-core'

// during local cdk stack update, the env vars are not populated
// make sure to fill in the env vars below
// we have two alchemy accounts to split the load, v3 and v4 subgraphs are on
// the second account while v2 is on the first
// process.env.ALCHEMY_QUERY_KEY = ''
// process.env.ALCHEMY_QUERY_KEY_2 = ''

// The Graph Gateway requires bearer token authentication
// Add this header to your subgraph requests
export const theGraphHeaders = () => {
  const apiKey = process.env.THEGRAPH_API_KEY
  if (!apiKey) {
    throw new Error('THEGRAPH_API_KEY environment variable is not set')
  }
  return {
    Authorization: `Bearer ${apiKey}`,
  }
}

export const v4SubgraphUrlOverride = (chainId: ChainId) => {
    switch (chainId) {
        case ChainId.SEPOLIA:
            return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/sepolia-v4/api`
        case ChainId.ARBITRUM_ONE:
            return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/arbitrum-v4/api`
        case ChainId.BASE:
            return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/base-v4/api`
        case ChainId.POLYGON:
            return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/polygon-v4/api`
        case ChainId.WORLDCHAIN:
            return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/worldchain-v4/api`
        case ChainId.ZORA:
            return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/zora-v4/api`
        case ChainId.UNICHAIN:
            return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/unichain-v4/api`
        case ChainId.BNB:
            return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/bsc-v4/api`
        case ChainId.BLAST:
            return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/blast-v4/api`
        case ChainId.MAINNET:
            return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/ethereum-v4/api`
        case ChainId.SONEIUM:
            return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/soneium-v4/api`
        case ChainId.AVALANCHE:
            return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/avalanche-v4/api`
        case ChainId.OPTIMISM:
            return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/bransfer/optimism-v4/api`
        default:
            return undefined
    }
}

// V3 Subgraph URLs using The Graph Gateway
// Replace SUBGRAPH_ID_PLACEHOLDER with actual subgraph IDs from The Graph
export const v3SubgraphUrlOverride = (chainId: ChainId) => {
    switch (chainId) {
        case ChainId.MAINNET:
            return `https://gateway.thegraph.com/api/subgraphs/id/SUBGRAPH_ID_PLACEHOLDER`
        case ChainId.ARBITRUM_ONE:
            return `https://gateway.thegraph.com/api/subgraphs/id/SUBGRAPH_ID_PLACEHOLDER`
        case ChainId.POLYGON:
            return `https://gateway.thegraph.com/api/subgraphs/id/SUBGRAPH_ID_PLACEHOLDER`
        case ChainId.OPTIMISM:
            return `https://gateway.thegraph.com/api/subgraphs/id/SUBGRAPH_ID_PLACEHOLDER`
        case ChainId.AVALANCHE:
            return `https://gateway.thegraph.com/api/subgraphs/id/SUBGRAPH_ID_PLACEHOLDER`
        case ChainId.BNB:
            return `https://gateway.thegraph.com/api/subgraphs/id/SUBGRAPH_ID_PLACEHOLDER`
        case ChainId.BLAST:
            return `https://gateway.thegraph.com/api/subgraphs/id/SUBGRAPH_ID_PLACEHOLDER`
        case ChainId.BASE:
            return `https://gateway.thegraph.com/api/subgraphs/id/SUBGRAPH_ID_PLACEHOLDER`
        case ChainId.CELO:
            return `https://gateway.thegraph.com/api/subgraphs/id/SUBGRAPH_ID_PLACEHOLDER`
        case ChainId.WORLDCHAIN:
            return `https://gateway.thegraph.com/api/subgraphs/id/SUBGRAPH_ID_PLACEHOLDER`
        case ChainId.UNICHAIN_SEPOLIA:
            return `https://gateway.thegraph.com/api/subgraphs/id/SUBGRAPH_ID_PLACEHOLDER`
        case ChainId.UNICHAIN:
            return `https://gateway.thegraph.com/api/subgraphs/id/SUBGRAPH_ID_PLACEHOLDER`
        case ChainId.ZORA:
            return `https://gateway.thegraph.com/api/subgraphs/id/SUBGRAPH_ID_PLACEHOLDER`
        case ChainId.SONEIUM:
            return `https://gateway.thegraph.com/api/subgraphs/id/SUBGRAPH_ID_PLACEHOLDER`
        default:
            return undefined
    }
}
// V2 Subgraph URLs using The Graph Gateway
// Replace SUBGRAPH_ID_PLACEHOLDER with actual subgraph IDs from The Graph
export const v2SubgraphUrlOverride = (chainId: ChainId) => {
    switch (chainId) {
        case ChainId.MAINNET:
            return `https://gateway.thegraph.com/api/subgraphs/id/SUBGRAPH_ID_PLACEHOLDER`
        case ChainId.ARBITRUM_ONE:
            return `https://gateway.thegraph.com/api/subgraphs/id/SUBGRAPH_ID_PLACEHOLDER`
        case ChainId.POLYGON:
            return `https://gateway.thegraph.com/api/subgraphs/id/SUBGRAPH_ID_PLACEHOLDER`
        case ChainId.OPTIMISM:
            return `https://gateway.thegraph.com/api/subgraphs/id/SUBGRAPH_ID_PLACEHOLDER`
        case ChainId.AVALANCHE:
            return `https://gateway.thegraph.com/api/subgraphs/id/SUBGRAPH_ID_PLACEHOLDER`
        case ChainId.BNB:
            return `https://gateway.thegraph.com/api/subgraphs/id/SUBGRAPH_ID_PLACEHOLDER`
        case ChainId.BLAST:
            return `https://gateway.thegraph.com/api/subgraphs/id/SUBGRAPH_ID_PLACEHOLDER`
        case ChainId.BASE:
            return `https://gateway.thegraph.com/api/subgraphs/id/SUBGRAPH_ID_PLACEHOLDER`
        case ChainId.WORLDCHAIN:
            return `https://gateway.thegraph.com/api/subgraphs/id/SUBGRAPH_ID_PLACEHOLDER`
        case ChainId.UNICHAIN_SEPOLIA:
            return `https://gateway.thegraph.com/api/subgraphs/id/SUBGRAPH_ID_PLACEHOLDER`
        case ChainId.MONAD_TESTNET:
            return `https://gateway.thegraph.com/api/subgraphs/id/SUBGRAPH_ID_PLACEHOLDER`
        case ChainId.UNICHAIN:
            return `https://gateway.thegraph.com/api/subgraphs/id/SUBGRAPH_ID_PLACEHOLDER`
        case ChainId.SONEIUM:
            return `https://gateway.thegraph.com/api/subgraphs/id/SUBGRAPH_ID_PLACEHOLDER`
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
            v3TrackedEthThreshold,
            v3UntrackedUsdThreshold,
            v3SubgraphUrlOverride(ChainId.BASE)
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
            5000,
            v2TrackedEthThreshold,
            v2UntrackedUsdThreshold,
            v2SubgraphUrlOverride(ChainId.BASE)
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
    {
        protocol: Protocol.V4,
        chainId: ChainId.BASE,
        timeout: 90000,
        provider: new V4SubgraphProvider(
            ChainId.BASE,
            3,
            90000,
            true,
            v4TrackedEthThreshold,
            v4UntrackedUsdThreshold,
            v4SubgraphUrlOverride(ChainId.BASE)
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
        chainId: ChainId.AVALANCHE,
        timeout: 90000,
        provider: new V4SubgraphProvider(
            ChainId.AVALANCHE,
            3,
            90000,
            true,
            v4TrackedEthThreshold,
            v4UntrackedUsdThreshold,
            v4SubgraphUrlOverride(ChainId.AVALANCHE)
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
    },
]