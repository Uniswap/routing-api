import { Currency, CurrencyAmount } from '@uniswap/sdk-core'
import { CachedRoutesParameters } from './cached-routes-parameters'

/**
 * Models out the strategy for categorizing cached routes into buckets by amount traded
 */
export class CachedRoutesStrategy {
  private cachingParameters: Map<number, CachedRoutesParameters>
  private buckets: number[]

  /**
   * The constructor receives an array of `CachedRoutesParameters`, the extracts and sorts the buckets,
   * and creates a Map<bucket, CachedRouteParameters>
   * @param cachedRoutesParameters
   */
  constructor(cachedRoutesParameters: CachedRoutesParameters[]) {
    // It is important that we sort the buckets in ascendant order for the algorithm to work correctly.
    // For a strange reason the `.sort()` function was comparing the number as strings, so I had to pass a compareFn.
    this.buckets = cachedRoutesParameters.map((params) => params.bucket).sort((a, b) => a - b)

    // Create a Map<bucket, CachedRouteParameters> for easy lookup once we find a bucket.
    this.cachingParameters = new Map(cachedRoutesParameters.map((params) => [params.bucket, params]))
  }

  /**
   * Given an amount, we will search the bucket that has a cached route for that amount based on the CachedRoutesParameters array
   * @param amount
   */
  public getCachingParameters(amount: CurrencyAmount<Currency>): CachedRoutesParameters | undefined {
    // Find the first bucket which is greater or equal than the amount.
    // If no bucket is found it means it's not supposed to be cached.
    // e.g. let buckets = [10, 50, 100, 500, 1000]
    // e.g.1. if amount = 0.10, then bucket = 10
    // e.g.2. if amount = 501, then bucket = 1000
    // e.g.3. If amount = 1001 then bucket = undefined
    const bucket = this.buckets.find((bucket: number) => {
      // Create a CurrencyAmount object to compare the amount with the bucket.
      const bucketCurrency = CurrencyAmount.fromRawAmount(amount.currency, bucket * 10 ** amount.currency.decimals)

      // Given that the array of buckets is sorted, we want to find the first bucket that makes the amount lessThanOrEqual to the bucket
      // refer to the examples above
      return amount.lessThan(bucketCurrency) || amount.equalTo(bucketCurrency)
    })

    if (bucket) {
      // if a bucket was found, return the CachedRoutesParameters associated to that bucket.
      return this.cachingParameters.get(bucket)
    }

    return undefined
  }
}
