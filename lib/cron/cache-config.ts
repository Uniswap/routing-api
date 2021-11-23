import { Protocol } from '@uniswap/router-sdk'
import { ChainId, StaticV2SubgraphProvider, V2SubgraphProvider, V3SubgraphProvider } from '@uniswap/smart-order-router'

export const chainProtocols = [
  {
    protocol: Protocol.V3,
    chainId: ChainId.MAINNET,
    provider: new V3SubgraphProvider(ChainId.MAINNET, 3, 90000),
    ipfsFilename: 'mainnet.json',
  },
  {
    protocol: Protocol.V3,
    chainId: ChainId.RINKEBY,
    provider: new V3SubgraphProvider(ChainId.RINKEBY, 3, 90000),
    ipfsFilename: 'rinkeby.json',
  },
  {
    protocol: Protocol.V2,
    chainId: ChainId.MAINNET,
    provider: new V2SubgraphProvider(ChainId.MAINNET, 2),
    ipfsFilename: 'mainnet.json',
  },
  // Currently there is no working subgraph for Rinkeby, so we use a static one.
  {
    protocol: Protocol.V2,
    chainId: ChainId.RINKEBY,
    provider: new StaticV2SubgraphProvider(ChainId.RINKEBY),
    ipfsFilename: 'rinkeby.json',
  },
]
