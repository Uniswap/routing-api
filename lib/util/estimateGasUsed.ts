import { BigNumber } from '@ethersproject/bignumber'
import { ChainId } from '@uniswap/sdk-core'
import {
  ASTROCHAIN_SEPOLIA_UPPER_SWAP_GAS_LIMIT,
  CELO_UPPER_SWAP_GAS_LIMIT,
  WORLDCHAIN_UPPER_SWAP_GAS_LIMIT,
  ZKSYNC_UPPER_SWAP_GAS_LIMIT,
} from './gasLimit'

export function adhocCorrectGasUsed(estimatedGasUsed: BigNumber, chainId: ChainId, requestSource: string): BigNumber {
  const isMobileRequest = ['uniswap-ios', 'uniswap-android'].includes(requestSource)
  const isExtensionRequest = requestSource === 'uniswap-extension'
  const shouldCorrectGas = isMobileRequest || isExtensionRequest

  if (!shouldCorrectGas) {
    return estimatedGasUsed
  }

  switch (chainId) {
    case ChainId.ZKSYNC:
      if (estimatedGasUsed.gt(ZKSYNC_UPPER_SWAP_GAS_LIMIT)) {
        // this is a check to ensure that we don't return the gas used smaller than upper swap gas limit,
        // although this is unlikely
        return estimatedGasUsed
      }

      return ZKSYNC_UPPER_SWAP_GAS_LIMIT
    case ChainId.CELO:
      if (estimatedGasUsed.gt(CELO_UPPER_SWAP_GAS_LIMIT)) {
        // this is a check to ensure that we don't return the gas used smaller than upper swap gas limit,
        // although this is unlikely
        return estimatedGasUsed
      }

      return CELO_UPPER_SWAP_GAS_LIMIT
    case ChainId.WORLDCHAIN:
      if (estimatedGasUsed.gt(WORLDCHAIN_UPPER_SWAP_GAS_LIMIT)) {
        // this is a check to ensure that we don't return the gas used smaller than upper swap gas limit,
        // although this is unlikely
        return estimatedGasUsed
      }

      return WORLDCHAIN_UPPER_SWAP_GAS_LIMIT
    case ChainId.ASTROCHAIN_SEPOLIA:
      if (estimatedGasUsed.gt(ASTROCHAIN_SEPOLIA_UPPER_SWAP_GAS_LIMIT)) {
        // this is a check to ensure that we don't return the gas used smaller than upper swap gas limit,
        // although this is unlikely
        return estimatedGasUsed
      }

      return ASTROCHAIN_SEPOLIA_UPPER_SWAP_GAS_LIMIT
    default:
      return estimatedGasUsed
  }
}
