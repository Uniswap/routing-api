import { Protocol } from '@pollum-io/router-sdk'
import {
  ChainId,
  // V2SubgraphProvider,
  V3SubgraphProvider,
} from '@pollum-io/smart-order-router'

export const chainProtocols = [
  // V3.
  {
    protocol: Protocol.V3,
    chainId: ChainId.ROLLUX,
    timeout: 90000,
    provider: new V3SubgraphProvider(ChainId.ROLLUX, 3, 90000),
  },
  // {
  //   protocol: Protocol.V2,
  //   chainId: ChainId.ARBITRUM_ONE,
  //   timeout: 90000,
  //   provider: new V3SubgraphProvider(ChainId.ARBITRUM_ONE, 3, 90000),
  // },
  // {
  //   protocol: Protocol.V2,
  //   chainId: ChainId.POLYGON,
  //   timeout: 90000,
  //   provider: new V3SubgraphProvider(ChainId.POLYGON, 3, 90000),
  // },
  // {
  //   protocol: Protocol.V2,
  //   chainId: ChainId.CELO,
  //   timeout: 90000,
  //   provider: new V3SubgraphProvider(ChainId.CELO, 3, 90000),
  // },
  // {
  //   protocol: Protocol.V2,
  //   chainId: ChainId.BSC,
  //   timeout: 90000,
  //   provider: new V3SubgraphProvider(ChainId.BSC, 3, 90000),
  // },
  // // Currently there is no working V3 subgraph for Optimism so we use a static provider.
  // // V2.
  // {
  //   protocol: Protocol.V1,
  //   chainId: ChainId.MAINNET,
  //   timeout: 840000,
  //   provider: new V2SubgraphProvider(ChainId.MAINNET, 3, 900000, true, 250),
  // },
]
