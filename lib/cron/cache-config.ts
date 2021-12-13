import { Protocol } from '@uniswap/router-sdk'
import {
  ChainId,
  StaticV2SubgraphProvider,
  StaticV3SubgraphProvider,
  V2SubgraphProvider,
  V3SubgraphProvider,
} from '@uniswap/smart-order-router'

export const chainProtocols = [
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
    chainId: ChainId.OPTIMISM,
    provider: new V3SubgraphProvider(ChainId.OPTIMISM, 3, 90000),
  },
  // Currently there is no working V3 subgraph for Gorli, Kovan, Optimism Kovan, Arbitrum Rinkeby, so we use a static one.
  {
    protocol: Protocol.V3,
    chainId: ChainId.GÖRLI,
    provider: new StaticV3SubgraphProvider(ChainId.GÖRLI),
  },
  {
    protocol: Protocol.V3,
    chainId: ChainId.KOVAN,
    provider: new StaticV3SubgraphProvider(ChainId.KOVAN),
  },
  {
    protocol: Protocol.V3,
    chainId: ChainId.OPTIMISTIC_KOVAN,
    provider: new StaticV3SubgraphProvider(ChainId.OPTIMISTIC_KOVAN),
  },
  {
    protocol: Protocol.V3,
    chainId: ChainId.ARBITRUM_RINKEBY,
    provider: new StaticV3SubgraphProvider(ChainId.ARBITRUM_RINKEBY),
  },
  {
    protocol: Protocol.V2,
    chainId: ChainId.MAINNET,
    provider: new V2SubgraphProvider(ChainId.MAINNET, 2),
  },
  // Currently there is no working V2 subgraph for Rinkeby, Ropsten, Gorli or Kovan, so we use a static one.
  {
    protocol: Protocol.V2,
    chainId: ChainId.RINKEBY,
    provider: new StaticV2SubgraphProvider(ChainId.RINKEBY),
  },
  {
    protocol: Protocol.V2,
    chainId: ChainId.ROPSTEN,
    provider: new StaticV2SubgraphProvider(ChainId.ROPSTEN),
  },
  {
    protocol: Protocol.V2,
    chainId: ChainId.GÖRLI,
    provider: new StaticV2SubgraphProvider(ChainId.GÖRLI),
  },
  {
    protocol: Protocol.V2,
    chainId: ChainId.KOVAN,
    provider: new StaticV2SubgraphProvider(ChainId.KOVAN),
  },
]
