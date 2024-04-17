import {
  constructSameBatchParamsMap,
  constructSameBlockNumberConfigsMap,
  constructSameGasErrorFailureOverridesMap,
  constructSameRetryOptionsMap,
  constructSameSuccessRateFailureOverridesMap,
  DEFAULT_BATCH_PARAMS,
  DEFAULT_BLOCK_NUMBER_CONFIGS,
  DEFAULT_GAS_ERROR_FAILURE_OVERRIDES,
  DEFAULT_RETRY_OPTIONS,
  DEFAULT_SUCCESS_RATE_FAILURE_OVERRIDES,
} from '@uniswap/smart-order-router/build/main/util/onchainQuoteProviderConfigs'
import { ChainId } from '@uniswap/sdk-core'

export const RETRY_OPTIONS = {
  ...constructSameRetryOptionsMap(DEFAULT_RETRY_OPTIONS),
}

export const BATCH_PARAMS = {
  ...constructSameBatchParamsMap(DEFAULT_BATCH_PARAMS),
}

export const GAS_ERROR_FAILURE_OVERRIDES = {
  ...constructSameGasErrorFailureOverridesMap(DEFAULT_GAS_ERROR_FAILURE_OVERRIDES),
}

export const SUCCESS_RATE_FAILURE_OVERRIDES = {
  ...constructSameSuccessRateFailureOverridesMap(DEFAULT_SUCCESS_RATE_FAILURE_OVERRIDES),
}

export const BLOCK_NUMBER_CONFIGS = {
  ...constructSameBlockNumberConfigsMap(DEFAULT_BLOCK_NUMBER_CONFIGS),
}

// block -1 means it's never deployed
export const NEW_QUOTER_DEPLOY_BLOCK: { [chainId in ChainId]: number } = {
  [ChainId.MAINNET]: 19662663,
  [ChainId.GOERLI]: -1,
  [ChainId.SEPOLIA]: 5677582,
  [ChainId.OPTIMISM]: -1,
  [ChainId.OPTIMISM_GOERLI]: -1,
  [ChainId.OPTIMISM_SEPOLIA]: -1,
  [ChainId.ARBITRUM_ONE]: -1,
  [ChainId.ARBITRUM_GOERLI]: -1,
  [ChainId.ARBITRUM_SEPOLIA]: -1,
  [ChainId.POLYGON]: -1,
  [ChainId.POLYGON_MUMBAI]: 48054046,
  [ChainId.CELO]: -1,
  [ChainId.CELO_ALFAJORES]: -1,
  [ChainId.GNOSIS]: -1,
  [ChainId.MOONBEAM]: -1,
  [ChainId.BNB]: -1,
  [ChainId.AVALANCHE]: -1,
  [ChainId.BASE]: -1,
  [ChainId.BASE_GOERLI]: -1,
  [ChainId.ZORA]: -1,
  [ChainId.ZORA_SEPOLIA]: -1,
  [ChainId.ROOTSTOCK]: -1,
  [ChainId.BLAST]: -1,
}

// 0 threshold means it's not deployed yet
export const LIKELY_OUT_OF_GAS_THRESHOLD: { [chainId in ChainId]: number } = {
  [ChainId.MAINNET]: 17540 * 2, // 17540 is the single tick.cross cost on mainnet. We multiply by 2 to be safe.
  [ChainId.GOERLI]: 0,
  [ChainId.SEPOLIA]: 17540 * 2, // 17540 is the single tick.cross cost on mainnet. We multiply by 2 to be safe.
  [ChainId.OPTIMISM]: 0,
  [ChainId.OPTIMISM_GOERLI]: 0,
  [ChainId.OPTIMISM_SEPOLIA]: 0,
  [ChainId.ARBITRUM_ONE]: 0,
  [ChainId.ARBITRUM_GOERLI]: 0,
  [ChainId.ARBITRUM_SEPOLIA]: 0,
  [ChainId.POLYGON]: 0,
  [ChainId.POLYGON_MUMBAI]: 17540 * 2, // 17540 is the single tick.cross cost on mainnet. We multiply by 2 to be safe.
  [ChainId.CELO]: 0,
  [ChainId.CELO_ALFAJORES]: 0,
  [ChainId.GNOSIS]: 0,
  [ChainId.MOONBEAM]: 0,
  [ChainId.BNB]: 0,
  [ChainId.AVALANCHE]: 0,
  [ChainId.BASE]: 0,
  [ChainId.BASE_GOERLI]: 0,
  [ChainId.ZORA]: 0,
  [ChainId.ZORA_SEPOLIA]: 0,
  [ChainId.ROOTSTOCK]: 0,
  [ChainId.BLAST]: 0,
}
