import { CacheMode } from '@uniswap/smart-order-router'

interface CachedRoutesParametersArgs {
  bucket: number
  blocksToLive: number
  cacheMode: CacheMode
}

export class CachedRoutesParameters {
  public readonly bucket: number
  public readonly blocksToLive: number
  public readonly cacheMode: CacheMode

  constructor({ bucket, blocksToLive, cacheMode }: CachedRoutesParametersArgs) {
    this.bucket = bucket
    this.blocksToLive = blocksToLive
    this.cacheMode = cacheMode
  }
}