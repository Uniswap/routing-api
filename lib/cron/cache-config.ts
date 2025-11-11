import { Protocol } from '@uniswap/router-sdk'
import { V3SubgraphProvider } from '@uniswap/smart-order-router'
import { ChainId } from '@uniswap/sdk-core'
import { ZK_EVM_TESTNET_CHAIN_ID } from '../constants/zk-evm'

// V3 subgraph URL override - reads from environment variable for zkEVM testnet
export const v3SubgraphUrlOverride = (chainId: number) => {
  switch (chainId) {
    case ZK_EVM_TESTNET_CHAIN_ID:
      return process.env.V3_SUBGRAPH_URL || ''
    default:
      return undefined
  }
}

// V3 pool selection thresholds
export const v3TrackedEthThreshold = 0.01 // Pools need at least 0.01 of trackedEth to be selected
const v3UntrackedUsdThreshold = 25000 // Pools need at least 25K USD (untracked) to be selected (for metrics only)

export interface ChainProtocol {
  protocol: Protocol
  chainId: ChainId
  timeout: number
  provider: V3SubgraphProvider
}

// V3-only protocol configuration for zkEVM testnet
export const chainProtocols: ChainProtocol[] = [
  {
    protocol: Protocol.V3,
    chainId: ZK_EVM_TESTNET_CHAIN_ID,
    timeout: 90000,
    provider: new V3SubgraphProvider(
      ZK_EVM_TESTNET_CHAIN_ID,
      3,
      90000,
      true,
      v3TrackedEthThreshold,
      v3UntrackedUsdThreshold,
      v3SubgraphUrlOverride(ZK_EVM_TESTNET_CHAIN_ID)
    ),
  },
]
