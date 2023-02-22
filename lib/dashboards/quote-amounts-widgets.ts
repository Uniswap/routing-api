import { ChainId, ID_TO_NETWORK_NAME } from '@uniswap/smart-order-router'
import _ from 'lodash'
import { Widget } from './core/model/widget'
import { WidgetsFactory } from './core/widgets-factory'

type Map<K, V> = {
  key: K
  value: V
}

export class QuoteAmountsWidgets implements WidgetsFactory {
  region: string
  namespace: string
  pairsToTrackPerChain: Map<ChainId, string[]>[]

  constructor(namespace: string, region: string, pairsToTrackPerChain: Map<ChainId, string[]>[]) {
    this.region = region
    this.namespace = namespace
    this.pairsToTrackPerChain = pairsToTrackPerChain
  }

  generateWidgets(): Widget[] {
    return _.flatMap(this.pairsToTrackPerChain, ({ key: chainId, value: pairs }: Map<ChainId, string[]>) => [
      {
        type: 'text',
        width: 24,
        height: 1,
        properties: {
          markdown: `# ${ID_TO_NETWORK_NAME(chainId)} - ChainId: ${chainId}`,
        },
      },
      ...this.generateChatWidgetsForTrackedPairs(chainId, pairs),
    ])
  }

  private generateChatWidgetsForTrackedPairs(chainId: ChainId, pairs: string[]): Widget[] {
    return _.flatMap(pairs, (pair: string) => this.generateChartWidgetsForPair(pair, chainId))
  }

  private generateChartWidgetsForPair(pair: string, chainId: ChainId): Widget[] {
    const tradeTypes = ['ExactIn', 'ExactOut']
    const widgets: Widget[] = _.flatMap(tradeTypes, (tradeType: string) => [
      {
        type: 'text',
        width: 24,
        height: 1,
        properties: {
          markdown: `## ${pair} - ${tradeType}`,
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
              `GET_QUOTE_AMOUNT_${pair}_${tradeType.toUpperCase()}_CHAIN_${chainId}`,
              'Service',
              'RoutingAPI',
            ],
          ],
          region: this.region,
          title: `Number of requested quotes ${pair}/${tradeType}`,
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
          metrics: [
            [
              this.namespace,
              `GET_QUOTE_AMOUNT_${pair}_${tradeType.toUpperCase()}_CHAIN_${chainId}`,
              'Service',
              'RoutingAPI',
              { stat: 'PR(0:10)' },
            ],
            ['...', { stat: 'PR(10:50)' }],
            ['...', { stat: 'PR(50:100)' }],
            ['...', { stat: 'PR(100:500)' }],
            ['...', { stat: 'PR(500:1000)' }],
            ['...', { stat: 'PR(1000:5000)' }],
            ['...', { stat: 'PR(5000:10000)' }],
            ['...', { stat: 'PR(10000:50000)' }],
            ['...', { stat: 'PR(50000:100000)' }],
            ['...', { stat: 'PR(100000:500000)' }],
            ['...', { stat: 'PR(500000:1000000)' }],
            ['...', { stat: 'PR(1000000:)' }],
          ],
          region: this.region,
          title: `Distribution of quotes ${pair}/${tradeType}`,
          period: 300,
        },
      },
    ])

    return widgets
  }
}
