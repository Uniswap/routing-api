import { QuoteAmountsWidgets } from '../../../lib/dashboards/quote-amounts-widgets'
import { expect } from 'chai'
import { ChainId } from '@uniswap/smart-order-router'

const pairsToTrackPerChain: [ChainId, string[]][] = [
  [ChainId.MAINNET, ['WETH/USDC', 'USDC/WETH']],
  [ChainId.OPTIMISM, ['WETH/USDC', 'USDC/WETH']],
]
const quoteAmountsWidgets = new QuoteAmountsWidgets('Uniswap', 'us-west-1', pairsToTrackPerChain)

describe('Test widgets', () => {
  it('works', () => {
    const widgets = quoteAmountsWidgets.generateWidgets()
    // It's hard to write a meaningful test here.
    expect(widgets).to.have.length.greaterThan(0)
  })
})
