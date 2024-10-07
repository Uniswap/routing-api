import { BigNumber } from '@ethersproject/bignumber'
import { ChainId, Currency, CurrencyAmount } from '@uniswap/sdk-core'
import { CHAIN_TO_GAS_LIMIT_MAP } from './gasLimit'
import JSBI from 'jsbi'
import { TENDERLY_NOT_SUPPORTED_CHAINS } from '@uniswap/smart-order-router'

export function adhocCorrectGasUsedUSD(
  estimatedGasUsed: BigNumber,
  estimatedGasUsedUSD: CurrencyAmount<Currency>,
  chainId: ChainId
): CurrencyAmount<Currency> {
  const shouldCorrectGas = TENDERLY_NOT_SUPPORTED_CHAINS.includes(chainId)

  if (!shouldCorrectGas) {
    return estimatedGasUsedUSD
  }

  if (estimatedGasUsed.gt(CHAIN_TO_GAS_LIMIT_MAP[chainId])) {
    // this is a check to ensure that we don't return the gas used smaller than upper swap gas limit,
    // although this is unlikely
    return estimatedGasUsedUSD
  }

  const correctedEstimateGasUsedUSD = JSBI.divide(
    JSBI.multiply(estimatedGasUsedUSD.quotient, JSBI.BigInt(CHAIN_TO_GAS_LIMIT_MAP[chainId])),
    JSBI.BigInt(estimatedGasUsed)
  )
  return CurrencyAmount.fromRawAmount(estimatedGasUsedUSD.currency, correctedEstimateGasUsedUSD)
}
