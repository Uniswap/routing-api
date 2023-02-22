import { QuoteAmountsWidgets } from '../../../lib/dashboards/quote-amounts-widgets'
import { SUPPORTED_CHAINS } from '../../../lib/handlers/injector-sor'
import { PAIRS_TO_TRACK } from '../../../lib/handlers/quote/util/pairs-to-track'
import { expect } from 'chai'

const quoteAmountsWidgets = new QuoteAmountsWidgets('Uniswap', 'us-west-1', SUPPORTED_CHAINS, PAIRS_TO_TRACK)

describe('Test widgets', () => {
  it('works', () => {
    const widgets = quoteAmountsWidgets.generateWidgets()
    // It's hard to write a meaningful test here.
    expect(widgets).to.have.length.greaterThan(0)
  })
})
