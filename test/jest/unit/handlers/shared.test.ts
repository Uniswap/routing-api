import { describe, expect } from '@jest/globals'
import {
  computePortionAmount,
  parseDeadline,
  parseFeeOptions,
  parseFlatFeeOptions,
  parsePortionPercent,
  populateFeeOptions,
} from '../../../../lib/handlers/shared'
import { getAmount } from '../../../utils/tokens'
import { CurrencyAmount, Percent } from '@uniswap/sdk-core'
import { DAI_MAINNET, SwapOptions, SwapType } from '@uniswap/smart-order-router'
import { UniversalRouterVersion } from '@uniswap/universal-router-sdk'

describe('shared', () => {
  it('parsePortionPercent', () => {
    const percent = parsePortionPercent(10000)
    expect(percent.quotient.toString()).toEqual('1')
  })

  it('parseFeePortions', () => {
    const feeOptions = parseFeeOptions(10000, '0x123')
    expect(feeOptions).toBeDefined()

    if (feeOptions) {
      expect(feeOptions.fee.quotient.toString()).toEqual('1')
      expect(feeOptions.recipient).toEqual('0x123')
    }
  })

  it('parseFlatFeePortions', () => {
    const flatFeeOptionsent = parseFlatFeeOptions('35', '0x123')
    expect(flatFeeOptionsent).toBeDefined()

    if (flatFeeOptionsent) {
      expect(flatFeeOptionsent.amount.toString()).toEqual('35')
      expect(flatFeeOptionsent.recipient).toEqual('0x123')
    }
  })

  it('computePortionAmount', async () => {
    const amount = await getAmount(1, 'EXACT_OUTPUT', 'ETH', 'DAI', '1')
    const daiAmount = CurrencyAmount.fromRawAmount(DAI_MAINNET, amount)
    const portionAmount = computePortionAmount(daiAmount, 15)

    if (portionAmount) {
      expect(portionAmount).toEqual(daiAmount.multiply(parsePortionPercent(15)).quotient.toString())
    }
  })

  it('populateFeeOptions exact in', () => {
    const allFeeOptions = populateFeeOptions('exactIn', 15, '0x123')

    const swapParams: SwapOptions = {
      type: SwapType.UNIVERSAL_ROUTER,
      version: UniversalRouterVersion.V1_2,
      deadlineOrPreviousBlockhash: parseDeadline('1800'),
      recipient: '0x123',
      slippageTolerance: new Percent(5),
      ...allFeeOptions,
    }

    expect(swapParams.fee).toBeDefined()
    expect(swapParams.fee!.fee.equalTo(parsePortionPercent(15))).toBe(true)
    expect(swapParams.fee!.recipient).toEqual('0x123')

    expect(swapParams.flatFee).toBeUndefined()
  })

  it('populateFeeOptions exact out', () => {
    const allFeeOptions = populateFeeOptions('exactOut', undefined, '0x123', '35')

    const swapParams: SwapOptions = {
      type: SwapType.UNIVERSAL_ROUTER,
      version: UniversalRouterVersion.V1_2,
      deadlineOrPreviousBlockhash: parseDeadline('1800'),
      recipient: '0x123',
      slippageTolerance: new Percent(5),
      ...allFeeOptions,
    }

    expect(swapParams.flatFee).toBeDefined()
    expect(swapParams.flatFee!.amount.toString()).toEqual('35')
    expect(swapParams.flatFee!.recipient).toEqual('0x123')

    expect(swapParams.fee).toBeUndefined()
  })
})
