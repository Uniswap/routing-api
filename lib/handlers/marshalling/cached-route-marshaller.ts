import { CachedRoute, SupportedRoutes } from '@uniswap/smart-order-router'
import { MarshalledRoute, RouteMarshaller } from './route-marshaller'

export interface MarshalledCachedRoute {
  route: MarshalledRoute
  percent: number
}

export class CachedRouteMarshaller {
  public static marshal(cachedRoute: CachedRoute<SupportedRoutes>): MarshalledCachedRoute {
    return {
      route: RouteMarshaller.marshal(cachedRoute.route),
      percent: cachedRoute.percent,
    }
  }

  public static unmarshal(marshalledCachedRoute: MarshalledCachedRoute): CachedRoute<SupportedRoutes> {
    return new CachedRoute<SupportedRoutes>({
      route: RouteMarshaller.unmarshal(marshalledCachedRoute.route),
      percent: marshalledCachedRoute.percent,
    })
  }
}
