import { ChainId } from '@uniswap/sdk-core'

// This is not being used in production today anyway, due to below filterExpiredCachedRoutes method not really filtering on the blocks-to-live
// heuristic is initially within 30 seconds we find a route. (but we are changing to every 15 min now)
// For the Ratio we are approximating Phi (Golden Ratio) by creating a fraction with 2 consecutive Fibonacci numbers

// changing to this way with ChainId enum as key indexing, so that we wont forgot to add new chain tuned blocks-to-live
// those are only gonna be enabled with DynamoRouteCachingProvider.newCachedRoutesRolloutPercent anyway
export const DEFAULT_BLOCKS_TO_LIVE_ROUTES_DB: { [chain in ChainId]: number } = {
  // (15 minutes) / (12 seconds)= 75
  [ChainId.MAINNET]: 75,
  [ChainId.GOERLI]: 75,
  [ChainId.SEPOLIA]: 75,
  // (15 minutes) / (2 seconds) = 450
  [ChainId.OPTIMISM]: 450,
  [ChainId.OPTIMISM_GOERLI]: 450,
  [ChainId.OPTIMISM_SEPOLIA]: 450,
  [ChainId.BASE]: 450,
  [ChainId.ZORA]: 450,
  [ChainId.BASE_GOERLI]: 450,
  [ChainId.BASE_SEPOLIA]: 450,
  [ChainId.ZORA_SEPOLIA]: 450,
  [ChainId.BLAST]: 450,
  // Note: Experiment with longer TTL
  // (3 hours) / (2 seconds) = 5400
  [ChainId.WORLDCHAIN]: 5400,
  // (15 minutes) / (1 seconds) = 900
  [ChainId.UNICHAIN_SEPOLIA]: 900,
  // For Unichain, due to low volume and low liquidity pools that change often, let's have a shorter TTL
  // - start with 7.5 mins: (7.5 minutes) / (1 seconds) = 450
  [ChainId.UNICHAIN]: 450,
  [ChainId.MONAD_TESTNET]: 900,
  // (15 minutes) / (250 milliseconds) = 3600
  [ChainId.ARBITRUM_ONE]: 3600,
  [ChainId.ARBITRUM_GOERLI]: 3600,
  [ChainId.ARBITRUM_SEPOLIA]: 3600,
  // (15 minutes) / (2 seconds) = 450
  [ChainId.POLYGON]: 450,
  [ChainId.POLYGON_MUMBAI]: 450,
  // (15 minutes) / (5 seconds) = 180
  [ChainId.CELO]: 180,
  [ChainId.CELO_ALFAJORES]: 180,
  // (15 minutes) / (5 seconds) = 180
  [ChainId.GNOSIS]: 180,
  // (15 minutes) / (6 seconds) = 150
  [ChainId.MOONBEAM]: 150,
  // (15 minutes) / (3 seconds) = 300
  [ChainId.BNB]: 300,
  // (15 minutes) / (3 seconds) = 300
  [ChainId.AVALANCHE]: 300,
  // (15 minutes) / (33 seconds) = 37
  [ChainId.ROOTSTOCK]: 37,
  // (15 minutes) / (1 seconds) = 900
  [ChainId.ZKSYNC]: 900,
  [ChainId.MONAD_TESTNET]: 900,
  [ChainId.SONEIUM]: 900,
}
