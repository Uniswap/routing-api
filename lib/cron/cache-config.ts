import { Protocol } from '@uniswap/router-sdk'
import { ChainId } from '@uniswap/sdk-core'

export interface ChainProtocol {
  protocol: Protocol
  chainId: ChainId
}

// The (chain, protocol) lanes that have a pool cache object in S3. The quote
// path (injector-sor) consults this list to decide whether to read a chain's
// pools from the S3 cache or fall back to the static subgraph provider. The
// scheduled Lambdas that used to refresh these objects from the Goldsky /
// Alchemy / The Graph subgraphs have been removed; the objects in S3 are no
// longer refreshed.
export const chainProtocols: ChainProtocol[] = [
  { protocol: Protocol.V3, chainId: ChainId.MAINNET },
  { protocol: Protocol.V3, chainId: ChainId.ARBITRUM_ONE },
  { protocol: Protocol.V3, chainId: ChainId.POLYGON },
  { protocol: Protocol.V3, chainId: ChainId.OPTIMISM },
  { protocol: Protocol.V3, chainId: ChainId.CELO },
  { protocol: Protocol.V3, chainId: ChainId.BNB },
  { protocol: Protocol.V3, chainId: ChainId.AVALANCHE },
  { protocol: Protocol.V3, chainId: ChainId.BASE },
  { protocol: Protocol.V3, chainId: ChainId.BLAST },
  { protocol: Protocol.V3, chainId: ChainId.UNICHAIN },
  { protocol: Protocol.V3, chainId: ChainId.WORLDCHAIN },
  { protocol: Protocol.V3, chainId: ChainId.ZORA },
  { protocol: Protocol.V3, chainId: ChainId.SONEIUM },
  { protocol: Protocol.V3, chainId: ChainId.MONAD },
  { protocol: Protocol.V3, chainId: ChainId.TEMPO },
  { protocol: Protocol.V3, chainId: ChainId.XLAYER },
  { protocol: Protocol.V3, chainId: ChainId.LINEA },
  { protocol: Protocol.V2, chainId: ChainId.MAINNET },
  { protocol: Protocol.V2, chainId: ChainId.ARBITRUM_ONE },
  { protocol: Protocol.V2, chainId: ChainId.POLYGON },
  { protocol: Protocol.V2, chainId: ChainId.OPTIMISM },
  { protocol: Protocol.V2, chainId: ChainId.BNB },
  { protocol: Protocol.V2, chainId: ChainId.AVALANCHE },
  { protocol: Protocol.V2, chainId: ChainId.BASE },
  { protocol: Protocol.V2, chainId: ChainId.BLAST },
  { protocol: Protocol.V2, chainId: ChainId.WORLDCHAIN },
  { protocol: Protocol.V2, chainId: ChainId.MONAD_TESTNET },
  { protocol: Protocol.V2, chainId: ChainId.UNICHAIN },
  { protocol: Protocol.V2, chainId: ChainId.SONEIUM },
  { protocol: Protocol.V2, chainId: ChainId.MONAD },
  { protocol: Protocol.V2, chainId: ChainId.TEMPO },
  { protocol: Protocol.V2, chainId: ChainId.XLAYER },
  { protocol: Protocol.V2, chainId: ChainId.LINEA },
  { protocol: Protocol.V4, chainId: ChainId.SEPOLIA },
  { protocol: Protocol.V4, chainId: ChainId.ARBITRUM_ONE },
  { protocol: Protocol.V4, chainId: ChainId.BASE },
  { protocol: Protocol.V4, chainId: ChainId.POLYGON },
  { protocol: Protocol.V4, chainId: ChainId.WORLDCHAIN },
  { protocol: Protocol.V4, chainId: ChainId.ZORA },
  { protocol: Protocol.V4, chainId: ChainId.UNICHAIN },
  { protocol: Protocol.V4, chainId: ChainId.BLAST },
  { protocol: Protocol.V4, chainId: ChainId.MAINNET },
  { protocol: Protocol.V4, chainId: ChainId.SONEIUM },
  { protocol: Protocol.V4, chainId: ChainId.OPTIMISM },
  { protocol: Protocol.V4, chainId: ChainId.BNB },
  { protocol: Protocol.V4, chainId: ChainId.MONAD },
  { protocol: Protocol.V4, chainId: ChainId.TEMPO },
  { protocol: Protocol.V4, chainId: ChainId.XLAYER },
  { protocol: Protocol.V4, chainId: ChainId.AVALANCHE },
  { protocol: Protocol.V4, chainId: ChainId.LINEA },
]
