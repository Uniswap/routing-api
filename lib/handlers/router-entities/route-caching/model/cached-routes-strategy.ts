import { Currency, CurrencyAmount, TradeType } from '@uniswap/sdk-core'
import { CachedRoutesBucket } from './cached-routes-bucket'
import { CacheMode, ChainId } from '@uniswap/smart-order-router'

interface CachedRoutesStrategyArgs {
  pair: string
  tradeType: TradeType
  chainId: ChainId
  buckets: CachedRoutesBucket[]
}

/**
 * Models out the strategy for categorizing cached routes into buckets by amount traded
 */
export class CachedRoutesStrategy {
  readonly pair: string
  readonly _tradeType: TradeType
  readonly chainId: ChainId
  readonly willTapcompare: boolean
  private buckets: number[]
  private bucketsMap: Map<number, CachedRoutesBucket>

  /**
   * @param pair
   * @param tradeType
   * @param chainId
   * @param buckets
   */
  constructor({ pair, tradeType, chainId, buckets }: CachedRoutesStrategyArgs) {
    this.pair = pair
    this._tradeType = tradeType
    this.chainId = chainId

    // Used for deciding to show metrics in the dashboard related to Tapcompare
    this.willTapcompare = buckets.find((bucket) => bucket.cacheMode == CacheMode.Tapcompare) != undefined

    // It is important that we sort the buckets in ascendant order for the algorithm to work correctly.
    // For a strange reason the `.sort()` function was comparing the number as strings, so I had to pass a compareFn.
    this.buckets = buckets.map((params) => params.bucket).sort((a, b) => a - b)

    // Create a Map<bucket, CachedRoutesBucket> for easy lookup once we find a bucket.
    this.bucketsMap = new Map(buckets.map((params) => [params.bucket, params]))
  }

  public get tradeType(): string {
    return this._tradeType == TradeType.EXACT_INPUT ? 'ExactIn' : 'ExactOut'
  }

  public readablePairTradeTypeChainId(): string {
    return `${this.pair.toUpperCase()}/${this.tradeType}/${this.chainId}`
  }

  public bucketPairs(): [number, number][] {
    if (this.buckets.length > 0) {
      const firstBucket: [number, number][] = [[0, this.buckets[0]]]
      const middleBuckets: [number, number][] =
        this.buckets.length > 1
          ? this.buckets.slice(0, -1).map((bucket, i): [number, number] => [bucket, this.buckets[i + 1]!])
          : []
      const lastBucket: [number, number][] = [[this.buckets.slice(-1)[0], -1]]

      return firstBucket.concat(middleBuckets).concat(lastBucket)
    } else {
      return []
    }
  }

  /**
   * Given an amount, we will search the bucket that has a cached route for that amount based on the CachedRoutesBucket array
   * @param amount
   */
  public getCachingBucket(amount: CurrencyAmount<Currency>): CachedRoutesBucket | undefined {
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
      // if a bucket was found, return the CachedRoutesBucket associated to that bucket.
      return this.bucketsMap.get(bucket)
    }

    return undefined
  }
}
