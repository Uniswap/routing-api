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

export const NEW_QUOTER_DEPLOY_BLOCK: { [chainId: number]: number } = {
  [ChainId.MAINNET]: 19662663,
}

export const LIKELY_OUT_OF_GAS_THRESHOLD: { [chainId: number]: number } = {
  [ChainId.MAINNET]: 17540 * 2, // 17540 is the single tick.cross cost on mainnet. We multiply by 2 to be safe.
}
