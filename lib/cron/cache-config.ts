import { Protocol } from '@uniswap/router-sdk'
import { ChainId, V2SubgraphProvider, V3SubgraphProvider } from '@uniswap/smart-order-router'

export const chainProtocols = [
  // V3.
  {
    protocol: Protocol.V3,
    chainId: ChainId.MAINNET,
    timeout: 90000,
    provider: new V3SubgraphProvider(ChainId.MAINNET, 3, 90000),
  },
  {
    protocol: Protocol.V3,
    chainId: ChainId.ARBITRUM_ONE,
    timeout: 90000,
    provider: new V3SubgraphProvider(ChainId.ARBITRUM_ONE, 3, 90000),
  },
  {
    protocol: Protocol.V3,
    chainId: ChainId.POLYGON,
    timeout: 90000,
    provider: new V3SubgraphProvider(ChainId.POLYGON, 3, 90000),
  },
  {
    protocol: Protocol.V3,
    chainId: ChainId.CELO,
    timeout: 90000,
    provider: new V3SubgraphProvider(ChainId.CELO, 3, 90000),
  },
  // Currently there is no working V3 subgraph for Optimism so we use a static provider.
  // V2.

  {
    protocol: Protocol.V2,
    chainId: ChainId.MAINNET,
    timeout: 840000,
    provider: new V2SubgraphProvider(ChainId.MAINNET, 0, 840000),
  },
]
