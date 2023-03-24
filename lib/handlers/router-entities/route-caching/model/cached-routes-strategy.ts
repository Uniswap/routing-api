import { Currency, CurrencyAmount } from '@uniswap/sdk-core'
import { CachedRoutesParameters } from './cached-routes-parameters'

export class CachedRoutesStrategy {
  public readonly cachingParameters: Map<number, CachedRoutesParameters>
  private buckets: number[]
  private cachedCachingParameters: Map<CurrencyAmount<Currency>, CachedRoutesParameters> = new Map()

  constructor(cachedRoutesParameters: CachedRoutesParameters[]) {
    this.buckets = cachedRoutesParameters.map((params) => params.bucket).sort()
    this.cachingParameters = new Map(cachedRoutesParameters.map((params) => [params.bucket, params]))
  }

  public getCachingParameters(amount: CurrencyAmount<Currency>): CachedRoutesParameters | undefined {
    const fromMemoryCache = this.cachedCachingParameters.get(amount)

    if (fromMemoryCache) {
      return fromMemoryCache
    } else {
      // Find the first bucket which is greater or equal than the amount.
      // If no bucket is found it means it's not supposed to be cached.
      // e.g. if buckets = [10, 50, 100, 500, 1000] and amount = 0.10, then bucket = 10
      // e.g.2. if amount = 501, then bucket = 1000. If amount = 1001 then bucket = undefined
      const bucket = this.buckets.find((bucket) => amount.lessThan(bucket) || amount.equalTo(bucket))

      if (bucket) {
        const cachingParameter = this.cachingParameters.get(bucket)
        if (cachingParameter) {
          this.cachedCachingParameters.set(amount, cachingParameter)

          return cachingParameter
        }
      }

      return undefined
    }
  }
}
