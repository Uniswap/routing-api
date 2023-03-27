import { Currency, CurrencyAmount } from '@uniswap/sdk-core'
import { CachedRoutesParameters } from './cached-routes-parameters'
import { log } from '@uniswap/smart-order-router'

export class CachedRoutesStrategy {
  private cachingParameters: Map<number, CachedRoutesParameters>
  private buckets: number[]

  constructor(cachedRoutesParameters: CachedRoutesParameters[]) {
    this.buckets = cachedRoutesParameters.map((params) => params.bucket).sort((a, b) => a-b)
    this.cachingParameters = new Map(cachedRoutesParameters.map((params) => [params.bucket, params]))
  }

  public getCachingParameters(amount: CurrencyAmount<Currency>): CachedRoutesParameters | undefined {
    // Find the first bucket which is greater or equal than the amount.
    // If no bucket is found it means it's not supposed to be cached.
    // e.g. if buckets = [10, 50, 100, 500, 1000] and amount = 0.10, then bucket = 10
    // e.g.2. if amount = 501, then bucket = 1000. If amount = 1001 then bucket = undefined
    const bucket = this.buckets.find((bucket) => {
      const bucketCurrency = CurrencyAmount.fromRawAmount(amount.currency, bucket * (10 ** amount.currency.decimals))
      log.info(`Looking for ${amount.currency.symbol} bucket for ${amount.toExact()}. Currently checking ${bucketCurrency.toExact()}`)
      return amount.lessThan(bucketCurrency) || amount.equalTo(bucketCurrency)
    })

    if (bucket) {
      return this.cachingParameters.get(bucket)
    }

    return undefined
  }
}
