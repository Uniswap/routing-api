import { ChainId } from '@uniswap/sdk-core'

// This is not being used in production today anyway, due to below filterExpiredCachedRoutes method not really filtering on the blocks-to-live
// heuristic is initially within 30 seconds we find a route. (but we are changing to every 1 hour now)
// For the Ratio we are approximating Phi (Golden Ratio) by creating a fraction with 2 consecutive Fibonacci numbers

// changing to this way with ChainId enum as key indexing, so that we wont forgot to add new chain tuned blocks-to-live
// those are only gonna be enabled with DynamoRouteCachingProvider.newCachedRoutesRolloutPercent anyway
export const DEFAULT_BLOCKS_TO_LIVE_ROUTES_DB: { [chain in ChainId]: number } = {
  // (60 minutes) / (12 seconds)= 300
  [ChainId.MAINNET]: 300,
  [ChainId.GOERLI]: 300,
  [ChainId.SEPOLIA]: 300,
  // (60 minutes) / (2 seconds) = 1800
  [ChainId.OPTIMISM]: 1800,
  [ChainId.OPTIMISM_GOERLI]: 1800,
  [ChainId.OPTIMISM_SEPOLIA]: 1800,
  [ChainId.BASE]: 1800,
  [ChainId.ZORA]: 1800,
  [ChainId.BASE_GOERLI]: 1800,
  [ChainId.BASE_SEPOLIA]: 1800,
  [ChainId.ZORA_SEPOLIA]: 1800,
  [ChainId.BLAST]: 1800,
  // Note: Experiment with longer TTL
  // (12 hours) / (2 seconds) = 21600
  [ChainId.WORLDCHAIN]: 21600,
  // (60 minutes) / (1 seconds) = 3600
  [ChainId.UNICHAIN_SEPOLIA]: 3600,
  // For Unichain, due to low volume and low liquidity pools that change often, let's have a shorter TTL
  // - start with 30 mins: (30 minutes) / (1 seconds) = 1800
  [ChainId.UNICHAIN]: 1800,
  [ChainId.MONAD_TESTNET]: 3600,
  // (60 minutes) / (250 milliseconds) = 14400
  [ChainId.ARBITRUM_ONE]: 14400,
  [ChainId.ARBITRUM_GOERLI]: 14400,
  [ChainId.ARBITRUM_SEPOLIA]: 14400,
  // (60 minutes) / (2 seconds) = 1800
  [ChainId.POLYGON]: 1800,
  [ChainId.POLYGON_MUMBAI]: 1800,
  // (60 minutes) / (5 seconds) = 720
  [ChainId.CELO]: 720,
  [ChainId.CELO_ALFAJORES]: 720,
  // (60 minutes) / (5 seconds) = 720
  [ChainId.GNOSIS]: 720,
  // (60 minutes) / (6 seconds) = 600
  [ChainId.MOONBEAM]: 600,
  // (60 minutes) / (3 seconds) = 1200
  [ChainId.BNB]: 1200,
  // (60 minutes) / (3 seconds) = 1200
  [ChainId.AVALANCHE]: 1200,
  // (60 minutes) / (33 seconds) = 148
  [ChainId.ROOTSTOCK]: 148,
  // (60 minutes) / (1 seconds) = 3600
  [ChainId.ZKSYNC]: 3600,
  [ChainId.MONAD_TESTNET]: 3600,
  [ChainId.SONEIUM]: 3600,
}
