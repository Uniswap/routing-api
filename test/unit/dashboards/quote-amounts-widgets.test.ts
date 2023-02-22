import { QuoteAmountsWidgets } from '../../../lib/dashboards/quote-amounts-widgets'
import { expect } from 'chai'
import { ChainId } from '@uniswap/smart-order-router'

const pairsToTrackPerChain: [ChainId, string[]][] = [
  [ChainId.MAINNET, ['WETH/USDC', 'WETH/USDC']],
  [ChainId.OPTIMISM, ['WETH/USDC', 'WETH/USDC']]
]
const quoteAmountsWidgets = new QuoteAmountsWidgets('Uniswap', 'us-west-1', pairsToTrackPerChain)

describe('Test widgets', () => {
  it('works', () => {
    const widgets = quoteAmountsWidgets.generateWidgets()
    // It's hard to write a meaningful test here.
    expect(widgets).to.have.length.greaterThan(0)
  })
})
