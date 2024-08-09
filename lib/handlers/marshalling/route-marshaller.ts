import { MixedRoute, V2Route, V3Route, V4Route } from '@uniswap/smart-order-router/build/main/routers'
import { Protocol } from '@uniswap/router-sdk'
import { MarshalledToken, TokenMarshaller } from './token-marshaller'
import { MarshalledPair, PairMarshaller } from './pair-marshaller'
import { MarshalledPool as V3MarshalledPool, PoolMarshaller as V3PoolMarshaller } from './v3/pool-marshaller'
import { MarshalledPool as V4MarshalledPool, PoolMarshaller as V4PoolMarshaller } from './v4/pool-marshaller'
import { Pool as V3Pool } from '@uniswap/v3-sdk'
import { Pool as V4Pool } from '@uniswap/v4-sdk'
import { SupportedRoutes } from '@uniswap/smart-order-router'
import { Pair } from '@uniswap/v2-sdk'

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
  pools: V3MarshalledPool[]
}

export interface MarshalledV4Route {
  protocol: Protocol
  input: MarshalledToken
  output: MarshalledToken
  pools: V4MarshalledPool[]
}

export interface MarshalledMixedRoute {
  protocol: Protocol
  input: MarshalledToken
  output: MarshalledToken
  pools: (V4MarshalledPool | V3MarshalledPool | MarshalledPair)[]
}

export type MarshalledRoute = MarshalledV2Route | MarshalledV3Route | MarshalledMixedRoute

export class RouteMarshaller {
  public static marshal(route: SupportedRoutes): MarshalledRoute {
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
          pools: route.pools.map((pool) => V3PoolMarshaller.marshal(pool)),
        }
      case Protocol.V4:
        return {
          protocol: Protocol.V4,
          // TODO: ROUTE-217 - Support native currency routing in V4
          // token.wrapped is wrong for V4
          // Probably need to use the token symbol for native, and still use address for non-native tokens
          // Check later CELO token, which is both native and ERC20, which one to use
          input: TokenMarshaller.marshal(route.input.wrapped),
          output: TokenMarshaller.marshal(route.output.wrapped),
          pools: route.pools.map((pool) => V4PoolMarshaller.marshal(pool)),
        }
      case Protocol.MIXED:
        return {
          protocol: Protocol.MIXED,
          input: TokenMarshaller.marshal(route.input),
          output: TokenMarshaller.marshal(route.output),
          pools: route.pools.map((tpool) => {
            if (tpool instanceof V3Pool) {
              return V3PoolMarshaller.marshal(tpool)
            } else if (tpool instanceof V4Pool) {
              return V4PoolMarshaller.marshal(tpool)
            } else if (tpool instanceof Pair) {
              return PairMarshaller.marshal(tpool)
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
          v3Route.pools.map((marshalledPool) => V3PoolMarshaller.unmarshal(marshalledPool)),
          TokenMarshaller.unmarshal(v3Route.input),
          TokenMarshaller.unmarshal(v3Route.output)
        )
      case Protocol.V4:
        const v4Route = marshalledRoute as MarshalledV4Route
        return new V4Route(
          v4Route.pools.map((marshalledPool) => V4PoolMarshaller.unmarshal(marshalledPool)),
          TokenMarshaller.unmarshal(v4Route.input),
          TokenMarshaller.unmarshal(v4Route.output)
        )
      case Protocol.MIXED:
        const mixedRoute = marshalledRoute as MarshalledMixedRoute
        const tpools = mixedRoute.pools.map((tpool) => {
          switch (tpool.protocol) {
            case Protocol.V2:
              return PairMarshaller.unmarshal(tpool as MarshalledPair)
            case Protocol.V3:
              return V3PoolMarshaller.unmarshal(tpool as V3MarshalledPool)
            case Protocol.V4:
              return V4PoolMarshaller.unmarshal(tpool as V4MarshalledPool)
            default:
              throw new Error(`Unsupported protocol ${JSON.stringify(tpool)}`)
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
