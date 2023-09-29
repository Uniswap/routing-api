import { expect } from 'chai'
import { parsePortion, parsePortionPercent } from '../../../../lib/handlers/shared'

describe('shared', async () => {
  it('parsePortionPercent', () => {
    const percent = parsePortionPercent('10000')
    expect(percent.quotient.toString()).to.equal('100')
  })

  it('parsePortion', () => {
    const percent = parsePortion('10000', '0x123')
    expect(percent).not.to.be.undefined

    if (percent) {
      expect(percent.fee.quotient.toString()).to.equal('100')
      expect(percent.recipient).to.equal('0x123')
    }
  })
})
