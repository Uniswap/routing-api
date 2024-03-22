import { IOnChainQuoteProvider, metric, MetricLoggerUnit, RouteWithQuotes } from '@uniswap/smart-order-router'
import { MixedRoute, V2Route, V3Route } from '@uniswap/smart-order-router/build/main/routers'
import { Currency, CurrencyAmount } from '@uniswap/sdk-core'
import { ProviderConfig } from '@uniswap/smart-order-router/build/main/providers/provider'
import { BigNumber } from 'ethers'
import { QUOTE_PROVIDER_TRAFFIC_SWITCH_CONFIGURATION } from '../../util/quote-provider-traffic-switch-configuration'

export type TrafficSwitchOnChainQuoteProviderProps = {
  currentQuoteProvider: IOnChainQuoteProvider
  targetQuoteProvider: IOnChainQuoteProvider
}

export class TrafficSwitchOnChainQuoteProvider implements IOnChainQuoteProvider {
  private readonly currentQuoteProvider: IOnChainQuoteProvider
  private readonly targetQuoteProvider: IOnChainQuoteProvider

  protected readonly SHOULD_SWITCH_EXACT_IN_TRAFFIC = () =>
    QUOTE_PROVIDER_TRAFFIC_SWITCH_CONFIGURATION.switchExactInPercentage > this.getRandomPercentage()
  protected readonly SHOULD_SAMPLE_EXACT_IN_TRAFFIC = () =>
    QUOTE_PROVIDER_TRAFFIC_SWITCH_CONFIGURATION.samplingExactInPercentage > this.getRandomPercentage()
  protected readonly SHOULD_SWITCH_EXACT_OUT_TRAFFIC = () =>
    QUOTE_PROVIDER_TRAFFIC_SWITCH_CONFIGURATION.switchExactOutPercentage > this.getRandomPercentage()
  protected readonly SHOULD_SAMPLE_EXACT_OUT_TRAFFIC = () =>
    QUOTE_PROVIDER_TRAFFIC_SWITCH_CONFIGURATION.samplingExactOutPercentage > this.getRandomPercentage()

  constructor(props: TrafficSwitchOnChainQuoteProviderProps) {
    this.currentQuoteProvider = props.currentQuoteProvider
    this.targetQuoteProvider = props.targetQuoteProvider
  }

  async getQuotesManyExactIn<TRoute extends V3Route | V2Route | MixedRoute>(
    amountIns: CurrencyAmount<Currency>[],
    routes: TRoute[],
    providerConfig?: ProviderConfig
  ): Promise<{
    routesWithQuotes: RouteWithQuotes<TRoute>[]
    blockNumber: BigNumber
  }> {
    const sampleTraffic = this.SHOULD_SAMPLE_EXACT_IN_TRAFFIC()
    const switchTraffic = this.SHOULD_SWITCH_EXACT_IN_TRAFFIC()

    let currentQuote
    let targetQuote

    metric.putMetric('ON_CHAIN_QUOTE_PROVIDER_EXACT_IN_TRAFFIC_TOTAL', 1, MetricLoggerUnit.None)

    if (sampleTraffic) {
      metric.putMetric('ON_CHAIN_QUOTE_PROVIDER_EXACT_IN_TRAFFIC_SAMPLING', 1, MetricLoggerUnit.None)

      currentQuote = await this.currentQuoteProvider.getQuotesManyExactIn(amountIns, routes, providerConfig)
      targetQuote = await this.targetQuoteProvider.getQuotesManyExactIn(amountIns, routes, providerConfig)
    }

    if (switchTraffic) {
      metric.putMetric('ON_CHAIN_QUOTE_PROVIDER_EXACT_IN_TRAFFIC_TARGET', 1, MetricLoggerUnit.None)

      return targetQuote ?? (await this.targetQuoteProvider.getQuotesManyExactIn(amountIns, routes, providerConfig))
    } else {
      metric.putMetric('ON_CHAIN_QUOTE_PROVIDER_EXACT_IN_TRAFFIC_CURRENT', 1, MetricLoggerUnit.None)

      return currentQuote ?? (await this.currentQuoteProvider.getQuotesManyExactIn(amountIns, routes, providerConfig))
    }
  }

  async getQuotesManyExactOut<TRoute extends V3Route>(
    amountOuts: CurrencyAmount<Currency>[],
    routes: TRoute[],
    providerConfig?: ProviderConfig
  ): Promise<{
    routesWithQuotes: RouteWithQuotes<TRoute>[]
    blockNumber: BigNumber
  }> {
    const sampleTraffic = this.SHOULD_SWITCH_EXACT_OUT_TRAFFIC()
    const switchTraffic = this.SHOULD_SAMPLE_EXACT_OUT_TRAFFIC()

    let currentQuote
    let targetQuote

    metric.putMetric('ON_CHAIN_QUOTE_PROVIDER_EXACT_OUT_TRAFFIC_TOTAL', 1, MetricLoggerUnit.None)

    if (sampleTraffic) {
      metric.putMetric('ON_CHAIN_QUOTE_PROVIDER_EXACT_OUT_TRAFFIC_SAMPLING', 1, MetricLoggerUnit.None)

      currentQuote = await this.currentQuoteProvider.getQuotesManyExactOut(amountOuts, routes, providerConfig)
      targetQuote = await this.targetQuoteProvider.getQuotesManyExactOut(amountOuts, routes, providerConfig)
    }

    if (switchTraffic) {
      metric.putMetric('ON_CHAIN_QUOTE_PROVIDER_EXACT_OUT_TRAFFIC_TARGET', 1, MetricLoggerUnit.None)

      return targetQuote ?? (await this.targetQuoteProvider.getQuotesManyExactOut(amountOuts, routes, providerConfig))
    } else {
      metric.putMetric('ON_CHAIN_QUOTE_PROVIDER_EXACT_OUT_TRAFFIC_CURRENT', 1, MetricLoggerUnit.None)

      return currentQuote ?? (await this.currentQuoteProvider.getQuotesManyExactOut(amountOuts, routes, providerConfig))
    }
  }

  private getRandomPercentage(): number {
    return Math.floor(Math.random() * 100)
  }
}
