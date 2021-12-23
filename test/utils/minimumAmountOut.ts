import { Currency, CurrencyAmount, Fraction, Percent } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import invariant from 'tiny-invariant'

export const minimumAmountOut = (
  slippageTolerance: Percent,
  amountOut: CurrencyAmount<Currency>
): CurrencyAmount<Currency> => {
  invariant(!slippageTolerance.lessThan(JSBI.BigInt(0)), 'SLIPPAGE_TOLERANCE')
  const slippageAdjustedAmountOut = new Fraction(JSBI.BigInt(1))
    .add(slippageTolerance)
    .invert()
    .multiply(amountOut.quotient).quotient
  return CurrencyAmount.fromRawAmount(amountOut.currency, slippageAdjustedAmountOut)
}
