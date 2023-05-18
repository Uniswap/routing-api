import { Protocol } from '@pollum-io/router-sdk'
import { ChainId } from '@pollum-io/smart-order-router'

export const S3_POOL_CACHE_KEY = (baseKey: string, chain: ChainId, protocol: Protocol) =>
  `${baseKey}-${chain}-${protocol}`
