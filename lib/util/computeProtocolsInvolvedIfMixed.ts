import { CachedRoute, log, SupportedRoutes } from '@uniswap/smart-order-router'
import { Protocol } from '@uniswap/router-sdk'
import { Pair } from '@uniswap/v2-sdk'
import { Pool as V3Pool } from '@uniswap/v3-sdk'
import { Pool as V4Pool } from '@uniswap/v4-sdk'

export function computeProtocolsInvolvedIfMixed(route: CachedRoute<SupportedRoutes>): Set<Protocol> {
  if (route.route.protocol === Protocol.MIXED) {
    return new Set(
      route.route.pools
        .map((pool) => {
          if (pool instanceof Pair) {
            return Protocol.V2
          }

          if (pool instanceof V3Pool) {
            return Protocol.V3
          }

          if (pool instanceof V4Pool) {
            return Protocol.V4
          }

          log.error('Unknown pool type. we will just return Protocol.V4.', pool)

          // default is Protocol.V4
          return Protocol.V4
        })
        .sort((a, b) => a.toString().localeCompare(b.toString()))
    )
  } else {
    return new Set()
  }
}
