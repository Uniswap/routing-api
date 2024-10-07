import { BigNumber } from '@ethersproject/bignumber'
import { ChainId } from '@uniswap/sdk-core'
import { CHAIN_TO_GAS_LIMIT_MAP } from './gasLimit'
import { TENDERLY_NOT_SUPPORTED_CHAINS } from '@uniswap/smart-order-router'

export function adhocCorrectGasUsed(estimatedGasUsed: BigNumber, chainId: ChainId): BigNumber {
  const shouldCorrectGas = TENDERLY_NOT_SUPPORTED_CHAINS.includes(chainId)

  if (!shouldCorrectGas) {
    return estimatedGasUsed
  }

  if (estimatedGasUsed.gt(CHAIN_TO_GAS_LIMIT_MAP[chainId])) {
    return estimatedGasUsed
  }

  return CHAIN_TO_GAS_LIMIT_MAP[chainId]
}
