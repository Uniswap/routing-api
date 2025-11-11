import { CachedRoute, log, SupportedRoutes } from '@uniswap/smart-order-router'
import { Protocol } from '@uniswap/router-sdk'
import { Pool as V3Pool } from '@uniswap/v3-sdk'

export function computeProtocolsInvolvedIfMixed(route: CachedRoute<SupportedRoutes>): Set<Protocol> {
  if (route.route.protocol === Protocol.MIXED) {
    return new Set(
      route.route.pools
        .map((pool) => {
          if (pool instanceof V3Pool) {
            return Protocol.V3
          }

          log.error('Unknown pool type in V3-only deployment. Expected V3Pool.', pool)

          // default is Protocol.V3 for V3-only deployment
          return Protocol.V3
        })
        .sort((a, b) => a.toString().localeCompare(b.toString()))
    )
  } else {
    return new Set()
  }
}
