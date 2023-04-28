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
      wildcardStrategiesWidgets = _.flatMap(wildcardStrategies, (cacheStrategy) =>
        this.generateWidgetsForStrategies(cacheStrategy)
      )

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
        width: 12,
        height: 7,
        properties: {
          view: 'timeSeries',
          stacked: false,
          metrics: [
            [{ expression: 'SUM(METRICS())', label: 'Requests', id: 'e1' }],
            [this.namespace, 'GetCachedRoute_hit_livemode', 'Service', 'RoutingAPI', { label: 'Cache Hit', id: 'm1' }],
            ['.', 'GetCachedRoute_miss_livemode', '.', '.', { label: 'Cache Miss', id: 'm2' }],
          ],
          region: this.region,
          title: 'Cache Hit, Miss and Total requests of Cachemode.Livemode',
          period: 300,
          stat: 'Sum',
          yAxis: {
            left: {
              min: 0,
            },
          },
        },
      },
      {
        type: 'metric',
        width: 12,
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
        width: 12,
        height: 7,
        properties: {
          view: 'timeSeries',
          stacked: false,
          metrics: [
            [{ expression: 'SUM(METRICS())', label: 'Requests', id: 'e1' }],
            [
              this.namespace,
              'GetCachedRoute_hit_tapcompare',
              'Service',
              'RoutingAPI',
              { label: 'Cache Hit', id: 'm1' },
            ],
            ['.', 'GetCachedRoute_miss_tapcompare', '.', '.', { label: 'Cache Miss', id: 'm2' }],
          ],
          region: this.region,
          title: 'Cache Hit, Miss and Total requests of Cachemode.Tapcompare',
          period: 300,
          stat: 'Sum',
          yAxis: {
            left: {
              min: 0,
            },
          },
        },
      },
      {
        type: 'metric',
        width: 12,
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
      {
        type: 'metric',
        width: 12,
        height: 7,
        properties: {
          view: 'timeSeries',
          stacked: false,
          metrics: [
            [
              this.namespace,
              'TapcompareCachedRoute_quoteGasAdjustedDiffPercent',
              'Service',
              'RoutingAPI',
              { label: 'Misquote' },
            ],
          ],
          region: this.region,
          title: 'Total number of Misquotes from Tapcompare',
          period: 300,
          stat: 'SampleCount',
          yAxis: {
            left: {
              min: 0,
            },
          },
        },
      },
      {
        type: 'metric',
        width: 12,
        height: 7,
        properties: {
          view: 'timeSeries',
          stacked: false,
          metrics: [
            [{ expression: 'm2/m1 * 100', label: 'Misquote Rate', id: 'e1' }],
            [
              this.namespace,
              'GetCachedRoute_hit_tapcompare',
              'Service',
              'RoutingAPI',
              { label: 'Cache Hit', id: 'm1', visible: false },
            ],
            [
              '.',
              'TapcompareCachedRoute_quoteGasAdjustedDiffPercent',
              '.',
              '.',
              { label: 'Cache Miss', id: 'm2', stat: 'SampleCount', visible: false },
            ],
          ],
          region: this.region,
          title: 'Misquote rate from Tapcompare',
          period: 300,
          stat: 'Sum',
          yAxis: {
            left: {
              min: 0,
            },
          },
        },
      },
    ]
  }

  private generateWidgetsForStrategies(cacheStrategy: CachedRoutesStrategy): Widget[] {
    const pairTradeTypeChainId = cacheStrategy.readablePairTradeTypeChainId()
    const getQuoteAmountMetricName = `GET_QUOTE_AMOUNT_${
      cacheStrategy.pair
    }_${cacheStrategy.tradeType.toUpperCase()}_CHAIN_${cacheStrategy.chainId}`
    const getQuoteLatencyMetricName = `GET_QUOTE_LATENCY_${
      cacheStrategy.pair
    }_${cacheStrategy.tradeType.toUpperCase()}_CHAIN_${cacheStrategy.chainId}`
    const tokenIn = cacheStrategy.pair.split('/')[0].replace('*', 'TokenIn')
    const tokenOut = cacheStrategy.pair.split('/')[1].replace('*', 'TokenOut')

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
        width: 12,
        height: 9,
        properties: {
          view: 'timeSeries',
          stacked: false,
          metrics: [
            [
              this.namespace,
              getQuoteAmountMetricName,
              'Service',
              'RoutingAPI',
              { label: `${cacheStrategy.pair}/${cacheStrategy.tradeType.toUpperCase()} Quotes` },
            ],
          ],
          region: this.region,
          title: `Number of requested quotes`,
          period: 300,
          stat: 'SampleCount',
          yAxis: {
            left: {
              min: 0,
            },
          },
        },
      },
      {
        type: 'metric',
        width: 12,
        height: 9,
        properties: {
          view: 'timeSeries',
          stacked: true,
          metrics: cacheStrategy
            .bucketPairs()
            .map((bucket) => [
              this.namespace,
              getQuoteAmountMetricName,
              'Service',
              'RoutingAPI',
              this.generateStatWithLabel(bucket, cacheStrategy.pair, cacheStrategy._tradeType),
            ]),
          region: this.region,
          title: `Distribution of quotes ${pairTradeTypeChainId}`,
          period: 300,
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
              getQuoteLatencyMetricName,
              'Service',
              'RoutingAPI',
              { stat: 'p99.999', label: `${cacheStrategy.pair}/${cacheStrategy.tradeType.toUpperCase()} P99.999` },
            ],
            ['...', { stat: 'p99.99', label: `${cacheStrategy.pair}/${cacheStrategy.tradeType.toUpperCase()} P99.99` }],
            ['...', { stat: 'p99.9', label: `${cacheStrategy.pair}/${cacheStrategy.tradeType.toUpperCase()} P99.9` }],
            ['...', { stat: 'p99', label: `${cacheStrategy.pair}/${cacheStrategy.tradeType.toUpperCase()} P99` }],
            ['...', { stat: 'p95', label: `${cacheStrategy.pair}/${cacheStrategy.tradeType.toUpperCase()} P95` }],
            ['...', { stat: 'p90', label: `${cacheStrategy.pair}/${cacheStrategy.tradeType.toUpperCase()} P90` }],
            ['...', { stat: 'p50', label: `${cacheStrategy.pair}/${cacheStrategy.tradeType.toUpperCase()} Median` }],
            [
              '...',
              { stat: 'Average', label: `${cacheStrategy.pair}/${cacheStrategy.tradeType.toUpperCase()} Average` },
            ],
            [
              '...',
              { stat: 'Minimum', label: `${cacheStrategy.pair}/${cacheStrategy.tradeType.toUpperCase()} Minimum` },
            ],
          ],
          region: this.region,
          title: `Latency of API for requested pair`,
          period: 300,
          stat: 'SampleCount',
          yAxis: {
            left: {
              min: 0,
            },
          },
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
            | fields @timestamp, pair, amount as amountOf${tokenIn}, quoteDiff as diffOf${tokenOut}, quoteDiff * (amount/quoteFromChain) as diffIn${tokenIn}Terms, diffIn${tokenIn}Terms / amount * 100 as misquotePercent, quoteGasAdjustedDiff as diffGasAdjustedOf${tokenOut}, quoteGasAdjustedDiff * (amount/quoteGasAdjustedFromChain) as diffGasAdjustedIn${tokenIn}Terms, diffGasAdjustedIn${tokenIn}Terms / amount * 100 as misquoteGasAdjustedPercent, gasUsedDiff, originalAmount
            | filter msg like 'Comparing quotes between Chain and Cache' and pair like /${escapedPairTradeTypeChainId}/ and quoteGasAdjustedDiff != 0 
            | sort misquoteGasAdjustedPercent desc`,
          region: this.region,
          title: `Quote Differences and Amounts for ${pairTradeTypeChainId}`,
        },
      },
    ]

    return widget
  }
}
