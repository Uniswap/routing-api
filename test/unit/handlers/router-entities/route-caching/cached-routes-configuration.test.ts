import { expect } from 'chai'
import { CurrencyAmount, Token, TradeType } from '@uniswap/sdk-core'
import { CacheMode, ChainId } from '@uniswap/smart-order-router'
import {
  CACHED_ROUTES_CONFIGURATION,
  PairTradeTypeChainId,
} from '../../../../../lib/handlers/router-entities/route-caching'

describe('CachedRoutesConfiguration', () => {
  const WETH = new Token(ChainId.MAINNET, '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', 18, 'WETH')

  it('can find the strategy for a pair with configuration', () => {
    const pairToLookup = new PairTradeTypeChainId({
      tokenIn: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
      tokenOut: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
      tradeType: TradeType.EXACT_INPUT,
      chainId: ChainId.MAINNET,
    })

    const fetchedStrategy = CACHED_ROUTES_CONFIGURATION.get(pairToLookup.toString())

    expect(fetchedStrategy).to.not.be.undefined

    const currencyAmount = CurrencyAmount.fromRawAmount(WETH, 1 * 10 ** WETH.decimals)
    const cachingParameters = fetchedStrategy?.getCachingBucket(currencyAmount)

    expect(cachingParameters?.bucket).to.eq(1)
    expect(cachingParameters?.cacheMode).to.eq(CacheMode.Livemode)
  })

  it('can find the strategy, even if token has different capitalization', () => {
    const pairToLookup = new PairTradeTypeChainId({
      tokenIn: '0xC02AAA39b223fe8d0a0e5c4f27EAD9083c756cc2', // WETH
      tokenOut: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
      tradeType: TradeType.EXACT_INPUT,
      chainId: ChainId.MAINNET,
    })

    const fetchedStrategy = CACHED_ROUTES_CONFIGURATION.get(pairToLookup.toString())

    expect(fetchedStrategy).to.not.be.undefined

    const currencyAmount = CurrencyAmount.fromRawAmount(WETH, 1 * 10 ** WETH.decimals)
    const cachingParameters = fetchedStrategy?.getCachingBucket(currencyAmount)

    expect(cachingParameters?.bucket).to.eq(1)
  })

  it('can find the strategy using a different amount', () => {
    const pairToLookup = new PairTradeTypeChainId({
      tokenIn: '0xC02AAA39b223fe8d0a0e5c4f27EAD9083c756cc2', // WETH
      tokenOut: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
      tradeType: TradeType.EXACT_INPUT,
      chainId: ChainId.MAINNET,
    })

    const fetchedStrategy = CACHED_ROUTES_CONFIGURATION.get(pairToLookup.toString())

    expect(fetchedStrategy).to.not.be.undefined

    const currencyAmount = CurrencyAmount.fromRawAmount(WETH, 5 * 10 ** WETH.decimals)
    const cachingParameters = fetchedStrategy?.getCachingBucket(currencyAmount)

    expect(cachingParameters?.bucket).to.eq(5)
  })

  it('returns undefined when strategy doesnt exist', () => {
    const pairToLookup = new PairTradeTypeChainId({
      tokenIn: '0xC02AAA39b223fe8d0a0e5c4f27EAD9083c756cc2', // WETH
      tokenOut: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
      tradeType: TradeType.EXACT_OUTPUT,
      chainId: ChainId.MAINNET,
    })

    const fetchedStrategy = CACHED_ROUTES_CONFIGURATION.get(pairToLookup.toString())

    expect(fetchedStrategy).to.be.undefined
  })
})
