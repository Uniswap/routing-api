import { TradeType } from '@uniswap/sdk-core'
import { CacheMode, ChainId } from '@uniswap/smart-order-router'
import { CachedRoutesParameters, CachedRoutesStrategy } from './model/cached-routes-strategy'

export class PairTradeTypeChainId {
  tokenIn: string
  tokenOut: string
  tradeType: TradeType
  chainId: ChainId

  constructor({
    tokenIn,
    tokenOut,
    tradeType,
    chainId,
  }: {
    tokenIn: string
    tokenOut: string
    tradeType: TradeType
    chainId: ChainId
  }) {
    this.tokenIn = tokenIn
    this.tokenOut = tokenOut
    this.tradeType = tradeType
    this.chainId = chainId
  }
}

// Manual definition for cached routes.
export const CACHED_ROUTES_CONFIGURATION: Map<PairTradeTypeChainId, CachedRoutesStrategy> = new Map([
  [
    new PairTradeTypeChainId({
      tokenIn: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
      tokenOut: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
      tradeType: TradeType.EXACT_INPUT,
      chainId: ChainId.MAINNET,
    }),
    new CachedRoutesStrategy(
      new Map([
        [1, new CachedRoutesParameters({ blocksToLive: 2, cacheMode: CacheMode.Tapcompare })],
        [5, new CachedRoutesParameters({ blocksToLive: 2, cacheMode: CacheMode.Tapcompare })],
        [10, new CachedRoutesParameters({ blocksToLive: 1, cacheMode: CacheMode.Tapcompare })],
        [50, new CachedRoutesParameters({ blocksToLive: 1, cacheMode: CacheMode.Tapcompare })],
        [100, new CachedRoutesParameters({ blocksToLive: 1, cacheMode: CacheMode.Tapcompare })],
        [500, new CachedRoutesParameters({ blocksToLive: 1, cacheMode: CacheMode.Tapcompare })],
      ])
    ),
  ],
  [
    new PairTradeTypeChainId({
      tokenIn: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
      tokenOut: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', //WETH
      tradeType: TradeType.EXACT_INPUT,
      chainId: ChainId.MAINNET,
    }),
    new CachedRoutesStrategy(
      new Map([
        [100, new CachedRoutesParameters({ blocksToLive: 2, cacheMode: CacheMode.Tapcompare })],
        [500, new CachedRoutesParameters({ blocksToLive: 2, cacheMode: CacheMode.Tapcompare })],
        [2500, new CachedRoutesParameters({ blocksToLive: 1, cacheMode: CacheMode.Tapcompare })],
        [5000, new CachedRoutesParameters({ blocksToLive: 1, cacheMode: CacheMode.Tapcompare })],
        [10000, new CachedRoutesParameters({ blocksToLive: 1, cacheMode: CacheMode.Tapcompare })],
        [50000, new CachedRoutesParameters({ blocksToLive: 1, cacheMode: CacheMode.Tapcompare })],
        [100000, new CachedRoutesParameters({ blocksToLive: 1, cacheMode: CacheMode.Tapcompare })],
        [500000, new CachedRoutesParameters({ blocksToLive: 1, cacheMode: CacheMode.Tapcompare })],
      ])
    ),
  ],
])
