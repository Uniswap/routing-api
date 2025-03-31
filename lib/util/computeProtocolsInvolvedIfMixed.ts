import { CachedRoute, SupportedRoutes } from '@uniswap/smart-order-router'
import { Protocol } from '@uniswap/router-sdk'
import { Pair } from '@uniswap/v2-sdk'
import { Pool as V3Pool } from '@uniswap/v3-sdk'
import { Pool as V4Pool } from '@uniswap/v4-sdk'

export function computeProtocolsInvolvedIfMixed(route: CachedRoute<SupportedRoutes>): Protocol[] {
  if (route.route.protocol === Protocol.MIXED) {
    return route.route.pools.map((pool) => {
      if (pool instanceof Pair) {
        return Protocol.V2
      }

      if (pool instanceof V3Pool) {
        return Protocol.V3
      }

      if (pool instanceof V4Pool) {
        return Protocol.V4
      }

      throw new Error(`Unsupported pool type ${JSON.stringify(pool)}`)
    })
  } else {
    return []
  }
}
