import _ from 'lodash'
import { Widget } from './core/model/widget'
import { WidgetsFactory } from './core/widgets-factory'
import { CACHED_ROUTES_CONFIGURATION, CachedRoutesStrategy } from '../handlers/router-entities/route-caching'
import { TradeType } from '@uniswap/sdk-core'

export class CachedRoutesWidgetsFactory implements WidgetsFactory {
  region: string
  namespace: string
  lambdaName: string

  constructor(namespace: string, region: string, lambdaName: string) {
    this.region = region
    this.namespace = namespace
    this.lambdaName = lambdaName
  }

  generateWidgets(): Widget[] {
    const cacheHitMissMetrics = this.generateCacheHitMissMetricsWidgets()

    const quoteDiffMetrics = _.flatMap(Array.from(CACHED_ROUTES_CONFIGURATION.values()), (cacheStrategy) => {
      return this.generateQuoteDiffWidgetsFromPair(cacheStrategy)
    })

    return cacheHitMissMetrics.concat(quoteDiffMetrics)
  }

  private generateCacheHitMissMetricsWidgets(): Widget[] {
    return [
      {
        type: 'text',
        width: 24,
        height: 1,
        properties: {
          markdown: `# Overall Cache Hit/Miss`,
        },
      },
      {
        type: 'metric',
        width: 24,
        height: 6,
        properties: {
          view: 'timeSeries',
          stacked: false,
          metrics: [
            [this.namespace, 'GetCachedRoute_hit_livemode', 'Service', 'RoutingAPI', { label: 'Cache Hit' }],
            ['.', 'GetCachedRoute_miss_livemode', '.', '.', { label: 'Cache Miss' }],
          ],
          region: this.region,
          title: 'Cache Hit and Miss of Cachemode.Livemode',
          period: 300,
          stat: 'Sum',
        },
      },
      {
        type: 'metric',
        width: 24,
        height: 6,
        properties: {
          view: 'timeSeries',
          stacked: false,
          metrics: [
            [this.namespace, 'GetCachedRoute_hit_tapcompare', 'Service', 'RoutingAPI', { label: 'Cache Hit' }],
            ['.', 'GetCachedRoute_miss_tapcompare', '.', '.', { label: 'Cache Miss' }],
          ],
          region: this.region,
          title: 'Cache Hit and Miss of cachemode.Tapcompare',
          period: 300,
          stat: 'Sum',
        },
      },
    ]
  }

  private generateQuoteDiffWidgetsFromPair(cacheStrategy: CachedRoutesStrategy): Widget[] {
    const pairTradeTypeChainId = cacheStrategy.readablePairTradeTypeChainId()
    const getQuoteMetricName = `GET_QUOTE_AMOUNT_${cacheStrategy.pair}_${cacheStrategy.tradeType.toUpperCase()}_CHAIN_${
      cacheStrategy.chainId
    }`

    const quoteAmountsMetrics: Widget[] = [
      {
        type: 'text',
        width: 24,
        height: 1,
        properties: {
          markdown: `# Cached Routes Performance for ${pairTradeTypeChainId}`,
        },
      },
      {
        type: 'metric',
        width: 24,
        height: 6,
        properties: {
          view: 'timeSeries',
          stacked: false,
          metrics: [
            [
              this.namespace,
              getQuoteMetricName,
              'Service',
              'RoutingAPI',
              { label: `${cacheStrategy.pair}/${cacheStrategy.tradeType.toUpperCase()} Quotes` },
            ],
          ],
          region: this.region,
          title: `Number of requested quotes`,
          period: 300,
          stat: 'SampleCount',
        },
      },
      {
        type: 'metric',
        width: 24,
        height: 9,
        properties: {
          view: 'timeSeries',
          stacked: true,
          metrics: cacheStrategy
            .bucketPairs()
            .map((bucket) => [
              this.namespace,
              getQuoteMetricName,
              'Service',
              'RoutingAPI',
              this.generateStatWithLabel(bucket, cacheStrategy.pair, cacheStrategy._tradeType),
            ]),
          region: this.region,
          title: `Distribution of quotes ${pairTradeTypeChainId}`,
          period: 300,
        },
      },
    ]

    const tapcompareMetrics: Widget[] = cacheStrategy.willTapcompare
      ? [
          {
            type: 'log',
            width: 24,
            height: 8,
            properties: {
              view: 'table',
              query: `SOURCE '/aws/lambda/${this.lambdaName}'
            | fields @timestamp, pair, quoteGasAdjustedDiff as diff, amount
            | filter msg like 'Comparing quotes between Chain and Cache' and pair = '${pairTradeTypeChainId}' and diff != 0 
            | sot diff desc`,
              region: this.region,
              title: `Quote Differences and Amounts for ${pairTradeTypeChainId}`,
            },
          },
        ]
      : []

    return quoteAmountsMetrics.concat(tapcompareMetrics)
  }

  private generateStatWithLabel(
    [min, max]: [number, number],
    pair: string,
    tradeType: TradeType
  ): { stat: string; label: string } {
    const tokens = pair.split('/')
    const maxNormalized = max > 0 ? max.toString() : ''

    switch (tradeType) {
      case TradeType.EXACT_INPUT:
        return {
          stat: `PR(${min}:${maxNormalized})`,
          label: `${min} to ${max} ${tokens[0]}`,
        }
      case TradeType.EXACT_OUTPUT:
        return {
          stat: `PR(${min}:${maxNormalized})`,
          label: `${min} to ${max} ${tokens[1]}`,
        }
    }
  }
}
