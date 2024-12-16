import { Protocol } from '@uniswap/router-sdk';
import { V2SubgraphProvider, V3SubgraphProvider, V4SubgraphProvider } from '@uniswap/smart-order-router';
import { ChainId } from '@uniswap/sdk-core';

// during local cdk stack update, the env vars are not populated
// make sure to fill in the env vars below
// process.env.ALCHEMY_QUERY_KEY = ''

const SUBGRAPH_CONFIG = {
  v4: { trackedEthThreshold: 0.01, untrackedUsdThreshold: 0 },
  v3: { trackedEthThreshold: 0.01, untrackedUsdThreshold: 25000 },
  v2: { trackedEthThreshold: 0.025, untrackedUsdThreshold: Number.MAX_VALUE, pageSize: 1000 },
};

const TIMEOUTS = {
  v2: {
    MAINNET: 840000,
    DEFAULT: 90000,
  },
  v3: 90000,
  v4: 90000,
};

const CHAIN_MAP: Record<ChainId, { v2: string; v3: string; timeout?: number }> = {
  [ChainId.MAINNET]: { v2: 'mainnet', v3: 'mainnet', timeout: TIMEOUTS.v2.MAINNET },
  [ChainId.ARBITRUM_ONE]: { v2: 'arbitrum', v3: 'arbitrum-ii' },
  [ChainId.POLYGON]: { v2: 'polygon', v3: 'polygon' },
  [ChainId.OPTIMISM]: { v2: 'optimism', v3: 'optimism-ii' },
  [ChainId.AVALANCHE]: { v2: 'avalanche', v3: 'avalanche' },
  [ChainId.BNB]: { v2: 'bsc', v3: 'bsc-ii' },
  [ChainId.BLAST]: { v2: 'blast', v3: 'blast' },
  [ChainId.BASE]: { v2: 'base', v3: 'base', timeout: TIMEOUTS.v2.MAINNET },
  [ChainId.CELO]: { v2: 'celo', v3: 'celo' },
  [ChainId.WORLDCHAIN]: { v2: 'worldchain', v3: 'worldchain' },
  [ChainId.ASTROCHAIN_SEPOLIA]: { v2: 'astrochain-sepolia', v3: 'astrochain-sepolia' },
};

const createSubgraphUrl = (chain: string, version: string) =>
  `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/uniswap/uniswap-${version}-${chain}/api`;

const getSubgraphUrl = (version: 'v2' | 'v3', chainId: ChainId) => {
  const chainInfo = CHAIN_MAP[chainId];
  return chainInfo ? createSubgraphUrl(chainInfo[version], version) : undefined;
};

const v4SubgraphUrlOverride = (chainId: ChainId) =>
  chainId === ChainId.SEPOLIA ? createSubgraphUrl('sepolia-test', 'v4') : undefined;

const createProviderConfig = (
  protocol: Protocol,
  chainId: ChainId,
  version: 'v2' | 'v3' | 'v4',
  thresholds: { trackedEthThreshold: number; untrackedUsdThreshold: number },
  timeout: number,
  pageSize?: number
) => ({
  protocol,
  chainId,
  timeout,
  provider: new (version === 'v4' ? V4SubgraphProvider : version === 'v3' ? V3SubgraphProvider : V2SubgraphProvider)(
    chainId,
    version === 'v2' ? (pageSize || 3) : 3, // V2 pageSize = 1000, others = 3
    timeout,
    true,
    thresholds.trackedEthThreshold,
    thresholds.untrackedUsdThreshold,
    version === 'v4' ? v4SubgraphUrlOverride(chainId) : getSubgraphUrl(version, chainId)
  ),
});

export const chainProtocols = [
  // V3 Protocols
  ...Object.keys(CHAIN_MAP).map((chainId) =>
    createProviderConfig(
      Protocol.V3,
      parseInt(chainId, 10),
      'v3',
      SUBGRAPH_CONFIG.v3,
      TIMEOUTS.v3
    )
  ),

  // V2 Protocols
  ...Object.keys(CHAIN_MAP).map((chainId) => {
    const parsedChainId = parseInt(chainId, 10);
    const timeout = CHAIN_MAP[parsedChainId]?.timeout || TIMEOUTS.v2.DEFAULT;
    return createProviderConfig(
      Protocol.V2,
      parsedChainId,
      'v2',
      SUBGRAPH_CONFIG.v2,
      timeout,
      SUBGRAPH_CONFIG.v2.pageSize
    );
  }),

  // V4 Protocol (Sepolia only)
  createProviderConfig(
    Protocol.V4,
    ChainId.SEPOLIA,
    'v4',
    SUBGRAPH_CONFIG.v4,
    TIMEOUTS.v4
  ),
];
