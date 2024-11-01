import { ChainId } from '@uniswap/sdk-core'

// percent is between 0% - 100%, defined in SOR
// testnets all go to 100% directly
// production nets depending on revenue/quote traffic volume, if it's medium/high 1%, otherwise super low traffic (< 100 quotes per 5 minutes) 100%
// so zora and blast go to 100% directly. rootstock is not supported by uniswap labs product or protocol layer, go to 100% directly.
export const NEW_CACHED_ROUTES_ROLLOUT_PERCENT: { [chain in ChainId]: number } = {
  [ChainId.MAINNET]: 30,
  [ChainId.GOERLI]: 100,
  [ChainId.SEPOLIA]: 100,
  [ChainId.OPTIMISM]: 30,
  [ChainId.OPTIMISM_GOERLI]: 100,
  [ChainId.OPTIMISM_SEPOLIA]: 100,
  [ChainId.ARBITRUM_ONE]: 30,
  [ChainId.ARBITRUM_GOERLI]: 100,
  [ChainId.ARBITRUM_SEPOLIA]: 100,
  [ChainId.POLYGON]: 30,
  [ChainId.POLYGON_MUMBAI]: 100,
  [ChainId.CELO]: 30,
  [ChainId.CELO_ALFAJORES]: 100,
  [ChainId.GNOSIS]: 30,
  [ChainId.MOONBEAM]: 30,
  [ChainId.BNB]: 30,
  [ChainId.AVALANCHE]: 30,
  [ChainId.BASE_GOERLI]: 100,
  [ChainId.BASE]: 30,
  [ChainId.ZORA]: 100,
  [ChainId.ZORA_SEPOLIA]: 100,
  [ChainId.ROOTSTOCK]: 100,
  [ChainId.BLAST]: 100,
  [ChainId.ZKSYNC]: 30,
  [ChainId.WORLDCHAIN]: 30,
  [ChainId.ASTROCHAIN_SEPOLIA]: 100,
}
