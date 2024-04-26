import { ChainId } from '@uniswap/sdk-core'

export type QuoteProviderTrafficSwitchConfiguration = {
  switchExactInPercentage: number
  samplingExactInPercentage: number
  switchExactOutPercentage: number
  samplingExactOutPercentage: number
}

export const QUOTE_PROVIDER_TRAFFIC_SWITCH_CONFIGURATION = (
  chainId: ChainId
): QuoteProviderTrafficSwitchConfiguration => {
  switch (chainId) {
    // Mumbai was deprecated on April 13th. Do not sample at all
    case ChainId.POLYGON_MUMBAI:
      return {
        switchExactInPercentage: 0.0,
        samplingExactInPercentage: 0,
        switchExactOutPercentage: 0.0,
        samplingExactOutPercentage: 0,
      } as QuoteProviderTrafficSwitchConfiguration
    // Sepolia together have well below 50 RPM, so we can shadow sample 100% of traffic
    case ChainId.SEPOLIA:
      return {
        switchExactInPercentage: 0.0,
        samplingExactInPercentage: 100,
        switchExactOutPercentage: 0.0,
        samplingExactOutPercentage: 100,
      } as QuoteProviderTrafficSwitchConfiguration
    case ChainId.BASE:
      // Base RPC eth_call traffic is about double mainnet, so we can shadow sample 0.05% of traffic
      return {
        switchExactInPercentage: 100,
        samplingExactInPercentage: 0,
        switchExactOutPercentage: 100,
        samplingExactOutPercentage: 0,
      } as QuoteProviderTrafficSwitchConfiguration
    case ChainId.MAINNET:
      // Total RPM for 'QuoteTotalCallsToProvider' is around 20k-30k (across all chains), so 0.1% means 20-30 RPM shadow sampling
      return {
        switchExactInPercentage: 1,
        samplingExactInPercentage: 0,
        switchExactOutPercentage: 1,
        samplingExactOutPercentage: 0,
      } as QuoteProviderTrafficSwitchConfiguration
    case ChainId.ARBITRUM_ONE:
      // Arbitrum RPC eth_call traffic is about half of mainnet, so we can shadow sample 0.2% of traffic
      return {
        switchExactInPercentage: 100,
        samplingExactInPercentage: 0,
        switchExactOutPercentage: 100,
        samplingExactOutPercentage: 0,
      } as QuoteProviderTrafficSwitchConfiguration
    case ChainId.POLYGON:
      // Total RPM for 'QuoteTotalCallsToProvider' is around 20k-30k (across all chains), so 0.1% means 20-30 RPM shadow sampling
      return {
        switchExactInPercentage: 100,
        samplingExactInPercentage: 0,
        switchExactOutPercentage: 100,
        samplingExactOutPercentage: 0,
      } as QuoteProviderTrafficSwitchConfiguration
    case ChainId.OPTIMISM:
      // Optimism RPC eth_call traffic is about 1/10 of mainnet, so we can shadow sample 1% of traffic
      return {
        switchExactInPercentage: 100,
        samplingExactInPercentage: 0,
        switchExactOutPercentage: 100,
        samplingExactOutPercentage: 0,
      } as QuoteProviderTrafficSwitchConfiguration
    case ChainId.BLAST:
      // Blast RPC eth_call traffic is about 1/10 of mainnet, so we can shadow sample 1% of traffic
      return {
        switchExactInPercentage: 100,
        samplingExactInPercentage: 0,
        switchExactOutPercentage: 100,
        samplingExactOutPercentage: 0,
      } as QuoteProviderTrafficSwitchConfiguration
    case ChainId.BNB:
      // BNB RPC eth_call traffic is about 1/10 of mainnet, so we can shadow sample 1% of traffic
      return {
        switchExactInPercentage: 100,
        samplingExactInPercentage: 0,
        switchExactOutPercentage: 100,
        samplingExactOutPercentage: 0,
      }
    case ChainId.CELO:
      // Celo RPC eth_call traffic is about 1/100 of mainnet, so we can shadow sample 10% of traffic
      return {
        switchExactInPercentage: 100,
        samplingExactInPercentage: 0,
        switchExactOutPercentage: 100,
        samplingExactOutPercentage: 0,
      } as QuoteProviderTrafficSwitchConfiguration
    case ChainId.AVALANCHE:
      // Avalanche RPC eth_call traffic is about 1/100 of mainnet, so we can shadow sample 10% of traffic
      return {
        switchExactInPercentage: 100,
        samplingExactInPercentage: 0,
        switchExactOutPercentage: 100,
        samplingExactOutPercentage: 0,
      } as QuoteProviderTrafficSwitchConfiguration
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
