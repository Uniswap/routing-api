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
    case ChainId.MAINNET:
    default:
      return {
        switchExactInPercentage: 0.0,
        samplingExactInPercentage: 0.1,
        switchExactOutPercentage: 0.0,
        samplingExactOutPercentage: 0.1,
      } as QuoteProviderTrafficSwitchConfiguration
  }
}
