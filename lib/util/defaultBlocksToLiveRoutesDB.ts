import { ChainId } from '@uniswap/sdk-core'

// This is not being used in production today anyway, due to below filterExpiredCachedRoutes method not really filtering on the blocks-to-live
// heuristic is initially within 30 seconds we find a route. (but we are changing to every 10 minutes now)
// For the Ratio we are approximating Phi (Golden Ratio) by creating a fraction with 2 consecutive Fibonacci numbers

// changing to this way with ChainId enum as key indexing, so that we wont forgot to add new chain tuned blocks-to-live
// those are only gonna be enabled with DynamoRouteCachingProvider.newCachedRoutesRolloutPercent anyway
export const DEFAULT_BLOCKS_TO_LIVE_ROUTES_DB: { [chain in ChainId]: number } = {
  // (10 minutes) / (12 seconds)= 50
  [ChainId.MAINNET]: 50,
  [ChainId.GOERLI]: 50,
  [ChainId.SEPOLIA]: 50,
  // (10 minutes) / (2 seconds) = 300
  [ChainId.OPTIMISM]: 300,
  [ChainId.OPTIMISM_GOERLI]: 300,
  [ChainId.OPTIMISM_SEPOLIA]: 300,
  [ChainId.BASE]: 300,
  [ChainId.ZORA]: 300,
  [ChainId.BASE_GOERLI]: 300,
  [ChainId.ZORA_SEPOLIA]: 300,
  [ChainId.BLAST]: 300,
  [ChainId.WORLDCHAIN]: 300,
  // (10 minutes) / (1 seconds) = 600
  [ChainId.ASTROCHAIN_SEPOLIA]: 600,
  // (10 minutes) / (250 milliseconds) = 2400
  [ChainId.ARBITRUM_ONE]: 2400,
  [ChainId.ARBITRUM_GOERLI]: 2400,
  [ChainId.ARBITRUM_SEPOLIA]: 2400,
  // (10 minutes) / (2 seconds) = 300
  [ChainId.POLYGON]: 300,
  [ChainId.POLYGON_MUMBAI]: 300,
  // (10 minutes) / (5 seconds) = 120
  [ChainId.CELO]: 120,
  [ChainId.CELO_ALFAJORES]: 120,
  // (10 minutes) / (5 seconds) = 120
  [ChainId.GNOSIS]: 120,
  // (10 minutes) / (6 seconds) = 100
  [ChainId.MOONBEAM]: 100,
  // (10 minutes) / (3 seconds) = 200
  [ChainId.BNB]: 200,
  // (10 minutes) / (3 seconds) = 200
  [ChainId.AVALANCHE]: 200,
  // (10 minutes) / (33 seconds) = 18
  [ChainId.ROOTSTOCK]: 18,
  // (10 minutes) / (1 seconds) = 600
  [ChainId.ZKSYNC]: 600,
}
