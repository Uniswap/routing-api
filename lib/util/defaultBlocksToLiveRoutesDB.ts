import { ChainId } from '@uniswap/sdk-core'

// This is not being used in production today anyway, due to below filterExpiredCachedRoutes method not really filtering on the blocks-to-live
// heuristic is initially within 30 seconds we find a route. (but we are changing to every 1 min now)
// For the Ratio we are approximating Phi (Golden Ratio) by creating a fraction with 2 consecutive Fibonacci numbers

// changing to this way with ChainId enum as key indexing, so that we wont forgot to add new chain tuned blocks-to-live
// those are only gonna be enabled with DynamoRouteCachingProvider.newCachedRoutesRolloutPercent anyway
export const DEFAULT_BLOCKS_TO_LIVE_ROUTES_DB: { [chain in ChainId]: number } = {
  // (1 minute) / (12 seconds)= 5
  [ChainId.MAINNET]: 5,
  [ChainId.GOERLI]: 5,
  [ChainId.SEPOLIA]: 5,
  // (1 minute) / (2 seconds) = 30
  [ChainId.OPTIMISM]: 30,
  [ChainId.OPTIMISM_GOERLI]: 30,
  [ChainId.OPTIMISM_SEPOLIA]: 30,
  [ChainId.BASE]: 900,
  [ChainId.ZORA]: 30,
  [ChainId.BASE_GOERLI]: 30,
  [ChainId.BASE_SEPOLIA]: 30,
  [ChainId.ZORA_SEPOLIA]: 30,
  [ChainId.BLAST]: 30,
  // Note: Experiment with longer TTL
  // (12 minutes) / (2 seconds) = 360
  [ChainId.WORLDCHAIN]: 360,
  // (1 minute) / (1 seconds) = 60
  [ChainId.UNICHAIN_SEPOLIA]: 60,
  // For Unichain, due to low volume and low liquidity pools that change often, let's have a shorter TTL
  // - start with 0.5 mins: (0.5 minutes) / (1 seconds) = 30
  [ChainId.UNICHAIN]: 30,
  [ChainId.MONAD_TESTNET]: 60,
  [ChainId.MONAD]: 60,
  // (1 minute) / (250 milliseconds) = 240
  [ChainId.ARBITRUM_ONE]: 240,
  [ChainId.ARBITRUM_GOERLI]: 240,
  [ChainId.ARBITRUM_SEPOLIA]: 240,
  // (1 minute) / (2 seconds) = 30
  [ChainId.POLYGON]: 30,
  [ChainId.POLYGON_MUMBAI]: 30,
  // (1 minute) / (5 seconds) = 12
  [ChainId.CELO]: 12,
  [ChainId.CELO_ALFAJORES]: 12,
  // (1 minute) / (5 seconds) = 12
  [ChainId.GNOSIS]: 12,
  // (1 minute) / (6 seconds) = 10
  [ChainId.MOONBEAM]: 10,
  // (1 minute) / (3 seconds) = 20
  [ChainId.BNB]: 20,
  // (1 minute) / (3 seconds) = 20
  [ChainId.AVALANCHE]: 20,
  // (1 minute) / (33 seconds) = 2
  [ChainId.ROOTSTOCK]: 2,
  // (1 minute) / (1 seconds) = 60
  [ChainId.ZKSYNC]: 60,
  [ChainId.SONEIUM]: 60,
}
