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
import AsyncRetry from 'async-retry'
import { BatchParams, BlockNumberConfig, FailureOverrides } from '@uniswap/smart-order-router'

export const RETRY_OPTIONS: { [chainId: number]: AsyncRetry.Options | undefined } = {
  ...constructSameRetryOptionsMap(DEFAULT_RETRY_OPTIONS),
  [ChainId.BASE]: {
    retries: 2,
    minTimeout: 100,
    maxTimeout: 1000,
  },
  [ChainId.ARBITRUM_ONE]: {
    retries: 2,
    minTimeout: 100,
    maxTimeout: 1000,
  },
  [ChainId.OPTIMISM]: {
    retries: 2,
    minTimeout: 100,
    maxTimeout: 1000,
  },
}

export const BATCH_PARAMS: { [chainId: number]: BatchParams } = {
  ...constructSameBatchParamsMap(DEFAULT_BATCH_PARAMS),
  [ChainId.BASE]: {
    multicallChunk: 110,
    gasLimitPerCall: 1_200_000,
    quoteMinSuccessRate: 0.1,
  },
  [ChainId.ARBITRUM_ONE]: {
    multicallChunk: 15,
    gasLimitPerCall: 15_000_000,
    quoteMinSuccessRate: 0.15,
  },
  [ChainId.OPTIMISM]: {
    multicallChunk: 110,
    gasLimitPerCall: 1_200_000,
    quoteMinSuccessRate: 0.1,
  },
}

export const GAS_ERROR_FAILURE_OVERRIDES: { [chainId: number]: FailureOverrides } = {
  ...constructSameGasErrorFailureOverridesMap(DEFAULT_GAS_ERROR_FAILURE_OVERRIDES),
  [ChainId.BASE]: {
    gasLimitOverride: 3_000_000,
    multicallChunk: 45,
  },
  [ChainId.ARBITRUM_ONE]: {
    gasLimitOverride: 30_000_000,
    multicallChunk: 8,
  },
  [ChainId.OPTIMISM]: {
    gasLimitOverride: 3_000_000,
    multicallChunk: 45,
  },
}

export const SUCCESS_RATE_FAILURE_OVERRIDES: { [chainId: number]: FailureOverrides } = {
  ...constructSameSuccessRateFailureOverridesMap(DEFAULT_SUCCESS_RATE_FAILURE_OVERRIDES),
  [ChainId.BASE]: {
    gasLimitOverride: 3_000_000,
    multicallChunk: 45,
  },
  [ChainId.ARBITRUM_ONE]: {
    gasLimitOverride: 30_000_000,
    multicallChunk: 8,
  },
  [ChainId.OPTIMISM]: {
    gasLimitOverride: 3_000_000,
    multicallChunk: 45,
  },
}

export const BLOCK_NUMBER_CONFIGS: { [chainId: number]: BlockNumberConfig } = {
  ...constructSameBlockNumberConfigsMap(DEFAULT_BLOCK_NUMBER_CONFIGS),
  [ChainId.BASE]: {
    baseBlockOffset: -25,
    rollback: {
      enabled: true,
      attemptsBeforeRollback: 1,
      rollbackBlockOffset: -20,
    },
  },
  [ChainId.ARBITRUM_ONE]: {
    baseBlockOffset: 0,
    rollback: {
      enabled: true,
      attemptsBeforeRollback: 1,
      rollbackBlockOffset: -10,
    },
  },
  [ChainId.OPTIMISM]: {
    baseBlockOffset: -25,
    rollback: {
      enabled: true,
      attemptsBeforeRollback: 1,
      rollbackBlockOffset: -20,
    },
  },
}

// block -1 means it's never deployed
export const NEW_QUOTER_DEPLOY_BLOCK: { [chainId in ChainId]: number } = {
  [ChainId.MAINNET]: 19662663,
  [ChainId.GOERLI]: -1,
  [ChainId.SEPOLIA]: 5677582,
  [ChainId.OPTIMISM]: 118909709,
  [ChainId.OPTIMISM_GOERLI]: -1,
  [ChainId.OPTIMISM_SEPOLIA]: -1,
  // Arbitrum is special, it's using L1-ish block number (see https://docs.arbitrum.io/build-decentralized-apps/arbitrum-vs-ethereum/block-numbers-and-time)
  [ChainId.ARBITRUM_ONE]: 19680034,
  [ChainId.ARBITRUM_GOERLI]: -1,
  [ChainId.ARBITRUM_SEPOLIA]: -1,
  [ChainId.POLYGON]: 55938282,
  [ChainId.POLYGON_MUMBAI]: 48054046,
  [ChainId.CELO]: -1,
  [ChainId.CELO_ALFAJORES]: -1,
  [ChainId.GNOSIS]: -1,
  [ChainId.MOONBEAM]: -1,
  [ChainId.BNB]: -1,
  [ChainId.AVALANCHE]: -1,
  [ChainId.BASE]: 13311537,
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
  [ChainId.SEPOLIA]: 17540 * 2, // 17540 is the single tick.cross cost on sepolia. We multiply by 2 to be safe.
  [ChainId.OPTIMISM]: 17540 * 2, // 17540 is the single tick.cross cost on sepolia. We multiply by 2 to be safe.
  [ChainId.OPTIMISM_GOERLI]: 0,
  [ChainId.OPTIMISM_SEPOLIA]: 0,
  [ChainId.ARBITRUM_ONE]: 17540 * 2, // 17540 is the single tick.cross cost on polygon. We multiply by 2 to be safe.
  [ChainId.ARBITRUM_GOERLI]: 0,
  [ChainId.ARBITRUM_SEPOLIA]: 0,
  [ChainId.POLYGON]: 17540 * 2, // 17540 is the single tick.cross cost on polygon. We multiply by 2 to be safe.
  [ChainId.POLYGON_MUMBAI]: 17540 * 2, // 17540 is the single tick.cross cost on polygon-mumbai. We multiply by 2 to be safe.
  [ChainId.CELO]: 0,
  [ChainId.CELO_ALFAJORES]: 0,
  [ChainId.GNOSIS]: 0,
  [ChainId.MOONBEAM]: 0,
  [ChainId.BNB]: 0,
  [ChainId.AVALANCHE]: 0,
  [ChainId.BASE]: 17540 * 2, // 17540 is the single tick.cross cost on polygon. We multiply by 2 to be safe
  [ChainId.BASE_GOERLI]: 0,
  [ChainId.ZORA]: 0,
  [ChainId.ZORA_SEPOLIA]: 0,
  [ChainId.ROOTSTOCK]: 0,
  [ChainId.BLAST]: 0,
}
