import { ChainId, ID_TO_NETWORK_NAME } from '@uniswap/smart-order-router'
import _ from 'lodash'
import { Widget } from './core/model/widget'
import { WidgetsFactory } from './core/widgets-factory'

enum TradeTypes {
  ExactIn = 'ExactIn',
  ExactOut = 'ExactOut',
}

export class QuoteAmountsWidgets implements WidgetsFactory {
  region: string
  namespace: string
  pairsToTrackPerChain: [ChainId, string[]][]

  constructor(namespace: string, region: string, pairsToTrackPerChain: [ChainId, string[]][]) {
    this.region = region
    this.namespace = namespace
    this.pairsToTrackPerChain = pairsToTrackPerChain
  }

  generateWidgets(): Widget[] {
    return _.flatMap(this.pairsToTrackPerChain, ([chainId, pairs]: [ChainId, string[]]) => [
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
    const tradeTypes = [TradeTypes.ExactIn, TradeTypes.ExactOut]
    const widgets: Widget[] = _.flatMap(tradeTypes, (tradeType: TradeTypes) => [
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
              this.generateStatWithLabel(0, 1, pair, tradeType),
            ],
            ['...', this.generateStatWithLabel(1, 5, pair, tradeType)],
            ['...', this.generateStatWithLabel(5, 10, pair, tradeType)],
            ['...', this.generateStatWithLabel(10, 50, pair, tradeType)],
            ['...', this.generateStatWithLabel(50, 100, pair, tradeType)],
            ['...', this.generateStatWithLabel(100, 500, pair, tradeType)],
            ['...', this.generateStatWithLabel(500, 1000, pair, tradeType)],
            ['...', this.generateStatWithLabel(1000, 5000, pair, tradeType)],
            ['...', this.generateStatWithLabel(5000, 10000, pair, tradeType)],
            ['...', this.generateStatWithLabel(10000, 50000, pair, tradeType)],
            ['...', this.generateStatWithLabel(50000, 100000, pair, tradeType)],
            ['...', this.generateStatWithLabel(100000, 500000, pair, tradeType)],
            ['...', this.generateStatWithLabel(500000, 1000000, pair, tradeType)],
            ['...', this.generateStatWithLabel(1000000, -1, pair, tradeType)],
          ],
          region: this.region,
          title: `Distribution of quotes ${pair}/${tradeType}`,
          period: 300,
        },
      },
    ])

    return widgets
  }

  private generateStatWithLabel(
    min: number,
    max: number,
    pair: string,
    tradeType: TradeTypes
  ): { stat: string; label: string } {
    const tokens = pair.split('/')
    const maxNormalized = max > 0 ? max.toString() : ''

    switch (tradeType) {
      case TradeTypes.ExactIn:
        return {
          stat: `PR(${min}:${maxNormalized})`,
          label: `${min} to ${max} ${tokens[0]}`,
        }
      case TradeTypes.ExactOut:
        return {
          stat: `PR(${min}:${maxNormalized})`,
          label: `${min} to ${max} ${tokens[1]}`,
        }
    }
  }
}
