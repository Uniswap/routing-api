import { expect } from 'chai'
import { parseFeeOptions, parseFlatFeeOptions, parsePortionPercent } from '../../../../lib/handlers/shared'

describe('shared', async () => {
  it('parsePortionPercent', () => {
    const percent = parsePortionPercent('10000')
    expect(percent.quotient.toString()).to.equal('1')
  })

  it('parseFeePortions', () => {
    const feeOptions = parseFeeOptions('10000', '0x123')
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
})
