import _ from 'lodash'
import { Widget } from './core/model/widget'
import { WidgetsFactory } from './core/widgets-factory'
import { CACHED_ROUTES_PAIRS } from '../handlers/router-entities/route-caching'

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
    const quoteDiffMetrics = _.flatMap(CACHED_ROUTES_PAIRS, (pair) => this.generateQuoteDiffWidgetsFromPair(pair))

    return cacheHitMissMetrics.concat(quoteDiffMetrics)
  }

  private generateCacheHitMissMetricsWidgets(): Widget[] {
    return [
      {
        type: 'text',
        width: 24,
        height: 2,
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

  private generateQuoteDiffWidgetsFromPair(pair: string): Widget[] {
    return [
      {
        type: 'text',
        width: 24,
        height: 2,
        properties: {
          markdown: `# Quote Differences for ${pair}`,
        },
      },
      {
        type: 'log',
        width: 24,
        height: 8,
        properties: {
          view: 'timeSeries',
          stacked: false,
          query: `SOURCE '/aws/lambda/${this.lambdaName}' 
            | fields @timestamp, pair, quoteGasAdjustedDiff, quoteDiff 
            | filter msg like 'Comparing' and pair = '${pair}' 
            | stats sum(quoteDiff) as QuoteDiff, sum(quoteGasAdjustedDiff) as QuoteGasAdjustedDiff by bin(1m)`,
          region: this.region,
          title: `Quote Differences for ${pair}`,
        },
      },
    ]
  }
}
