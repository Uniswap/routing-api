import { BigNumber } from '@ethersproject/bignumber'
import { ChainId, Currency, Token, TradeType } from '@uniswap/sdk-core'
import _ from 'lodash'

import {
  ITokenListProvider,
  ITokenProvider,
  ITokenValidatorProvider,
  IV2PoolProvider,
  IV2QuoteProvider,
  IV2SubgraphProvider,
  TokenValidationResult,
} from '../../../providers'
import { CurrencyAmount, log, metric, MetricLoggerUnit, routeToString } from '../../../util'
import { V2Route } from '../../router'
import { AlphaRouterConfig } from '../alpha-router'
import { V2RouteWithValidQuote } from '../entities'
import { computeAllV2Routes } from '../functions/compute-all-routes'
import { CandidatePoolsBySelectionCriteria, V2CandidatePools } from '../functions/get-candidate-pools'
import { IGasModel, IV2GasModelFactory } from '../gas-models'

import { BaseQuoter } from './base-quoter'
import { GetQuotesResult } from './model/results/get-quotes-result'
import { GetRoutesResult } from './model/results/get-routes-result'
import { CONTEXT } from '../../../../handlers/context'

export class V2Quoter extends BaseQuoter<V2CandidatePools, V2Route> {
  protected v2SubgraphProvider: IV2SubgraphProvider
  protected v2PoolProvider: IV2PoolProvider
  protected v2QuoteProvider: IV2QuoteProvider
  protected v2GasModelFactory: IV2GasModelFactory

  constructor(
    v2SubgraphProvider: IV2SubgraphProvider,
    v2PoolProvider: IV2PoolProvider,
    v2QuoteProvider: IV2QuoteProvider,
    v2GasModelFactory: IV2GasModelFactory,
    tokenProvider: ITokenProvider,
    chainId: ChainId,
    blockedTokenListProvider?: ITokenListProvider,
    tokenValidatorProvider?: ITokenValidatorProvider
  ) {
    super(tokenProvider, chainId, blockedTokenListProvider, tokenValidatorProvider)
    this.v2SubgraphProvider = v2SubgraphProvider
    this.v2PoolProvider = v2PoolProvider
    this.v2QuoteProvider = v2QuoteProvider
    this.v2GasModelFactory = v2GasModelFactory
  }

  protected async getRoutes(
    tokenIn: Token,
    tokenOut: Token,
    v2CandidatePools: V2CandidatePools,
    _tradeType: TradeType,
    routingConfig: AlphaRouterConfig
  ): Promise<GetRoutesResult<V2Route>> {
    const getRoutesStart = Date.now()

    const beforeGetRoutes = Date.now()
    // Fetch all the pools that we will consider routing via. There are thousands
    // of pools, so we filter them to a set of candidate pools that we expect will
    // result in good prices.

    const { poolAccessor, candidatePools } = v2CandidatePools

    const beforeGetAllPools = Date.now()
    const poolsRaw = poolAccessor.getAllPools()
    const afterGetAllPools = Date.now()

    const beforeTokenValidation = Date.now()
    // Drop any pools that contain tokens that can not be transferred according to the token validator.
    const pools = await this.applyTokenValidatorToPools(
      poolsRaw,
      (token: Currency, tokenValidation: TokenValidationResult | undefined): boolean => {
        // If there is no available validation result we assume the token is fine.
        if (!tokenValidation) {
          return false
        }

        // Only filters out *intermediate* pools that involve tokens that we detect
        // cant be transferred. This prevents us trying to route through tokens that may
        // not be transferrable, but allows users to still swap those tokens if they
        // specify.
        if (tokenValidation == TokenValidationResult.STF && (token.equals(tokenIn) || token.equals(tokenOut))) {
          return false
        }

        return tokenValidation == TokenValidationResult.STF
      }
    )
    const afterTokenValidation = Date.now()

    // Given all our candidate pools, compute all the possible ways to route from tokenIn to tokenOut.
    const { maxSwapsPerPath } = routingConfig

    const computeRoutesStart = Date.now()
    const routes = computeAllV2Routes(tokenIn, tokenOut, pools, maxSwapsPerPath)
    const computeRoutesEnd = Date.now()

    const getRoutesEnd = Date.now()

    metric.putMetric('V2GetRoutesLoad', Date.now() - beforeGetRoutes, MetricLoggerUnit.Milliseconds)

    CONTEXT['V2 Quoter: getRoutes'] = {
      dataSize: {
        poolsRaw: poolsRaw.length,
      },
      durations: {
        getAllPoolsDuration: afterGetAllPools - beforeGetAllPools,
        tokenValidationDuration: afterTokenValidation - beforeTokenValidation,
        computeRoutesDuration: computeRoutesEnd - computeRoutesStart,
        totalDuration: getRoutesEnd - getRoutesStart,
      },
    }

    return {
      routes,
      candidatePools,
    }
  }

  public async getQuotes(
    routes: V2Route[],
    amounts: CurrencyAmount[],
    percents: number[],
    quoteToken: Token,
    tradeType: TradeType,
    _routingConfig: AlphaRouterConfig,
    candidatePools?: CandidatePoolsBySelectionCriteria,
    _gasModel?: IGasModel<V2RouteWithValidQuote>,
    gasPriceWei?: BigNumber
  ): Promise<GetQuotesResult> {
    const startTime = Date.now()
    const beforeGetQuotes = Date.now()
    log.info('Starting to get V2 quotes')
    if (gasPriceWei === undefined) {
      throw new Error('GasPriceWei for V2Routes is required to getQuotes')
    }
    if (routes.length == 0) {
      return { routesWithValidQuotes: [], candidatePools }
    }

    // For all our routes, and all the fractional amounts, fetch quotes on-chain.
    const quoteFn =
      tradeType == TradeType.EXACT_INPUT
        ? this.v2QuoteProvider.getQuotesManyExactIn.bind(this.v2QuoteProvider)
        : this.v2QuoteProvider.getQuotesManyExactOut.bind(this.v2QuoteProvider)

    const beforeQuotes = Date.now()
    const quoteFnStart = Date.now()
    log.info(`Getting quotes for V2 for ${routes.length} routes with ${amounts.length} amounts per route.`)
    const { routesWithQuotes } = await quoteFn(amounts, routes)
    const quoteFnEnd = Date.now()

    const buildGasModelStart = Date.now()

    const v2GasModel = await this.v2GasModelFactory.buildGasModel({
      chainId: this.chainId,
      gasPriceWei,
      poolProvider: this.v2PoolProvider,
      token: quoteToken,
    })
    const buildGasModelEnd = Date.now()

    metric.putMetric('V2QuotesLoad', Date.now() - beforeQuotes, MetricLoggerUnit.Milliseconds)

    metric.putMetric(
      'V2QuotesFetched',
      _(routesWithQuotes)
        .map(([, quotes]) => quotes.length)
        .sum(),
      MetricLoggerUnit.Count
    )

    const buildRouteStart = Date.now()

    const routesWithValidQuotes = []

    for (const routeWithQuote of routesWithQuotes) {
      const [route, quotes] = routeWithQuote

      for (let i = 0; i < quotes.length; i++) {
        const percent = percents[i]!
        const amountQuote = quotes[i]!
        const { quote, amount } = amountQuote

        if (!quote) {
          log.debug(
            {
              route: routeToString(route),
              amountQuote,
            },
            'Dropping a null V2 quote for route.'
          )
          continue
        }

        const routeWithValidQuote = new V2RouteWithValidQuote({
          route,
          rawQuote: quote,
          amount,
          percent,
          gasModel: v2GasModel,
          quoteToken,
          tradeType,
          v2PoolProvider: this.v2PoolProvider,
        })

        routesWithValidQuotes.push(routeWithValidQuote)
      }
    }

    const buildRouteEnd = Date.now()

    metric.putMetric('V2GetQuotesLoad', Date.now() - beforeGetQuotes, MetricLoggerUnit.Milliseconds)

    const endTime = Date.now()
    CONTEXT['V2 Quoter: getQuotes'] = {
      dataSize: {
        routes: routes.length,
        amounts: amounts.length,
      },
      duration: {
        buildGasModelDuration: buildGasModelEnd - buildGasModelStart,
        buildRouteDuration: buildRouteEnd - buildRouteStart,
        quoteFunctionDuration: quoteFnEnd - quoteFnStart,
        totalDuration: endTime - startTime,
      },
    }

    return {
      routesWithValidQuotes,
      candidatePools,
    }
  }

  public async refreshRoutesThenGetQuotes(
    tokenIn: Token,
    tokenOut: Token,
    routes: V2Route[],
    amounts: CurrencyAmount[],
    percents: number[],
    quoteToken: Token,
    tradeType: TradeType,
    routingConfig: AlphaRouterConfig,
    gasPriceWei?: BigNumber
  ): Promise<GetQuotesResult> {
    const tokenPairs: [Token, Token][] = []

    const buildTokenPairsStart = Date.now()
    routes.forEach((route) => route.pairs.forEach((pair) => tokenPairs.push([pair.token0, pair.token1])))
    const buildTokenPairsEnd = Date.now()

    const getPoolsStart = Date.now()
    const poolAccesor = await this.v2PoolProvider.getPools(tokenPairs, routingConfig)
    const getPoolsEnd = Date.now()

    const computeV2Routes = Date.now()
    const fetchedRoutes = computeAllV2Routes(
      tokenIn,
      tokenOut,
      poolAccesor.getAllPools(),
      routingConfig.maxSwapsPerPath
    )
    const computeV2RoutesEnd = Date.now()

    const getQuotesStart = Date.now()
    const result = await this.getQuotes(
      fetchedRoutes,
      amounts,
      percents,
      quoteToken,
      tradeType,
      routingConfig,
      undefined,
      undefined,
      gasPriceWei
    )
    const getQuotesEnd = Date.now()

    CONTEXT['V2 Quoter: refreshRoutesThenGetQuotes'] = {
      amounts: {
        routes: routes.length,
        amounts,
        percents,
        tokenPairs: tokenPairs.length,
      },
      duration: {
        buildTokenPairsDuration: buildTokenPairsEnd - buildTokenPairsStart,
        getPoolsDuration: getPoolsEnd - getPoolsStart,
        computeV2RoutesDuration: computeV2RoutesEnd - computeV2Routes,
        getQuotesDuration: getQuotesEnd - getQuotesStart,
      },
    }

    return result
  }
}
