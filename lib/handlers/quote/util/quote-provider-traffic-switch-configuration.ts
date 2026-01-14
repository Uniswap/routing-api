import { ChainId } from '@uniswap/sdk-core'
import { Protocol } from '@uniswap/router-sdk'

export type QuoteProviderTrafficSwitchConfiguration = {
  switchExactInPercentage: number
  samplingExactInPercentage: number
  switchExactOutPercentage: number
  samplingExactOutPercentage: number
}

export const QUOTE_PROVIDER_TRAFFIC_SWITCH_CONFIGURATION = (
  chainId: ChainId,
  protocol: Protocol // only v3 and mixed on L1 is alive, once it needs to live switch 100%, otherwise, can have 0% switch
): QuoteProviderTrafficSwitchConfiguration => {
  switch (chainId) {
    // Mumbai was deprecated on April 13th. Do not sample at all
    case ChainId.POLYGON_MUMBAI:
      switch (protocol) {
        case Protocol.MIXED:
        case Protocol.V4:
          return {
            switchExactInPercentage: 0.0,
            samplingExactInPercentage: 0,
            switchExactOutPercentage: 0.0,
            samplingExactOutPercentage: 0,
          } as QuoteProviderTrafficSwitchConfiguration
        default:
          return {
            switchExactInPercentage: 0.0,
            samplingExactInPercentage: 0,
            switchExactOutPercentage: 0.0,
            samplingExactOutPercentage: 0,
          } as QuoteProviderTrafficSwitchConfiguration
      }
    // Sepolia together have well below 50 RPM, so we can shadow sample 100% of traffic
    case ChainId.SEPOLIA:
      switch (protocol) {
        case Protocol.MIXED:
        case Protocol.V4:
          return {
            switchExactInPercentage: 100,
            samplingExactInPercentage: 0,
            switchExactOutPercentage: 100,
            samplingExactOutPercentage: 0,
          } as QuoteProviderTrafficSwitchConfiguration
        default:
          return {
            switchExactInPercentage: 0.0,
            samplingExactInPercentage: 100,
            switchExactOutPercentage: 0.0,
            samplingExactOutPercentage: 100,
          } as QuoteProviderTrafficSwitchConfiguration
      }
    case ChainId.BASE:
      switch (protocol) {
        // only base as L2 has mixed quoter v1 deployed
        case Protocol.MIXED:
          return {
            switchExactInPercentage: 0,
            samplingExactInPercentage: 1,
            switchExactOutPercentage: 0,
            samplingExactOutPercentage: 1,
          } as QuoteProviderTrafficSwitchConfiguration
        case Protocol.V4:
          return {
            switchExactInPercentage: 0,
            samplingExactInPercentage: 0,
            switchExactOutPercentage: 0,
            samplingExactOutPercentage: 0,
          } as QuoteProviderTrafficSwitchConfiguration
        default:
          return {
            switchExactInPercentage: 100,
            samplingExactInPercentage: 0,
            switchExactOutPercentage: 100,
            samplingExactOutPercentage: 0,
          } as QuoteProviderTrafficSwitchConfiguration
      }
    case ChainId.MAINNET:
      switch (protocol) {
        case Protocol.V4:
          return {
            switchExactInPercentage: 0,
            samplingExactInPercentage: 0,
            switchExactOutPercentage: 0,
            samplingExactOutPercentage: 0,
          } as QuoteProviderTrafficSwitchConfiguration
        default:
          // Total RPM for 'QuoteTotalCallsToProvider' is around 20k-30k (across all chains), so 0.1% means 20-30 RPM shadow sampling
          return {
            switchExactInPercentage: 100,
            samplingExactInPercentage: 0,
            switchExactOutPercentage: 100,
            samplingExactOutPercentage: 0,
          } as QuoteProviderTrafficSwitchConfiguration
      }
    case ChainId.ARBITRUM_ONE:
      switch (protocol) {
        case Protocol.MIXED:
        case Protocol.V4:
          return {
            switchExactInPercentage: 0,
            samplingExactInPercentage: 0,
            switchExactOutPercentage: 0,
            samplingExactOutPercentage: 0,
          } as QuoteProviderTrafficSwitchConfiguration
        default:
          // Arbitrum RPC eth_call traffic is about half of mainnet, so we can shadow sample 0.2% of traffic
          return {
            switchExactInPercentage: 100,
            samplingExactInPercentage: 0,
            switchExactOutPercentage: 100,
            samplingExactOutPercentage: 0,
          } as QuoteProviderTrafficSwitchConfiguration
      }
    case ChainId.POLYGON:
      switch (protocol) {
        case Protocol.MIXED:
        case Protocol.V4:
          return {
            switchExactInPercentage: 0,
            samplingExactInPercentage: 0,
            switchExactOutPercentage: 0,
            samplingExactOutPercentage: 0,
          } as QuoteProviderTrafficSwitchConfiguration
        default:
          // Total RPM for 'QuoteTotalCallsToProvider' is around 20k-30k (across all chains), so 0.1% means 20-30 RPM shadow sampling
          return {
            switchExactInPercentage: 100,
            samplingExactInPercentage: 0,
            switchExactOutPercentage: 100,
            samplingExactOutPercentage: 0,
          } as QuoteProviderTrafficSwitchConfiguration
      }
    case ChainId.OPTIMISM:
      switch (protocol) {
        case Protocol.MIXED:
        case Protocol.V4:
          return {
            switchExactInPercentage: 0,
            samplingExactInPercentage: 0,
            switchExactOutPercentage: 0,
            samplingExactOutPercentage: 0,
          } as QuoteProviderTrafficSwitchConfiguration
        default:
          // Optimism RPC eth_call traffic is about 1/10 of mainnet, so we can shadow sample 1% of traffic
          return {
            switchExactInPercentage: 100,
            samplingExactInPercentage: 0,
            switchExactOutPercentage: 100,
            samplingExactOutPercentage: 0,
          } as QuoteProviderTrafficSwitchConfiguration
      }
    case ChainId.BLAST:
      switch (protocol) {
        case Protocol.MIXED:
        case Protocol.V4:
          return {
            switchExactInPercentage: 0,
            samplingExactInPercentage: 0,
            switchExactOutPercentage: 0,
            samplingExactOutPercentage: 0,
          } as QuoteProviderTrafficSwitchConfiguration
        default:
          // Blast RPC eth_call traffic is about 1/10 of mainnet, so we can shadow sample 1% of traffic
          return {
            switchExactInPercentage: 100,
            samplingExactInPercentage: 0,
            switchExactOutPercentage: 100,
            samplingExactOutPercentage: 0,
          } as QuoteProviderTrafficSwitchConfiguration
      }
    case ChainId.BNB:
      switch (protocol) {
        case Protocol.MIXED:
        case Protocol.V4:
          return {
            switchExactInPercentage: 0,
            samplingExactInPercentage: 0,
            switchExactOutPercentage: 0,
            samplingExactOutPercentage: 0,
          } as QuoteProviderTrafficSwitchConfiguration
        default:
          // BNB RPC eth_call traffic is about 1/10 of mainnet, so we can shadow sample 1% of traffic
          return {
            switchExactInPercentage: 100,
            samplingExactInPercentage: 0,
            switchExactOutPercentage: 100,
            samplingExactOutPercentage: 0,
          } as QuoteProviderTrafficSwitchConfiguration
      }
    case ChainId.CELO:
      switch (protocol) {
        case Protocol.MIXED:
        case Protocol.V4:
          return {
            switchExactInPercentage: 0,
            samplingExactInPercentage: 0,
            switchExactOutPercentage: 0,
            samplingExactOutPercentage: 0,
          } as QuoteProviderTrafficSwitchConfiguration
        default:
          // Celo RPC eth_call traffic is about 1/100 of mainnet, so we can shadow sample 10% of traffic
          return {
            switchExactInPercentage: 100,
            samplingExactInPercentage: 0,
            switchExactOutPercentage: 100,
            samplingExactOutPercentage: 0,
          } as QuoteProviderTrafficSwitchConfiguration
      }
    case ChainId.AVALANCHE:
      switch (protocol) {
        case Protocol.MIXED:
        case Protocol.V4:
          return {
            switchExactInPercentage: 0,
            samplingExactInPercentage: 0,
            switchExactOutPercentage: 0,
            samplingExactOutPercentage: 0,
          } as QuoteProviderTrafficSwitchConfiguration
        default:
          // Avalanche RPC eth_call traffic is about 1/100 of mainnet, so we can shadow sample 10% of traffic
          return {
            switchExactInPercentage: 100,
            samplingExactInPercentage: 0,
            switchExactOutPercentage: 100,
            samplingExactOutPercentage: 0,
          } as QuoteProviderTrafficSwitchConfiguration
      }
    // worldchain and unichain sepolia don't have the view-only quoter yet, so we can shadow sample 0.1% of traffic
    case ChainId.WORLDCHAIN:
    case ChainId.UNICHAIN_SEPOLIA:
    case ChainId.BASE_SEPOLIA:
    case ChainId.MONAD_TESTNET:
    case ChainId.MONAD:
    case ChainId.UNICHAIN:
    case ChainId.SONEIUM:
      switch (protocol) {
        case Protocol.MIXED:
        case Protocol.V4:
          return {
            switchExactInPercentage: 0,
            samplingExactInPercentage: 0,
            switchExactOutPercentage: 0,
            samplingExactOutPercentage: 0,
          } as QuoteProviderTrafficSwitchConfiguration
        default:
          return {
            switchExactInPercentage: 0.0,
            samplingExactInPercentage: 0.1,
            switchExactOutPercentage: 0.0,
            samplingExactOutPercentage: 0.1,
          } as QuoteProviderTrafficSwitchConfiguration
      }
    // If we accidentally switch a traffic, we have the protection to shadow sample only 0.1% of traffic
    default:
      return {
        switchExactInPercentage: 0.0,
        samplingExactInPercentage: 0.1,
        switchExactOutPercentage: 0.0,
        samplingExactOutPercentage: 0.1,
      } as QuoteProviderTrafficSwitchConfiguration
  }
}
