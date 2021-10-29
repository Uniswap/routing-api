import { Fraction } from '@uniswap/sdk-core';
import JSBI from 'jsbi';

export function absoluteValue(fraction: Fraction): Fraction {
  const numeratorAbs = JSBI.lessThan(fraction.numerator, JSBI.BigInt(0))
    ? JSBI.unaryMinus(fraction.numerator)
    : fraction.numerator
  const denominatorAbs = JSBI.lessThan(fraction.denominator, JSBI.BigInt(0))
    ? JSBI.unaryMinus(fraction.denominator)
    : fraction.denominator
  return new Fraction(numeratorAbs, denominatorAbs)
}
