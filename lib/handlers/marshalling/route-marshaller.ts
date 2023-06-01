import { MixedRoute, V2Route, V3Route } from '@uniswap/smart-order-router/build/main/routers'
import { Protocol } from '@uniswap/router-sdk'
import { MarshalledToken, TokenMarshaller } from './token-marshaller'
import { MarshalledPair, PairMarshaller } from './pair-marshaller'
import { MarshalledPool, PoolMarshaller } from './pool-marshaller'
import { Pool } from '@uniswap/v3-sdk'

export interface MarshalledV2Route {
  protocol: Protocol
  input: MarshalledToken
  output: MarshalledToken
  pairs: MarshalledPair[]
}

export interface MarshalledV3Route {
  protocol: Protocol
  input: MarshalledToken
  output: MarshalledToken
  pools: MarshalledPool[]
}

export interface MarshalledMixedRoute {
  protocol: Protocol
  input: MarshalledToken
  output: MarshalledToken
  pools: (MarshalledPool | MarshalledPair)[]
}

export type MarshalledRoute = MarshalledV2Route | MarshalledV3Route | MarshalledMixedRoute

export class RouteMarshaller {
  public static marshal(route: V3Route | V2Route | MixedRoute): MarshalledRoute {
    switch (route.protocol) {
      case Protocol.V2:
        return {
          protocol: Protocol.V2,
          input: TokenMarshaller.marshal(route.input),
          output: TokenMarshaller.marshal(route.output),
          pairs: route.pairs.map((pair) => PairMarshaller.marshal(pair)),
        }
      case Protocol.V3:
        return {
          protocol: Protocol.V3,
          input: TokenMarshaller.marshal(route.input),
          output: TokenMarshaller.marshal(route.output),
          pools: route.pools.map((pool) => PoolMarshaller.marshal(pool)),
        }
      case Protocol.MIXED:
        return {
          protocol: Protocol.MIXED,
          input: TokenMarshaller.marshal(route.input),
          output: TokenMarshaller.marshal(route.output),
          pools: route.pools.map((tpool) => {
            if (tpool instanceof Pool) {
              return PoolMarshaller.marshal(tpool)
            } else {
              return PairMarshaller.marshal(tpool)
            }
          }),
        }
    }
  }

  public static unmarshal(marshalledRoute: MarshalledRoute): V3Route | V2Route | MixedRoute {
    switch (marshalledRoute.protocol) {
      case Protocol.V2:
        const v2Route = marshalledRoute as MarshalledV2Route
        return new V2Route(
          v2Route.pairs.map((marshalledPair) => PairMarshaller.unmarshal(marshalledPair)),
          TokenMarshaller.unmarshal(v2Route.input),
          TokenMarshaller.unmarshal(v2Route.output)
        )
      case Protocol.V3:
        const v3Route = marshalledRoute as MarshalledV3Route
        return new V3Route(
          v3Route.pools.map((marshalledPool) => PoolMarshaller.unmarshal(marshalledPool)),
          TokenMarshaller.unmarshal(v3Route.input),
          TokenMarshaller.unmarshal(v3Route.output)
        )
      case Protocol.MIXED:
        const mixedRoute = marshalledRoute as MarshalledMixedRoute
        const tpools = mixedRoute.pools.map((tpool) => {
          if (tpool.protocol === Protocol.V2) {
            return PairMarshaller.unmarshal(tpool as MarshalledPair)
          } else {
            return PoolMarshaller.unmarshal(tpool as MarshalledPool)
          }
        })

        return new MixedRoute(
          tpools,
          TokenMarshaller.unmarshal(mixedRoute.input),
          TokenMarshaller.unmarshal(mixedRoute.output)
        )
    }
  }
}
