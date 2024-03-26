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
