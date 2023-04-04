import { expect } from 'chai'
import { PairTradeTypeChainId } from '../../../../../../lib/handlers/router-entities/route-caching'
import { TradeType } from '@uniswap/sdk-core'
import { ChainId } from '@uniswap/smart-order-router'
describe('PairTradeTypeChainId', () => {
  const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
  const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'

  describe('toString', () => {
    it('returns a stringified version of the object', () => {
      const pairTradeTypeChainId = new PairTradeTypeChainId({
        tokenIn: WETH,
        tokenOut: USDC,
        tradeType: TradeType.EXACT_INPUT,
        chainId: ChainId.MAINNET,
      })

      expect(pairTradeTypeChainId.toString()).to.eq(
        `${WETH.toLowerCase()}/${USDC.toLowerCase()}/${TradeType.EXACT_INPUT}/${ChainId.MAINNET}`
      )
    })

    it('token addresses are converted to lowercase', () => {
      const pairTradeTypeChainId = new PairTradeTypeChainId({
        tokenIn: WETH.toUpperCase(),
        tokenOut: USDC.toUpperCase(),
        tradeType: TradeType.EXACT_INPUT,
        chainId: ChainId.MAINNET,
      })

      expect(pairTradeTypeChainId.toString()).to.eq(
        `${WETH.toLowerCase()}/${USDC.toLowerCase()}/${TradeType.EXACT_INPUT}/${ChainId.MAINNET}`
      )
    })

    it('works with ExactOutput too', () => {
      const pairTradeTypeChainId = new PairTradeTypeChainId({
        tokenIn: WETH.toUpperCase(),
        tokenOut: USDC.toUpperCase(),
        tradeType: TradeType.EXACT_OUTPUT,
        chainId: ChainId.MAINNET,
      })

      expect(pairTradeTypeChainId.toString()).to.eq(
        `${WETH.toLowerCase()}/${USDC.toLowerCase()}/${TradeType.EXACT_OUTPUT}/${ChainId.MAINNET}`
      )
    })

    it('works with other chains', () => {
      const pairTradeTypeChainId = new PairTradeTypeChainId({
        tokenIn: WETH.toUpperCase(),
        tokenOut: USDC.toUpperCase(),
        tradeType: TradeType.EXACT_OUTPUT,
        chainId: ChainId.ARBITRUM_ONE,
      })

      expect(pairTradeTypeChainId.toString()).to.eq(
        `${WETH.toLowerCase()}/${USDC.toLowerCase()}/${TradeType.EXACT_OUTPUT}/${ChainId.ARBITRUM_ONE}`
      )
    })
  })
})
