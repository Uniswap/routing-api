import { Protocol } from '@juiceswapxyz/router-sdk'
import { ChainId } from '@juiceswapxyz/sdk-core'

export const S3_POOL_CACHE_KEY = (baseKey: string, chain: ChainId, protocol: Protocol) =>
  `${baseKey}-${chain}-${protocol}`
