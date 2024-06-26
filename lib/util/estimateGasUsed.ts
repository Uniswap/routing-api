import { BigNumber } from '@ethersproject/bignumber'
import { ChainId } from '@uniswap/sdk-core'
import { CELO_UPPER_SWAP_GAS_LIMIT, ZKSYNC_UPPER_SWAP_GAS_LIMIT } from './gasLimit'

export function adhocCorrectGasUsed(
  estimatedGasUsed: BigNumber,
  chainId: ChainId,
  isMobileRequest: boolean
): BigNumber {
  if (!isMobileRequest) {
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
    default:
      return estimatedGasUsed
  }
}
