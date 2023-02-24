import { QuoteAmountsWidgetsFactory } from '../../../lib/dashboards/quote-amounts-widgets-factory'
import { expect } from 'chai'

const quoteAmountsWidgets = new QuoteAmountsWidgetsFactory('Uniswap', 'us-west-1')

describe('Test widgets', () => {
  it('works', () => {
    const widgets = quoteAmountsWidgets.generateWidgets()
    // It's hard to write a meaningful test here.
    expect(widgets).to.have.length.greaterThan(0)
  })
})
