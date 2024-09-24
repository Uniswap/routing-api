import { ChainId, TradeType } from '@uniswap/sdk-core'
import { CachedRoutes, getAddress } from '@uniswap/smart-order-router'
import { Protocol } from '@uniswap/router-sdk'

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
    // This is for backward compatibility with the existing cached routes, that doesn't include V4, i.e.. doesn't support native currency routing
    // If we are changing to use native currency address that doesn't have V4, we will have a temporary period of cached routes miss
    // because frontend can still send in native currency as tokenIn/tokenOut, and we are not caching the wrapped addresses.
    const currencyInAddress = cachedRoutes.protocolsCovered.includes(Protocol.V4)
      ? getAddress(cachedRoutes.currencyIn)
      : cachedRoutes.currencyIn.wrapped.address
    const currencyOutAddress = cachedRoutes.protocolsCovered.includes(Protocol.V4)
      ? getAddress(cachedRoutes.currencyOut)
      : cachedRoutes.currencyOut.wrapped.address

    return new PairTradeTypeChainId({
      currencyIn: currencyInAddress,
      currencyOut: currencyOutAddress,
      tradeType: cachedRoutes.tradeType,
      chainId: cachedRoutes.chainId,
    })
  }
}
