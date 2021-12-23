import { Currency, CurrencyAmount, Fraction, Percent } from '@uniswap/sdk-core'
import invariant from 'tiny-invariant'
import JSBI from 'jsbi'

export const minimumAmountOut = (slippageTolerance: Percent, amountOut: CurrencyAmount<Currency>): CurrencyAmount<Currency> => {
	invariant(!slippageTolerance.lessThan(JSBI.BigInt(0)), 'SLIPPAGE_TOLERANCE')
	const slippageAdjustedAmountOut = new Fraction(JSBI.BigInt(1))
		.add(slippageTolerance)
		.invert()
		.multiply(amountOut.quotient).quotient
	return CurrencyAmount.fromRawAmount(amountOut.currency, slippageAdjustedAmountOut)
}
