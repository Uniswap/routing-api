import { TradeType } from '@uniswap/sdk-core'
import { ChainId } from '@uniswap/smart-order-router'

interface PairTradeTypeChainIdArgs {
  tokenIn: string
  tokenOut: string
  tradeType: TradeType
  chainId: ChainId
}

export class PairTradeTypeChainId {
  tokenIn: string
  tokenOut: string
  tradeType: TradeType
  chainId: ChainId

  constructor({tokenIn, tokenOut, tradeType, chainId}: PairTradeTypeChainIdArgs) {
    this.tokenIn = tokenIn
    this.tokenOut = tokenOut
    this.tradeType = tradeType
    this.chainId = chainId
  }
}