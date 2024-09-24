import { ChainId, TradeType } from '@uniswap/sdk-core'
import { CachedRoutes, getAddress } from '@uniswap/smart-order-router'

interface PairTradeTypeChainIdArgs {
  currencyIn: string
  currencyOut: string
  tradeType: TradeType
  chainId: ChainId
}

/**
 * Class used to model the partition key of the CachedRoutes cache database and configuration.
 */
export class PairTradeTypeChainId {
  public readonly currencyIn: string
  public readonly currencyOut: string
  public readonly tradeType: TradeType
  public readonly chainId: ChainId

  constructor({ currencyIn, currencyOut, tradeType, chainId }: PairTradeTypeChainIdArgs) {
    this.currencyIn = currencyIn.toLowerCase() // All currency addresses should be lower case for normalization.
    this.currencyOut = currencyOut.toLowerCase() // All currency addresses should be lower case for normalization.
    this.tradeType = tradeType
    this.chainId = chainId
  }

  public toString(): string {
    return `${this.currencyIn}/${this.currencyOut}/${this.tradeType}/${this.chainId}`
  }

  public static fromCachedRoutes(cachedRoutes: CachedRoutes): PairTradeTypeChainId {
    return new PairTradeTypeChainId({
      currencyIn: getAddress(cachedRoutes.currencyIn),
      currencyOut: getAddress(cachedRoutes.currencyOut),
      tradeType: cachedRoutes.tradeType,
      chainId: cachedRoutes.chainId,
    })
  }
}
