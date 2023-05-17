import { expect } from 'chai'
import { CachedRoutesWidgetsFactory } from '../../../lib/dashboards/cached-routes-widgets-factory'

const widgetsFactory = new CachedRoutesWidgetsFactory('Uniswap', 'us-west-1', 'lambda')

describe('CachedRoutesWidgetsFactory', () => {
  it('works', () => {
    const widgets = widgetsFactory.generateWidgets()
    // It's hard to write a meaningful test here.
    expect(widgets).to.have.length.greaterThan(0)
  })
})
