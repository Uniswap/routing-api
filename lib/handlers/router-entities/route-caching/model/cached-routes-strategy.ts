import { CacheMode } from '@uniswap/smart-order-router'
import { Currency, CurrencyAmount } from '@uniswap/sdk-core'

export class CachedRoutesStrategy {
  public readonly cachingParameters: Map<number, CachedRoutesParameters>
  private buckets: number[]
  private cachedCachingParameters: Map<CurrencyAmount<Currency>, [number, CachedRoutesParameters]> = new Map()

  constructor(cachingParameters: Map<number, CachedRoutesParameters>) {
    this.buckets = Array.from(cachingParameters.keys()).sort()
    this.cachingParameters = cachingParameters
  }

  public getCachingParameters(amount: CurrencyAmount<Currency>): [number, CachedRoutesParameters] | undefined {
    const fromMemoryCache = this.cachedCachingParameters.get(amount)

    if (fromMemoryCache) {
      return fromMemoryCache
    } else {
      const bucket = this.buckets.find((bucket) => amount.lessThan(bucket))

      if (bucket) {
        const cachingParameter = this.cachingParameters.get(bucket)
        if (cachingParameter) {
          this.cachedCachingParameters.set(amount, [bucket, cachingParameter])

          return [bucket, cachingParameter]
        }
      }

      return undefined
    }
  }
}

export class CachedRoutesParameters {
  public readonly blocksToLive: number
  public readonly cacheMode: CacheMode
  constructor({ blocksToLive, cacheMode }: { blocksToLive: number; cacheMode: CacheMode }) {
    this.blocksToLive = blocksToLive
    this.cacheMode = cacheMode
  }
}
