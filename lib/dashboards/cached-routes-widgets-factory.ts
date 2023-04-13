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
    const cacheHitMissWidgets = this.generateCacheHitMissMetricsWidgets()

    const [wildcardStrategies, strategies] = _.partition(Array.from(CACHED_ROUTES_CONFIGURATION.values()), (strategy) =>
      strategy.pair.includes('*')
    )

    let wildcardStrategiesWidgets: Widget[] = []
    if (wildcardStrategies.length > 0) {
      wildcardStrategiesWidgets = _.flatMap(wildcardStrategies, (cacheStrategy) => {
        const tokenIn = cacheStrategy.pair.split('/')[0].replace('*', 'TokenIn')
        const tokenOut = cacheStrategy.pair.split('/')[1].replace('*', 'TokenOut')

        return this.generateTapcompareWidgets(tokenIn, tokenOut, cacheStrategy.readablePairTradeTypeChainId())
      })

      wildcardStrategiesWidgets.unshift({
        type: 'text',
        width: 24,
        height: 1,
        properties: {
          markdown: `# Wildcard pairs`,
        },
      })
    }

    const strategiesWidgets = _.flatMap(strategies, (cacheStrategy) => this.generateWidgetsForStrategies(cacheStrategy))

    return cacheHitMissWidgets.concat(wildcardStrategiesWidgets).concat(strategiesWidgets)
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
        height: 7,
        properties: {
          view: 'timeSeries',
          stacked: false,
          metrics: [
            [{ expression: 'SUM(METRICS())', label: 'AllRequests', id: 'e1', visible: false }],
            [{ expression: 'm1/e1 * 100', label: 'Cache Hit Rate', id: 'e2' }],
            [{ expression: 'm2/e1 * 100', label: 'Cache Miss Rate', id: 'e3' }],
            [
              this.namespace,
              'GetCachedRoute_hit_livemode',
              'Service',
              'RoutingAPI',
              { label: 'Cache Hit', id: 'm1', visible: false },
            ],
            ['.', 'GetCachedRoute_miss_livemode', '.', '.', { label: 'Cache Miss', id: 'm2', visible: false }],
          ],
          region: this.region,
          title: 'Cache Hit and Miss Rates of Cachemode.Livemode',
          period: 300,
          stat: 'Sum',
          yAxis: {
            left: {
              min: 0,
              max: 100,
            },
          },
        },
      },
      {
        type: 'metric',
        width: 24,
        height: 7,
        properties: {
          view: 'timeSeries',
          stacked: false,
          metrics: [
            [{ expression: 'SUM(METRICS())', label: 'AllRequests', id: 'e1', visible: false }],
            [{ expression: 'm1/e1 * 100', label: 'Cache Hit Rate', id: 'e2' }],
            [{ expression: 'm2/e1 * 100', label: 'Cache Miss Rate', id: 'e3' }],
            [
              this.namespace,
              'GetCachedRoute_hit_tapcompare',
              'Service',
              'RoutingAPI',
              { label: 'Cache Hit', id: 'm1', visible: false },
            ],
            ['.', 'GetCachedRoute_miss_tapcompare', '.', '.', { label: 'Cache Miss', id: 'm2', visible: false }],
          ],
          region: this.region,
          title: 'Cache Hit and Miss Rates of cachemode.Tapcompare',
          period: 300,
          stat: 'Sum',
          yAxis: {
            left: {
              min: 0,
              max: 100,
            },
          },
        },
      },
    ]
  }

  private generateWidgetsForStrategies(cacheStrategy: CachedRoutesStrategy): Widget[] {
    const pairTradeTypeChainId = cacheStrategy.readablePairTradeTypeChainId()
    const getQuoteMetricName = `GET_QUOTE_AMOUNT_${cacheStrategy.pair}_${cacheStrategy.tradeType.toUpperCase()}_CHAIN_${
      cacheStrategy.chainId
    }`
    const tokenIn = cacheStrategy.pair.split('/')[0]
    const tokenOut = cacheStrategy.pair.split('/')[1]

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

    let tapcompareMetrics: Widget[] = []

    if (cacheStrategy.willTapcompare) {
      tapcompareMetrics = this.generateTapcompareWidgets(tokenIn, tokenOut, pairTradeTypeChainId)
    }

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

  private generateTapcompareWidgets(tokenIn: string, tokenOut: string, pairTradeTypeChainId: string): Widget[] {
    // Escape the pairTradeTypeChainId in order to be used for matching against wildcards too
    const escapedPairTradeTypeChainId = pairTradeTypeChainId
      .replace(/\//g, '\\/') // Escape forward slashes
      .replace(/\*/g, '.*') // Replace * with .* to match against any character in the pair

    const widget: Widget[] = [
      {
        type: 'log',
        width: 24,
        height: 8,
        properties: {
          view: 'table',
          query: `SOURCE '/aws/lambda/${this.lambdaName}'
            | fields @timestamp, pair, quoteGasAdjustedDiff as diffOf${tokenOut}, amount as amountOf${tokenIn}, quoteGasAdjustedDiff * (amount/quoteGasAdjustedFromChain) as diffIn${tokenIn}Terms, diffIn${tokenIn}Terms / amount * 100 as misquotePercent, originalAmount
            | filter msg like 'Comparing quotes between Chain and Cache' and pair like /${escapedPairTradeTypeChainId}/ and quoteGasAdjustedDiff != 0 
            | sort misquotePercent desc`,
          region: this.region,
          title: `Quote Differences and Amounts for ${pairTradeTypeChainId}`,
        },
      },
    ]

    return widget
  }
}
