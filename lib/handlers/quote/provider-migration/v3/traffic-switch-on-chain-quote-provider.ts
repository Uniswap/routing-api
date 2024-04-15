import { IOnChainQuoteProvider, log, metric, MetricLoggerUnit, OnChainQuotes } from '@uniswap/smart-order-router'
import { MixedRoute, V2Route, V3Route } from '@uniswap/smart-order-router/build/main/routers'
import { ChainId, Currency, CurrencyAmount } from '@uniswap/sdk-core'
import { ProviderConfig } from '@uniswap/smart-order-router/build/main/providers/provider'
import { QUOTE_PROVIDER_TRAFFIC_SWITCH_CONFIGURATION } from '../../util/quote-provider-traffic-switch-configuration'
import { BigNumber } from 'ethers'

export type TrafficSwitchOnChainQuoteProviderProps = {
  currentQuoteProvider: IOnChainQuoteProvider
  targetQuoteProvider: IOnChainQuoteProvider
  chainId: ChainId
}

export class TrafficSwitchOnChainQuoteProvider implements IOnChainQuoteProvider {
  private readonly currentQuoteProvider: IOnChainQuoteProvider
  private readonly targetQuoteProvider: IOnChainQuoteProvider
  private readonly chainId: ChainId

  protected readonly SHOULD_SWITCH_EXACT_IN_TRAFFIC = (chainId: ChainId) =>
    QUOTE_PROVIDER_TRAFFIC_SWITCH_CONFIGURATION(chainId).switchExactInPercentage > this.getRandomPercentage()
  protected readonly SHOULD_SAMPLE_EXACT_IN_TRAFFIC = (chainId: ChainId) =>
    QUOTE_PROVIDER_TRAFFIC_SWITCH_CONFIGURATION(chainId).samplingExactInPercentage > this.getRandomPercentage()
  protected readonly SHOULD_SWITCH_EXACT_OUT_TRAFFIC = (chainId: ChainId) =>
    QUOTE_PROVIDER_TRAFFIC_SWITCH_CONFIGURATION(chainId).switchExactOutPercentage > this.getRandomPercentage()
  protected readonly SHOULD_SAMPLE_EXACT_OUT_TRAFFIC = (chainId: ChainId) =>
    QUOTE_PROVIDER_TRAFFIC_SWITCH_CONFIGURATION(chainId).samplingExactOutPercentage > this.getRandomPercentage()

  private readonly EXACT_IN_METRIC = 'EXACT_IN'
  private readonly EXACT_OUT_METRIC = 'EXACT_OUT'

  constructor(props: TrafficSwitchOnChainQuoteProviderProps) {
    this.currentQuoteProvider = props.currentQuoteProvider
    this.targetQuoteProvider = props.targetQuoteProvider
    this.chainId = props.chainId
  }

  async getQuotesManyExactIn<TRoute extends V3Route | V2Route | MixedRoute>(
    amountIns: CurrencyAmount<Currency>[],
    routes: TRoute[],
    providerConfig?: ProviderConfig
  ): Promise<OnChainQuotes<TRoute>> {
    const sampleTraffic = this.SHOULD_SAMPLE_EXACT_IN_TRAFFIC(this.chainId)
    const switchTraffic = this.SHOULD_SWITCH_EXACT_IN_TRAFFIC(this.chainId)

    let [currentRoutesWithQuotes, targetRoutesWithQuotes]: [
      OnChainQuotes<TRoute> | undefined,
      OnChainQuotes<TRoute> | undefined
    ] = [undefined, undefined]

    metric.putMetric(
      `ON_CHAIN_QUOTE_PROVIDER_${this.EXACT_IN_METRIC}_TRAFFIC_TOTAL_CHAIN_ID_${this.chainId}`,
      1,
      MetricLoggerUnit.None
    )

    if (sampleTraffic) {
      metric.putMetric(
        `ON_CHAIN_QUOTE_PROVIDER_${this.EXACT_IN_METRIC}_TRAFFIC_SAMPLING_CHAIN_ID_${this.chainId}`,
        1,
        MetricLoggerUnit.None
      )
      const startTime = Date.now()
      let currentQuoterSucceeded = false
      let targetQuoterSuceeded = false

      try {
        ;[currentRoutesWithQuotes, targetRoutesWithQuotes] = await Promise.all([
          this.currentQuoteProvider.getQuotesManyExactIn(amountIns, routes, providerConfig).then((res) => {
            currentQuoterSucceeded = true
            const endTime = Date.now()
            metric.putMetric(
              `ON_CHAIN_QUOTE_PROVIDER_${this.EXACT_IN_METRIC}_TRAFFIC_CURRENT_LATENCIES_CHAIN_ID_${this.chainId}`,
              endTime - startTime,
              MetricLoggerUnit.Milliseconds
            )
            return res
          }),
          this.targetQuoteProvider.getQuotesManyExactIn(amountIns, routes, providerConfig).then((res) => {
            targetQuoterSuceeded = true
            const endTime = Date.now()
            metric.putMetric(
              `ON_CHAIN_QUOTE_PROVIDER_${this.EXACT_IN_METRIC}_TRAFFIC_TARGET_LATENCIES_CHAIN_ID_${this.chainId}`,
              endTime - startTime,
              MetricLoggerUnit.Milliseconds
            )
            return res
          }),
        ])

        if (currentRoutesWithQuotes && targetRoutesWithQuotes) {
          this.compareQuotes(this.EXACT_IN_METRIC, currentRoutesWithQuotes, targetRoutesWithQuotes)
        }
      } catch (error) {
        if (currentQuoterSucceeded && !targetQuoterSuceeded) {
          // If we can enter here, it means the current quoter can return without throwing error,
          // but the new quoter threw error, and we swallowed exception here. This is the case worth tracking.
          log.error({ error }, 'Target quoter failed to return quotes')
          metric.putMetric(
            `ON_CHAIN_QUOTE_PROVIDER_${this.EXACT_IN_METRIC}_TRAFFIC_TARGET_FAILED_CHAIN_ID_${this.chainId}`,
            1,
            MetricLoggerUnit.None
          )
        }
      }
    }

    if (switchTraffic) {
      metric.putMetric(
        `ON_CHAIN_QUOTE_PROVIDER_${this.EXACT_IN_METRIC}_TRAFFIC_TARGET_CHAIN_ID_${this.chainId}`,
        1,
        MetricLoggerUnit.None
      )

      return (
        targetRoutesWithQuotes ??
        (await this.targetQuoteProvider.getQuotesManyExactIn(amountIns, routes, providerConfig))
      )
    } else {
      metric.putMetric(
        `ON_CHAIN_QUOTE_PROVIDER_${this.EXACT_IN_METRIC}_TRAFFIC_CURRENT_CHAIN_ID_${this.chainId}`,
        1,
        MetricLoggerUnit.None
      )

      return (
        currentRoutesWithQuotes ??
        (await this.currentQuoteProvider.getQuotesManyExactIn(amountIns, routes, providerConfig))
      )
    }
  }

  async getQuotesManyExactOut<TRoute extends V3Route>(
    amountOuts: CurrencyAmount<Currency>[],
    routes: TRoute[],
    providerConfig?: ProviderConfig
  ): Promise<OnChainQuotes<TRoute>> {
    const sampleTraffic = this.SHOULD_SAMPLE_EXACT_OUT_TRAFFIC(this.chainId)
    const switchTraffic = this.SHOULD_SWITCH_EXACT_OUT_TRAFFIC(this.chainId)

    let [currentRoutesWithQuotes, targetRoutesWithQuotes]: [
      OnChainQuotes<TRoute> | undefined,
      OnChainQuotes<TRoute> | undefined
    ] = [undefined, undefined]
    metric.putMetric(
      `ON_CHAIN_QUOTE_PROVIDER_${this.EXACT_OUT_METRIC}_TRAFFIC_TOTAL_CHAIN_ID_${this.chainId}`,
      1,
      MetricLoggerUnit.None
    )

    if (sampleTraffic) {
      metric.putMetric(
        `ON_CHAIN_QUOTE_PROVIDER_${this.EXACT_OUT_METRIC}_TRAFFIC_SAMPLING_CHAIN_ID_${this.chainId}`,
        1,
        MetricLoggerUnit.None
      )
      const startTime = Date.now()
      let currentQuoterSucceeded = false
      let targetQuoterSuceeded = false

      try {
        ;[currentRoutesWithQuotes, targetRoutesWithQuotes] = await Promise.all([
          await this.currentQuoteProvider.getQuotesManyExactOut(amountOuts, routes, providerConfig).then((res) => {
            currentQuoterSucceeded = true
            const endTime = Date.now()
            metric.putMetric(
              `ON_CHAIN_QUOTE_PROVIDER_${this.EXACT_OUT_METRIC}_TRAFFIC_CURRENT_LATENCIES_CHAIN_ID_${this.chainId}`,
              endTime - startTime,
              MetricLoggerUnit.Milliseconds
            )
            return res
          }),
          await this.targetQuoteProvider.getQuotesManyExactOut(amountOuts, routes, providerConfig).then((res) => {
            targetQuoterSuceeded = true
            const endTime = Date.now()
            metric.putMetric(
              `ON_CHAIN_QUOTE_PROVIDER_${this.EXACT_OUT_METRIC}_TRAFFIC_TARGET_LATENCIES_CHAIN_ID_${this.chainId}`,
              endTime - startTime,
              MetricLoggerUnit.Milliseconds
            )
            return res
          }),
        ])

        if (currentRoutesWithQuotes && targetRoutesWithQuotes) {
          this.compareQuotes(this.EXACT_OUT_METRIC, currentRoutesWithQuotes, targetRoutesWithQuotes)
        }
      } catch (error) {
        if (currentQuoterSucceeded && !targetQuoterSuceeded) {
          // If we can enter here, it means the current quoter can return without throwing error,
          // but the new quoter threw error, and we swallowed exception here. This is the case worth tracking.
          log.error({ error }, 'Target quoter failed to return quotes')
          metric.putMetric(
            `ON_CHAIN_QUOTE_PROVIDER_${this.EXACT_OUT_METRIC}_TRAFFIC_TARGET_FAILED_CHAIN_ID_${this.chainId}`,
            1,
            MetricLoggerUnit.None
          )
        }
      }
    }

    if (switchTraffic) {
      metric.putMetric(
        `ON_CHAIN_QUOTE_PROVIDER_${this.EXACT_OUT_METRIC}_TRAFFIC_TARGET_CHAIN_ID_${this.chainId}`,
        1,
        MetricLoggerUnit.None
      )

      return (
        targetRoutesWithQuotes ??
        (await this.targetQuoteProvider.getQuotesManyExactOut(amountOuts, routes, providerConfig))
      )
    } else {
      metric.putMetric(
        `ON_CHAIN_QUOTE_PROVIDER_${this.EXACT_OUT_METRIC}_TRAFFIC_CURRENT_CHAIN_ID_${this.chainId}`,
        1,
        MetricLoggerUnit.None
      )

      return (
        currentRoutesWithQuotes ??
        (await this.currentQuoteProvider.getQuotesManyExactOut(amountOuts, routes, providerConfig))
      )
    }
  }

  private compareQuotes<TRoute extends V3Route | V2Route | MixedRoute>(
    tradeTypeMetric: string,
    currentRoutesWithQuotes: OnChainQuotes<TRoute>,
    targetRoutesWithQuotes: OnChainQuotes<TRoute>
  ): void {
    if (!currentRoutesWithQuotes.blockNumber.eq(targetRoutesWithQuotes.blockNumber)) {
      log.error(
        {
          currentQuoteRoutesBlockNumber: currentRoutesWithQuotes.blockNumber,
          targetQuoteRoutesBlockNumber: targetRoutesWithQuotes.blockNumber,
        },
        'Current and target quote providers returned different block numbers'
      )

      return
    }

    if (currentRoutesWithQuotes.routesWithQuotes.length !== targetRoutesWithQuotes.routesWithQuotes.length) {
      log.error(
        {
          currentQuoteRoutesLength: currentRoutesWithQuotes.routesWithQuotes.length,
          targetQuoteRoutesLength: targetRoutesWithQuotes.routesWithQuotes.length,
        },
        'Current and target quote providers returned different number of routes with quotes'
      )
      metric.putMetric(
        `ON_CHAIN_QUOTE_PROVIDER_${tradeTypeMetric}_TRAFFIC_CURRENT_AND_TARGET_ROUTES_WITH_QUOTES_MISMATCH_CHAIN_ID_${this.chainId}`,
        1,
        MetricLoggerUnit.None
      )

      return
    }

    const length = currentRoutesWithQuotes.routesWithQuotes.length

    for (let i = 0; i < length; i++) {
      const currentRouteWithQuotes = currentRoutesWithQuotes.routesWithQuotes[i]
      const targetRouteWithQuotes = targetRoutesWithQuotes.routesWithQuotes[i]
      const [, currentQuotes] = currentRouteWithQuotes
      const [, targetQuotes] = targetRouteWithQuotes

      if (currentQuotes.length !== targetQuotes.length) {
        log.error(
          {
            currentQuotesLength: currentQuotes.length,
            targetQuotesLength: targetQuotes.length,
          },
          'Current and target quote providers returned different number of quotes'
        )
        metric.putMetric(
          `ON_CHAIN_QUOTE_PROVIDER_${tradeTypeMetric}_TRAFFIC_CURRENT_AND_TARGET_NUMBER_OF_QUOTES_MISMATCH_CHAIN_ID_${this.chainId}`,
          1,
          MetricLoggerUnit.None
        )

        return
      }

      const length = currentQuotes.length

      for (let j = 0; j < length; j++) {
        const currentQuote = currentQuotes[j]
        const targetQuote = targetQuotes[j]

        if (!currentQuote.quote?.eq(targetQuote.quote ?? BigNumber.from(0))) {
          log.error(
            {
              currentQuote: currentQuote.quote,
              targetQuote: targetQuote.quote,
            },
            'Current and target quote providers returned different quotes'
          )
          metric.putMetric(
            `ON_CHAIN_QUOTE_PROVIDER_${tradeTypeMetric}_TRAFFIC_CURRENT_AND_TARGET_QUOTES_MISMATCH_CHAIN_ID_${this.chainId}`,
            1,
            MetricLoggerUnit.None
          )
        } else {
          metric.putMetric(
            `ON_CHAIN_QUOTE_PROVIDER_${tradeTypeMetric}_TRAFFIC_CURRENT_AND_TARGET_QUOTES_MATCH_CHAIN_ID_${this.chainId}`,
            1,
            MetricLoggerUnit.None
          )
        }
      }
    }
  }

  private getRandomPercentage(): number {
    return Math.floor(Math.random() * 100)
  }
}
