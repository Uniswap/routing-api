import { Protocol } from '@uniswap/router-sdk'
import { ChainId, V2SubgraphProvider, V3SubgraphProvider } from '@uniswap/smart-order-router'

export const chainProtocols = [
  // V3.
  {
    protocol: Protocol.V3,
    chainId: ChainId.MAINNET,
    provider: new V3SubgraphProvider(ChainId.MAINNET, 3, 90000),
  },
  {
    protocol: Protocol.V3,
    chainId: ChainId.RINKEBY,
    provider: new V3SubgraphProvider(ChainId.RINKEBY, 3, 90000),
  },
  {
    protocol: Protocol.V3,
    chainId: ChainId.ARBITRUM_ONE,
    provider: new V3SubgraphProvider(ChainId.ARBITRUM_ONE, 3, 90000),
  },
  {
    protocol: Protocol.V3,
    chainId: ChainId.POLYGON,
    provider: new V3SubgraphProvider(ChainId.POLYGON, 3, 90000),
  },
  {
    protocol: Protocol.V3,
    chainId: ChainId.GÖRLI,
    provider: new V3SubgraphProvider(ChainId.GÖRLI, 3, 90000),
  },
  {
    protocol: Protocol.V3,
    chainId: ChainId.CELO,
    provider: new V3SubgraphProvider(ChainId.CELO, 3, 90000),
  },
  // Currently there is no working V3 subgraph for Kovan, Optimism, Optimism Kovan, Arbitrum Rinkeby, so we use static providers.
  // V2.
  {
    protocol: Protocol.V2,
    chainId: ChainId.MAINNET,
    provider: new V2SubgraphProvider(ChainId.MAINNET, 2),
  },
  // Currently there is no working V2 subgraph for Rinkeby, Ropsten, Gorli or Kovan, so we use static providers.
]
