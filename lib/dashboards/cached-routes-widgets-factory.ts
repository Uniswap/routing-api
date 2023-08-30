import { Widget } from './core/model/widget'
import { WidgetsFactory } from './core/widgets-factory'

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
    return this.generateCacheHitMissMetricsWidgets()
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
}
