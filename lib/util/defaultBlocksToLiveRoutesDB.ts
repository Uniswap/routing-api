import { ChainId } from '@uniswap/sdk-core'

// This is not being used in production today anyway, due to below filterExpiredCachedRoutes method not really filtering on the blocks-to-live
// heuristic is within 30 seconds we find a route.
// For the Ratio we are approximating Phi (Golden Ratio) by creating a fraction with 2 consecutive Fibonacci numbers

// changing to this way with ChainId enum as key indexing, so that we wont forgot to add new chain tuned blocks-to-live
// those are only gonna be enabled with DynamoRouteCachingProvider.newCachedRoutesRolloutPercent anyway
export const DEFAULT_BLOCKS_TO_LIVE_ROUTES_DB: { [chain in ChainId]: number } = {
  [ChainId.MAINNET]: 10,
  [ChainId.GOERLI]: 10,
  [ChainId.SEPOLIA]: 10,
  // https://dune.com/queries/2009572
  [ChainId.OPTIMISM]: 60,
  [ChainId.OPTIMISM_GOERLI]: 60,
  [ChainId.OPTIMISM_SEPOLIA]: 60,
  [ChainId.ARBITRUM_ONE]: 60,
  [ChainId.ARBITRUM_GOERLI]: 60,
  [ChainId.ARBITRUM_SEPOLIA]: 60,
  // https://dune.com/KARTOD/blockchains-analysis
  [ChainId.POLYGON]: 15,
  [ChainId.POLYGON_MUMBAI]: 15,
  //  https://explorer.celo.org/mainnet/,
  [ChainId.CELO]: 6,
  [ChainId.CELO_ALFAJORES]: 6,
  [ChainId.GNOSIS]: 2,
  [ChainId.MOONBEAM]: 2,
  // https://dune.com/KARTOD/blockchains-analysis,
  [ChainId.BNB]: 10,
  // https://snowtrace.io/chart/blocktime
  [ChainId.AVALANCHE]: 15,
  [ChainId.BASE_GOERLI]: 60,
  // https://dune.com/queries/2009572
  [ChainId.BASE]: 60,
  // low blocks-to-live 2 for low traffic chains
  [ChainId.ZORA]: 2,
  [ChainId.ZORA_SEPOLIA]: 2,
  [ChainId.ROOTSTOCK]: 2,
  [ChainId.BLAST]: 2,
  [ChainId.ZKSYNC]: 2,
  [ChainId.WORLDCHAIN]: 2,
  [ChainId.ASTROCHAIN_SEPOLIA]: 60,
}
