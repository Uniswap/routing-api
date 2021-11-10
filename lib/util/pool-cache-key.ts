import { ChainId } from '@uniswap/smart-order-router'
import { Protocol } from '@uniswap/smart-order-router/build/main/util/protocols'

export const S3_POOL_CACHE_KEY = (baseKey: string, chain: ChainId, protocol: Protocol) => `${baseKey}-${chain}-${protocol}`
