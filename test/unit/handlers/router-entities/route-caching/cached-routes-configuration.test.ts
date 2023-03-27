import { expect } from 'chai'
import { TradeType } from '@uniswap/sdk-core'
import { ChainId } from '@uniswap/smart-order-router'
import {
  CACHED_ROUTES_CONFIGURATION,
  PairTradeTypeChainId
} from '../../../../../lib/handlers/router-entities/route-caching'

describe('CachedRoutesConfiguration', () => {
  it('can find the strategy for a pair with configuration', () => {
    const pairToLookup = new PairTradeTypeChainId({
      tokenIn: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
      tokenOut: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
      tradeType: TradeType.EXACT_INPUT,
      chainId: ChainId.MAINNET,
    })

    expect(CACHED_ROUTES_CONFIGURATION.get(pairToLookup.toString())).to.not.be.undefined
  })
})