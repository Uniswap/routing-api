import { Protocol } from '@uniswap/router-sdk'
import { ChainId, Currency, TradeType } from '@uniswap/sdk-core'
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
    const includesV4Pool = cachedRoutes.routes.some((route) => route.protocol === Protocol.V4)

    return new PairTradeTypeChainId({
      currencyIn: PairTradeTypeChainId.deriveCurrencyAddress(includesV4Pool, cachedRoutes.currencyIn),
      currencyOut: PairTradeTypeChainId.deriveCurrencyAddress(includesV4Pool, cachedRoutes.currencyOut),
      tradeType: cachedRoutes.tradeType,
      chainId: cachedRoutes.chainId,
    })
  }

  public static deriveCurrencyAddress(includesV4Pool: boolean, currency: Currency): string {
    return includesV4Pool ? getAddress(currency) : currency.wrapped.address
  }
}
