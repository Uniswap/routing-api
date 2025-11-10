import { MixedRoute, V3Route } from '@uniswap/smart-order-router/build/main/routers'
import { Protocol } from '@uniswap/router-sdk'
import { MarshalledCurrency, TokenMarshaller } from './token-marshaller'
import { MarshalledPool as V3MarshalledPool, PoolMarshaller as V3PoolMarshaller } from './v3/pool-marshaller'
import { Pool as V3Pool } from '@uniswap/v3-sdk'
import { SupportedRoutes } from '@uniswap/smart-order-router'

export interface MarshalledV3Route {
  protocol: Protocol
  input: MarshalledCurrency
  output: MarshalledCurrency
  pools: V3MarshalledPool[]
}

export interface MarshalledMixedRoute {
  protocol: Protocol
  input: MarshalledCurrency
  output: MarshalledCurrency
  pools: V3MarshalledPool[]
}

export type MarshalledRoute = MarshalledV3Route | MarshalledMixedRoute

export class RouteMarshaller {
  public static marshal(route: SupportedRoutes): MarshalledRoute {
    switch (route.protocol) {
      case Protocol.V3:
        return {
          protocol: Protocol.V3,
          input: TokenMarshaller.marshal(route.input),
          output: TokenMarshaller.marshal(route.output),
          pools: route.pools.map((pool) => V3PoolMarshaller.marshal(pool)),
        }
      case Protocol.MIXED:
        return {
          protocol: Protocol.MIXED,
          input: TokenMarshaller.marshal(route.input),
          output: TokenMarshaller.marshal(route.output),
          pools: route.pools.map((tpool) => {
            if (tpool instanceof V3Pool) {
              return V3PoolMarshaller.marshal(tpool)
            } else {
              throw new Error(`Unsupported pool type ${JSON.stringify(tpool)}`)
            }
          }),
        }
      default:
        throw new Error(`Unsupported protocol ${JSON.stringify(route)}`)
    }
  }

  public static unmarshal(marshalledRoute: MarshalledRoute): SupportedRoutes {
    switch (marshalledRoute.protocol) {
      case Protocol.V3:
        const v3Route = marshalledRoute as MarshalledV3Route
        return new V3Route(
          v3Route.pools.map((marshalledPool) => V3PoolMarshaller.unmarshal(marshalledPool)),
          TokenMarshaller.unmarshal(v3Route.input).wrapped,
          TokenMarshaller.unmarshal(v3Route.output).wrapped
        )
      case Protocol.MIXED:
        const mixedRoute = marshalledRoute as MarshalledMixedRoute
        const tpools = mixedRoute.pools.map((tpool) => {
          if (tpool.protocol === Protocol.V3) {
            return V3PoolMarshaller.unmarshal(tpool as V3MarshalledPool)
          } else {
            throw new Error(`Unsupported protocol ${JSON.stringify(tpool)}`)
          }
        })

        return new MixedRoute(
          tpools,
          TokenMarshaller.unmarshal(mixedRoute.input),
          TokenMarshaller.unmarshal(mixedRoute.output)
        )
      default:
        throw new Error(`Unsupported protocol ${JSON.stringify(marshalledRoute)}`)
    }
  }
}
