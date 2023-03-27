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

  constructor({ tokenIn, tokenOut, tradeType, chainId }: PairTradeTypeChainIdArgs) {
    this.tokenIn = tokenIn.toLowerCase()
    this.tokenOut = tokenOut.toLowerCase()
    this.tradeType = tradeType
    this.chainId = chainId
  }

  public toString(): string {
    return `${this.tokenIn.toLowerCase()}/${this.tokenOut.toLowerCase()}/${this.tradeType}/${this.chainId}`
  }
}
