import { CacheMode } from '@uniswap/smart-order-router'

interface CachedRoutesBucketsArgs {
  /**
   * The bucket for these parameters, this bucket is defined in total units.
   * e.g. if bucket = 1 and currency (in CachedRoutesStrategy) is WETH, then this is 1 WETH.
   */
  bucket: number
  /**
   * For the cached route associated to this bucket, how many blocks should the cached route be valid for.
   */
  blocksToLive?: number
  /**
   * The CacheMode associated to this bucket. Setting it to `Livemode` will enable caching the route for this bucket
   */
  cacheMode: CacheMode
}

export class CachedRoutesBucket {
  public readonly bucket: number
  public readonly blocksToLive: number
  public readonly cacheMode: CacheMode

  constructor({ bucket, blocksToLive = 1, cacheMode }: CachedRoutesBucketsArgs) {
    this.bucket = bucket
    this.blocksToLive = blocksToLive // by default this value is 1, which means it's only cached in the current block.
    this.cacheMode = cacheMode
  }
}
