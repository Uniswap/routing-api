import { BigNumber } from '@ethersproject/bignumber'
import { ChainId, Currency, CurrencyAmount } from '@uniswap/sdk-core'
import { CELO_UPPER_SWAP_GAS_LIMIT, ZKSYNC_UPPER_SWAP_GAS_LIMIT } from './gasLimit'
import JSBI from 'jsbi'

export function adhocCorrectGasUsedUSD(
  estimatedGasUsed: BigNumber,
  estimatedGasUsedUSD: CurrencyAmount<Currency>,
  chainId: ChainId,
  requestSource: string
): CurrencyAmount<Currency> {
  const isMobileRequest = ['uniswap-ios', 'uniswap-android'].includes(requestSource)
  const isExtensionRequest = requestSource === 'uniswap-extension'
  const shouldCorrectGas = isMobileRequest || isExtensionRequest

  if (!shouldCorrectGas) {
    return estimatedGasUsedUSD
  }

  switch (chainId) {
    case ChainId.ZKSYNC:
      if (estimatedGasUsed.gt(ZKSYNC_UPPER_SWAP_GAS_LIMIT)) {
        // this is a check to ensure that we don't return the gas used smaller than upper swap gas limit,
        // although this is unlikely
        return estimatedGasUsedUSD
      }

      const correctedEstimateGasUsedUSD = JSBI.divide(
        JSBI.multiply(estimatedGasUsedUSD.quotient, JSBI.BigInt(ZKSYNC_UPPER_SWAP_GAS_LIMIT)),
        JSBI.BigInt(estimatedGasUsed)
      )
      return CurrencyAmount.fromRawAmount(estimatedGasUsedUSD.currency, correctedEstimateGasUsedUSD)
    case ChainId.CELO:
      if (estimatedGasUsed.gt(CELO_UPPER_SWAP_GAS_LIMIT)) {
        // this is a check to ensure that we don't return the gas used smaller than upper swap gas limit,
        // although this is unlikely
        return estimatedGasUsedUSD
      }

      const correctedEstimateGasUsedUSDCELO = JSBI.divide(
        JSBI.multiply(estimatedGasUsedUSD.quotient, JSBI.BigInt(CELO_UPPER_SWAP_GAS_LIMIT)),
        JSBI.BigInt(estimatedGasUsed)
      )
      return CurrencyAmount.fromRawAmount(estimatedGasUsedUSD.currency, correctedEstimateGasUsedUSDCELO)
    default:
      return estimatedGasUsedUSD
  }
}
