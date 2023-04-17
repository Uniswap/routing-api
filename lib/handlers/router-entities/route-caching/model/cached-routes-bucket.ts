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
  /**
   * Defines the max number of splits allowed for a route to be cached. A value of 0 indicates that any splits are allowed
   * A value of 1 indicates that at most there can only be 1 split in the route in order to be cached.
   */
  maxSplits?: number
  /**
   * When fetching the CachedRoutes, we could opt for using the last N routes, from the last N blocks
   * This way we would query the price for all the recent routes that have been cached as the best routes
   */
  withLastNCachedRoutes?: number
}

export class CachedRoutesBucket {
  public readonly bucket: number
  public readonly blocksToLive: number
  public readonly cacheMode: CacheMode
  public readonly maxSplits: number
  public readonly withLastNCachedRoutes: number

  constructor({
    bucket,
    blocksToLive = 1,
    cacheMode,
    maxSplits = 0,
    withLastNCachedRoutes = 1,
  }: CachedRoutesBucketsArgs) {
    this.bucket = bucket
    this.blocksToLive = blocksToLive // by default this value is 1, which means it's only cached in the current block.
    this.cacheMode = cacheMode
    this.maxSplits = maxSplits // by default this value is 0, which means that any number of splits are allowed
    this.withLastNCachedRoutes = withLastNCachedRoutes
  }
}
