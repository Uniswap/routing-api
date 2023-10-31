import { expect } from 'chai'
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

describe('shared', async () => {
  it('parsePortionPercent', () => {
    const percent = parsePortionPercent(10000)
    expect(percent.quotient.toString()).to.equal('1')
  })

  it('parseFeePortions', () => {
    const feeOptions = parseFeeOptions(10000, '0x123')
    expect(feeOptions).not.to.be.undefined

    if (feeOptions) {
      expect(feeOptions.fee.quotient.toString()).to.equal('1')
      expect(feeOptions.recipient).to.equal('0x123')
    }
  })

  it('parseFlatFeePortions', () => {
    const flatFeeOptionsent = parseFlatFeeOptions('35', '0x123')
    expect(flatFeeOptionsent).not.to.be.undefined

    if (flatFeeOptionsent) {
      expect(flatFeeOptionsent.amount.toString()).to.equal('35')
      expect(flatFeeOptionsent.recipient).to.equal('0x123')
    }
  })

  it('computePortionAmount', async () => {
    const amount = await getAmount(1, 'EXACT_OUTPUT', 'ETH', 'DAI', '1')
    const daiAmount = CurrencyAmount.fromRawAmount(DAI_MAINNET, amount)
    const portionAmount = computePortionAmount(daiAmount, 15)
    expect(portionAmount).not.to.be.undefined

    if (portionAmount) {
      expect(portionAmount).to.equal(daiAmount.multiply(parsePortionPercent(15)).quotient.toString())
    }
  })

  it('populateFeeOptions exact in', () => {
    const allFeeOptions = populateFeeOptions('exactIn', 15, '0x123')

    const swapParams: SwapOptions = {
      type: SwapType.UNIVERSAL_ROUTER,
      deadlineOrPreviousBlockhash: parseDeadline('1800'),
      recipient: '0x123',
      slippageTolerance: new Percent(5),
      ...allFeeOptions,
    }

    expect(swapParams.fee).not.to.be.undefined
    expect(swapParams.fee!.fee.equalTo(parsePortionPercent(15))).to.be.true
    expect(swapParams.fee!.recipient).to.equal('0x123')

    expect(swapParams.flatFee).to.be.undefined
  })

  it('populateFeeOptions exact out', () => {
    const allFeeOptions = populateFeeOptions('exactOut', undefined, '0x123', '35')

    const swapParams: SwapOptions = {
      type: SwapType.UNIVERSAL_ROUTER,
      deadlineOrPreviousBlockhash: parseDeadline('1800'),
      recipient: '0x123',
      slippageTolerance: new Percent(5),
      ...allFeeOptions,
    }

    expect(swapParams.flatFee).not.to.be.undefined
    expect(swapParams.flatFee!.amount.toString()).to.equal('35')
    expect(swapParams.flatFee!.recipient).to.equal('0x123')

    expect(swapParams.fee).to.be.undefined
  })
})
