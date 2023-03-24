import { CachedRoutes } from '@uniswap/smart-order-router'
import { ChainId } from '@uniswap/smart-order-router/build/main/util'
import { TradeType } from '@uniswap/sdk-core'
import { Protocol } from '@uniswap/router-sdk'
import { MarshalledToken, TokenMarshaller } from './token-marshaller'
import { CachedRouteMarshaller, MarshalledCachedRoute } from './cached-route-marshaller'

export interface MarshalledCachedRoutes {
  routes: MarshalledCachedRoute[]
  chainId: ChainId
  tokenIn: MarshalledToken
  tokenOut: MarshalledToken
  protocolsCovered: Protocol[]
  blockNumber: number
  tradeType: TradeType
  blocksToLive: number
}

export class CachedRoutesMarshaller {
  public static marshal(cachedRoutes: CachedRoutes): MarshalledCachedRoutes {
    return {
      routes: cachedRoutes.routes.map((route) => CachedRouteMarshaller.marshal(route)),
      chainId: cachedRoutes.chainId,
      tokenIn: TokenMarshaller.marshal(cachedRoutes.tokenIn),
      tokenOut: TokenMarshaller.marshal(cachedRoutes.tokenOut),
      protocolsCovered: cachedRoutes.protocolsCovered,
      blockNumber: cachedRoutes.blockNumber,
      tradeType: cachedRoutes.tradeType,
      blocksToLive: cachedRoutes.blocksToLive,
    }
  }

  // public static unmarshal(marshalledCachedRoutes: ICachedRoutes): CachedRoutes {
  //   const cachedRoutes = new CachedRoutes(
  //     marshalledCachedRoutes.routes.map((route) => CachedRoutesMarshaller.unmarshal(route)),
  //     marshalledCachedRoutes.chainId,
  //     TokenMarshaller.unmarshal(marshalledCachedRoutes.tokenIn),
  //     TokenMarshaller.unmarshal(marshalledCachedRoutes.tokenOut),
  //     marshalledCachedRoutes.protocolsCovered,
  //     marshalledCachedRoutes.blockNumber,
  //     marshalledCachedRoutes.tradeType
  //   )
  //
  //   cachedRoutes.blocksToLive = marshalledCachedRoutes.blocksToLive;
  // }
}
