import { TradeType } from '@uniswap/sdk-core'
import { ChainId } from '@uniswap/smart-order-router'

interface PairTradeTypeChainIdArgs {
  tokenIn: string
  tokenOut: string
  tradeType: TradeType
  chainId: ChainId
}

/**
 * Class used to model the key in the `CACHED_ROUTES_CONFIGURATION`.
 */
export class PairTradeTypeChainId {
  private tokenIn: string
  private tokenOut: string
  private tradeType: TradeType
  private chainId: ChainId

  constructor({ tokenIn, tokenOut, tradeType, chainId }: PairTradeTypeChainIdArgs) {
    this.tokenIn = tokenIn.toLowerCase() // All token addresses should be lower case for normalization.
    this.tokenOut = tokenOut.toLowerCase() // All token addresses should be lower case for normalization.
    this.tradeType = tradeType
    this.chainId = chainId
  }

  public toString(): string {
    return `${this.tokenIn}/${this.tokenOut}/${this.tradeType}/${this.chainId}`
  }
}
