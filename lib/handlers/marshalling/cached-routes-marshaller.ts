import { CachedRoutes } from '@uniswap/smart-order-router'
import { ChainId, TradeType } from '@uniswap/sdk-core'
import { Protocol } from '@uniswap/router-sdk'
import { MarshalledCurrency, TokenMarshaller } from './token-marshaller'
import { CachedRouteMarshaller, MarshalledCachedRoute } from './cached-route-marshaller'

export interface MarshalledCachedRoutes {
  routes: MarshalledCachedRoute[]
  chainId: ChainId
  tokenIn: MarshalledCurrency
  tokenOut: MarshalledCurrency
  protocolsCovered: Protocol[]
  blockNumber: number
  tradeType: TradeType
  originalAmount: string
  blocksToLive: number
}

export class CachedRoutesMarshaller {
  public static marshal(cachedRoutes: CachedRoutes): MarshalledCachedRoutes {
    return {
      routes: cachedRoutes.routes.map((route) => CachedRouteMarshaller.marshal(route)),
      chainId: cachedRoutes.chainId,
      tokenIn: TokenMarshaller.marshal(cachedRoutes.currencyIn),
      tokenOut: TokenMarshaller.marshal(cachedRoutes.currencyOut),
      protocolsCovered: cachedRoutes.protocolsCovered,
      blockNumber: cachedRoutes.blockNumber,
      tradeType: cachedRoutes.tradeType,
      originalAmount: cachedRoutes.originalAmount,
      blocksToLive: cachedRoutes.blocksToLive,
    }
  }

  public static unmarshal(marshalledCachedRoutes: MarshalledCachedRoutes): CachedRoutes {
    return new CachedRoutes({
      routes: marshalledCachedRoutes.routes.map((route) => CachedRouteMarshaller.unmarshal(route)),
      chainId: marshalledCachedRoutes.chainId,
      currencyIn: TokenMarshaller.unmarshal(marshalledCachedRoutes.tokenIn),
      currencyOut: TokenMarshaller.unmarshal(marshalledCachedRoutes.tokenOut),
      protocolsCovered: marshalledCachedRoutes.protocolsCovered,
      blockNumber: marshalledCachedRoutes.blockNumber,
      tradeType: marshalledCachedRoutes.tradeType,
      originalAmount: marshalledCachedRoutes.originalAmount,
      blocksToLive: marshalledCachedRoutes.blocksToLive,
    })
  }
}
