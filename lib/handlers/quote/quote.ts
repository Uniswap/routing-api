import Joi from '@hapi/joi'
import { Protocol } from '@uniswap/router-sdk'
import { UNIVERSAL_ROUTER_ADDRESS } from '@uniswap/universal-router-sdk'
import { PermitSingle } from '@uniswap/permit2-sdk'
import { ChainId, Currency, CurrencyAmount, Token, TradeType } from '@uniswap/sdk-core'
import {
  AlphaRouterConfig,
  IRouter,
  MetricLoggerUnit,
  routeAmountsToString,
  SwapRoute,
  SwapOptions,
  SwapType,
  SimulationStatus,
  IMetric,
  ID_TO_NETWORK_NAME,
} from '@uniswap/smart-order-router'
import { Pool } from '@uniswap/v3-sdk'
import JSBI from 'jsbi'
import _ from 'lodash'
import { APIGLambdaHandler, ErrorResponse, HandleRequestParams, Response } from '../handler'
import { ContainerInjected, RequestInjected } from '../injector-sor'
import { QuoteResponse, QuoteResponseSchemaJoi, V2PoolInRoute, V3PoolInRoute } from '../schema'
import {
  DEFAULT_ROUTING_CONFIG_BY_CHAIN,
  parseDeadline,
  parseSlippageTolerance,
  tokenStringToCurrency,
  QUOTE_SPEED_CONFIG,
  INTENT_SPECIFIC_CONFIG,
  FEE_ON_TRANSFER_SPECIFIC_CONFIG,
  populateFeeOptions,
  computePortionAmount,
} from '../shared'
import { QuoteQueryParams, QuoteQueryParamsJoi } from './schema/quote-schema'
import { utils } from 'ethers'
import { simulationStatusToString } from './util/simulation'
import Logger from 'bunyan'
import { PAIRS_TO_TRACK } from './util/pairs-to-track'
import { measureDistributionPercentChangeImpact } from '../../util/alpha-config-measurement'
import { MetricsLogger } from 'aws-embedded-metrics'

export class QuoteHandler extends APIGLambdaHandler<
  ContainerInjected,
  RequestInjected<IRouter<AlphaRouterConfig>>,
  void,
  QuoteQueryParams,
  QuoteResponse
> {
  public async handleRequest(
    params: HandleRequestParams<ContainerInjected, RequestInjected<IRouter<any>>, void, QuoteQueryParams>
  ): Promise<Response<QuoteResponse> | ErrorResponse> {
    const { chainId, metric, log, quoteSpeed, intent } = params.requestInjected
    const startTime = Date.now()

    let result: Response<QuoteResponse> | ErrorResponse

    try {
      result = await this.handleRequestInternal(params)

      switch (result.statusCode) {
        case 200:
        case 202:
          metric.putMetric(`GET_QUOTE_200_CHAINID: ${chainId}`, 1, MetricLoggerUnit.Count)
          break
        case 400:
        case 403:
        case 404:
        case 408:
        case 409:
          metric.putMetric(`GET_QUOTE_400_CHAINID: ${chainId}`, 1, MetricLoggerUnit.Count)
          log.error(
            {
              statusCode: result?.statusCode,
              errorCode: result?.errorCode,
              detail: result?.detail,
            },
            `Quote 4XX Error [${result?.statusCode}] on ${ID_TO_NETWORK_NAME(chainId)} with errorCode '${
              result?.errorCode
            }': ${result?.detail}`
          )
          break
        case 500:
          metric.putMetric(`GET_QUOTE_500_CHAINID: ${chainId}`, 1, MetricLoggerUnit.Count)
          break
      }
    } catch (err) {
      metric.putMetric(`GET_QUOTE_500_CHAINID: ${chainId}`, 1, MetricLoggerUnit.Count)

      throw err
    } finally {
      // This metric is logged after calling the internal handler to correlate with the status metrics
      metric.putMetric(`GET_QUOTE_REQUESTED_CHAINID: ${chainId}`, 1, MetricLoggerUnit.Count)
      metric.putMetric(`GET_QUOTE_LATENCY_CHAIN_${chainId}`, Date.now() - startTime, MetricLoggerUnit.Milliseconds)

      metric.putMetric(
        `GET_QUOTE_LATENCY_CHAIN_${chainId}_QUOTE_SPEED_${quoteSpeed ?? 'standard'}`,
        Date.now() - startTime,
        MetricLoggerUnit.Milliseconds
      )
      metric.putMetric(
        `GET_QUOTE_LATENCY_CHAIN_${chainId}_INTENT_${intent ?? 'quote'}`,
        Date.now() - startTime,
        MetricLoggerUnit.Milliseconds
      )
    }

    return result
  }

  private async handleRequestInternal(
    params: HandleRequestParams<ContainerInjected, RequestInjected<IRouter<any>>, void, QuoteQueryParams>
  ): Promise<Response<QuoteResponse> | ErrorResponse> {
    const {
      requestQueryParams: {
        tokenInAddress,
        tokenInChainId,
        tokenOutAddress,
        tokenOutChainId,
        amount: amountRaw,
        type,
        recipient,
        slippageTolerance,
        deadline,
        minSplits,
        forceCrossProtocol,
        forceMixedRoutes,
        protocols: protocolsStr,
        simulateFromAddress,
        permitSignature,
        permitNonce,
        permitExpiration,
        permitAmount,
        permitSigDeadline,
        enableUniversalRouter,
        quoteSpeed,
        debugRoutingConfig,
        unicornSecret,
        intent,
        enableFeeOnTransferFeeFetching,
        portionBips,
        portionAmount,
        portionRecipient,
        source,
      },
      requestInjected: {
        router,
        log,
        id: quoteId,
        chainId,
        tokenProvider,
        tokenListProvider,
        v3PoolProvider: v3PoolProvider,
        v2PoolProvider: v2PoolProvider,
        metric,
      },
    } = params

    // Parse user provided token address/symbol to Currency object.
    let before = Date.now()
    const startTime = Date.now()

    metric.putMetric(`GET_QUOTE_REQUEST_SOURCE: ${source}`, 1, MetricLoggerUnit.Count)

    const currencyIn = await tokenStringToCurrency(
      tokenListProvider,
      tokenProvider,
      tokenInAddress,
      tokenInChainId,
      log
    )

    const currencyOut = await tokenStringToCurrency(
      tokenListProvider,
      tokenProvider,
      tokenOutAddress,
      tokenOutChainId,
      log
    )

    metric.putMetric('TokenInOutStrToToken', Date.now() - before, MetricLoggerUnit.Milliseconds)

    if (!currencyIn) {
      return {
        statusCode: 400,
        errorCode: 'TOKEN_IN_INVALID',
        detail: `Could not find token with address "${tokenInAddress}"`,
      }
    }

    if (!currencyOut) {
      return {
        statusCode: 400,
        errorCode: 'TOKEN_OUT_INVALID',
        detail: `Could not find token with address "${tokenOutAddress}"`,
      }
    }

    if (tokenInChainId != tokenOutChainId) {
      return {
        statusCode: 400,
        errorCode: 'TOKEN_CHAINS_DIFFERENT',
        detail: `Cannot request quotes for tokens on different chains`,
      }
    }

    if (currencyIn.equals(currencyOut)) {
      return {
        statusCode: 400,
        errorCode: 'TOKEN_IN_OUT_SAME',
        detail: `tokenIn and tokenOut must be different`,
      }
    }

    let protocols: Protocol[] = []
    if (protocolsStr) {
      for (const protocolStr of protocolsStr) {
        switch (protocolStr.toLowerCase()) {
          case 'v2':
            protocols.push(Protocol.V2)
            break
          case 'v3':
            protocols.push(Protocol.V3)
            break
          case 'mixed':
            protocols.push(Protocol.MIXED)
            break
          default:
            return {
              statusCode: 400,
              errorCode: 'INVALID_PROTOCOL',
              detail: `Invalid protocol specified. Supported protocols: ${JSON.stringify(Object.values(Protocol))}`,
            }
        }
      }
    } else if (!forceCrossProtocol) {
      protocols = [Protocol.V3]
    }

    let parsedDebugRoutingConfig = {}
    if (debugRoutingConfig && unicornSecret && unicornSecret === process.env.UNICORN_SECRET) {
      parsedDebugRoutingConfig = JSON.parse(debugRoutingConfig)
    }

    const routingConfig: AlphaRouterConfig = {
      ...DEFAULT_ROUTING_CONFIG_BY_CHAIN(chainId),
      ...(minSplits ? { minSplits } : {}),
      ...(forceCrossProtocol ? { forceCrossProtocol } : {}),
      ...(forceMixedRoutes ? { forceMixedRoutes } : {}),
      protocols,
      ...(quoteSpeed ? QUOTE_SPEED_CONFIG[quoteSpeed] : {}),
      ...parsedDebugRoutingConfig,
      ...(intent ? INTENT_SPECIFIC_CONFIG[intent] : {}),
      // Only when enableFeeOnTransferFeeFetching is explicitly set to true, then we
      // override usedCachedRoutes to false. This is to ensure that we don't use
      // accidentally override usedCachedRoutes in the normal path.
      ...(enableFeeOnTransferFeeFetching ? FEE_ON_TRANSFER_SPECIFIC_CONFIG(enableFeeOnTransferFeeFetching) : {}),
    }

    metric.putMetric(`${intent}Intent`, 1, MetricLoggerUnit.Count)

    let swapParams: SwapOptions | undefined = undefined

    // e.g. Inputs of form "1.25%" with 2dp max. Convert to fractional representation => 1.25 => 125 / 10000
    if (slippageTolerance) {
      const slippageTolerancePercent = parseSlippageTolerance(slippageTolerance)

      // TODO: Remove once universal router is no longer behind a feature flag.
      if (enableUniversalRouter) {
        const allFeeOptions = populateFeeOptions(
          type,
          portionBips,
          portionRecipient,
          portionAmount ??
            computePortionAmount(CurrencyAmount.fromRawAmount(currencyOut, JSBI.BigInt(amountRaw)), portionBips)
        )

        swapParams = {
          type: SwapType.UNIVERSAL_ROUTER,
          deadlineOrPreviousBlockhash: deadline ? parseDeadline(deadline) : undefined,
          recipient: recipient,
          slippageTolerance: slippageTolerancePercent,
          ...allFeeOptions,
        }
      } else {
        if (deadline && recipient) {
          swapParams = {
            type: SwapType.SWAP_ROUTER_02,
            deadline: parseDeadline(deadline),
            recipient: recipient,
            slippageTolerance: slippageTolerancePercent,
          }
        }
      }

      if (
        enableUniversalRouter &&
        permitSignature &&
        permitNonce &&
        permitExpiration &&
        permitAmount &&
        permitSigDeadline
      ) {
        const permit: PermitSingle = {
          details: {
            token: currencyIn.wrapped.address,
            amount: permitAmount,
            expiration: permitExpiration,
            nonce: permitNonce,
          },
          spender: UNIVERSAL_ROUTER_ADDRESS(chainId),
          sigDeadline: permitSigDeadline,
        }

        if (swapParams) {
          swapParams.inputTokenPermit = {
            ...permit,
            signature: permitSignature,
          }
        }
      } else if (
        !enableUniversalRouter &&
        permitSignature &&
        ((permitNonce && permitExpiration) || (permitAmount && permitSigDeadline))
      ) {
        const { v, r, s } = utils.splitSignature(permitSignature)

        if (swapParams) {
          swapParams.inputTokenPermit = {
            v: v as 0 | 1 | 27 | 28,
            r,
            s,
            ...(permitNonce && permitExpiration
              ? { nonce: permitNonce!, expiry: permitExpiration! }
              : { amount: permitAmount!, deadline: permitSigDeadline! }),
          }
        }
      }

      if (simulateFromAddress) {
        metric.putMetric('Simulation Requested', 1, MetricLoggerUnit.Count)

        if (swapParams) {
          swapParams.simulate = { fromAddress: simulateFromAddress }
        }
      }
    }

    before = Date.now()

    let swapRoute: SwapRoute | null
    let amount: CurrencyAmount<Currency>

    let tokenPairSymbol = ''
    let tokenPairSymbolChain = ''
    if (currencyIn.symbol && currencyOut.symbol) {
      tokenPairSymbol = _([currencyIn.symbol, currencyOut.symbol]).join('/')
      tokenPairSymbolChain = `${tokenPairSymbol}/${chainId}`
    }

    const [token0Symbol, token0Address, token1Symbol, token1Address] = currencyIn.wrapped.sortsBefore(
      currencyOut.wrapped
    )
      ? [currencyIn.symbol, currencyIn.wrapped.address, currencyOut.symbol, currencyOut.wrapped.address]
      : [currencyOut.symbol, currencyOut.wrapped.address, currencyIn.symbol, currencyIn.wrapped.address]

    switch (type) {
      case 'exactIn':
        amount = CurrencyAmount.fromRawAmount(currencyIn, JSBI.BigInt(amountRaw))

        log.info(
          {
            amountIn: amount.toExact(),
            token0Address,
            token1Address,
            token0Symbol,
            token1Symbol,
            tokenInSymbol: currencyIn.symbol,
            tokenOutSymbol: currencyOut.symbol,
            tokenPairSymbol,
            tokenPairSymbolChain,
            type,
            routingConfig: routingConfig,
            swapParams,
            intent,
          },
          `Exact In Swap: Give ${amount.toExact()} ${amount.currency.symbol}, Want: ${
            currencyOut.symbol
          }. Chain: ${chainId}`
        )

        swapRoute = await router.route(amount, currencyOut, TradeType.EXACT_INPUT, swapParams, routingConfig)
        break
      case 'exactOut':
        amount = CurrencyAmount.fromRawAmount(currencyOut, JSBI.BigInt(amountRaw))

        log.info(
          {
            amountOut: amount.toExact(),
            token0Address,
            token1Address,
            token0Symbol,
            token1Symbol,
            tokenInSymbol: currencyIn.symbol,
            tokenOutSymbol: currencyOut.symbol,
            tokenPairSymbol,
            tokenPairSymbolChain,
            type,
            routingConfig: routingConfig,
            swapParams,
          },
          `Exact Out Swap: Want ${amount.toExact()} ${amount.currency.symbol} Give: ${
            currencyIn.symbol
          }. Chain: ${chainId}`
        )

        swapRoute = await router.route(amount, currencyIn, TradeType.EXACT_OUTPUT, swapParams, routingConfig)
        break
      default:
        throw new Error('Invalid swap type')
    }

    if (!swapRoute) {
      log.info(
        {
          type,
          tokenIn: currencyIn,
          tokenOut: currencyOut,
          amount: amount.quotient.toString(),
        },
        `No route found. 404`
      )

      return {
        statusCode: 404,
        errorCode: 'NO_ROUTE',
        detail: 'No route found',
      }
    }

    const {
      quote,
      quoteGasAdjusted,
      quoteGasAndPortionAdjusted,
      route,
      estimatedGasUsed,
      estimatedGasUsedQuoteToken,
      estimatedGasUsedUSD,
      gasPriceWei,
      methodParameters,
      blockNumber,
      simulationStatus,
      hitsCachedRoute,
      portionAmount: outputPortionAmount, // TODO: name it back to portionAmount
    } = swapRoute

    if (simulationStatus == SimulationStatus.Failed) {
      metric.putMetric('SimulationFailed', 1, MetricLoggerUnit.Count)
    } else if (simulationStatus == SimulationStatus.Succeeded) {
      metric.putMetric('SimulationSuccessful', 1, MetricLoggerUnit.Count)
    } else if (simulationStatus == SimulationStatus.InsufficientBalance) {
      metric.putMetric('SimulationInsufficientBalance', 1, MetricLoggerUnit.Count)
    } else if (simulationStatus == SimulationStatus.NotApproved) {
      metric.putMetric('SimulationNotApproved', 1, MetricLoggerUnit.Count)
    } else if (simulationStatus == SimulationStatus.NotSupported) {
      metric.putMetric('SimulationNotSupported', 1, MetricLoggerUnit.Count)
    }

    const routeResponse: Array<(V3PoolInRoute | V2PoolInRoute)[]> = []

    for (const subRoute of route) {
      const { amount, quote, tokenPath } = subRoute

      const pools = subRoute.protocol == Protocol.V2 ? subRoute.route.pairs : subRoute.route.pools
      const curRoute: (V3PoolInRoute | V2PoolInRoute)[] = []
      for (let i = 0; i < pools.length; i++) {
        const nextPool = pools[i]
        const tokenIn = tokenPath[i]
        const tokenOut = tokenPath[i + 1]

        let edgeAmountIn = undefined
        if (i == 0) {
          edgeAmountIn = type == 'exactIn' ? amount.quotient.toString() : quote.quotient.toString()
        }

        let edgeAmountOut = undefined
        if (i == pools.length - 1) {
          edgeAmountOut = type == 'exactIn' ? quote.quotient.toString() : amount.quotient.toString()
        }

        if (nextPool instanceof Pool) {
          curRoute.push({
            type: 'v3-pool',
            address: v3PoolProvider.getPoolAddress(nextPool.token0, nextPool.token1, nextPool.fee).poolAddress,
            tokenIn: {
              chainId: tokenIn.chainId,
              decimals: tokenIn.decimals.toString(),
              address: tokenIn.address,
              symbol: tokenIn.symbol!,
            },
            tokenOut: {
              chainId: tokenOut.chainId,
              decimals: tokenOut.decimals.toString(),
              address: tokenOut.address,
              symbol: tokenOut.symbol!,
            },
            fee: nextPool.fee.toString(),
            liquidity: nextPool.liquidity.toString(),
            sqrtRatioX96: nextPool.sqrtRatioX96.toString(),
            tickCurrent: nextPool.tickCurrent.toString(),
            amountIn: edgeAmountIn,
            amountOut: edgeAmountOut,
          })
        } else {
          const reserve0 = nextPool.reserve0
          const reserve1 = nextPool.reserve1

          curRoute.push({
            type: 'v2-pool',
            address: v2PoolProvider.getPoolAddress(nextPool.token0, nextPool.token1).poolAddress,
            tokenIn: {
              chainId: tokenIn.chainId,
              decimals: tokenIn.decimals.toString(),
              address: tokenIn.address,
              symbol: tokenIn.symbol!,
              buyFeeBps: this.deriveBuyFeeBps(tokenIn, reserve0, reserve1, enableFeeOnTransferFeeFetching),
              sellFeeBps: this.deriveSellFeeBps(tokenIn, reserve0, reserve1, enableFeeOnTransferFeeFetching),
            },
            tokenOut: {
              chainId: tokenOut.chainId,
              decimals: tokenOut.decimals.toString(),
              address: tokenOut.address,
              symbol: tokenOut.symbol!,
              buyFeeBps: this.deriveBuyFeeBps(tokenOut, reserve0, reserve1, enableFeeOnTransferFeeFetching),
              sellFeeBps: this.deriveSellFeeBps(tokenOut, reserve0, reserve1, enableFeeOnTransferFeeFetching),
            },
            reserve0: {
              token: {
                chainId: reserve0.currency.wrapped.chainId,
                decimals: reserve0.currency.wrapped.decimals.toString(),
                address: reserve0.currency.wrapped.address,
                symbol: reserve0.currency.wrapped.symbol!,
                buyFeeBps: this.deriveBuyFeeBps(
                  reserve0.currency.wrapped,
                  reserve0,
                  undefined,
                  enableFeeOnTransferFeeFetching
                ),
                sellFeeBps: this.deriveSellFeeBps(
                  reserve0.currency.wrapped,
                  reserve0,
                  undefined,
                  enableFeeOnTransferFeeFetching
                ),
              },
              quotient: reserve0.quotient.toString(),
            },
            reserve1: {
              token: {
                chainId: reserve1.currency.wrapped.chainId,
                decimals: reserve1.currency.wrapped.decimals.toString(),
                address: reserve1.currency.wrapped.address,
                symbol: reserve1.currency.wrapped.symbol!,
                buyFeeBps: this.deriveBuyFeeBps(
                  reserve1.currency.wrapped,
                  undefined,
                  reserve1,
                  enableFeeOnTransferFeeFetching
                ),
                sellFeeBps: this.deriveSellFeeBps(
                  reserve1.currency.wrapped,
                  undefined,
                  reserve1,
                  enableFeeOnTransferFeeFetching
                ),
              },
              quotient: reserve1.quotient.toString(),
            },
            amountIn: edgeAmountIn,
            amountOut: edgeAmountOut,
          })
        }
      }

      routeResponse.push(curRoute)
    }

    const routeString = routeAmountsToString(route)

    const result: QuoteResponse = {
      methodParameters,
      blockNumber: blockNumber.toString(),
      amount: amount.quotient.toString(),
      amountDecimals: amount.toExact(),
      quote: quote.quotient.toString(),
      quoteDecimals: quote.toExact(),
      quoteGasAdjusted: quoteGasAdjusted.quotient.toString(),
      quoteGasAdjustedDecimals: quoteGasAdjusted.toExact(),
      quoteGasAndPortionAdjusted: quoteGasAndPortionAdjusted?.quotient.toString(),
      quoteGasAndPortionAdjustedDecimals: quoteGasAndPortionAdjusted?.toExact(),
      gasUseEstimateQuote: estimatedGasUsedQuoteToken.quotient.toString(),
      gasUseEstimateQuoteDecimals: estimatedGasUsedQuoteToken.toExact(),
      gasUseEstimate: estimatedGasUsed.toString(),
      gasUseEstimateUSD: estimatedGasUsedUSD.toExact(),
      simulationStatus: simulationStatusToString(simulationStatus, log),
      simulationError: simulationStatus == SimulationStatus.Failed,
      gasPriceWei: gasPriceWei.toString(),
      route: routeResponse,
      routeString,
      quoteId,
      hitsCachedRoutes: hitsCachedRoute,
      portionBips: portionBips,
      portionRecipient: portionRecipient,
      portionAmount: outputPortionAmount?.quotient.toString(),
      portionAmountDecimals: outputPortionAmount?.toExact(),
    }

    this.logRouteMetrics(
      log,
      metric,
      startTime,
      currencyIn,
      currencyOut,
      tokenInAddress,
      tokenOutAddress,
      type,
      chainId,
      amount,
      routeString,
      swapRoute
    )

    return {
      statusCode: 200,
      body: result,
    }
  }

  private deriveBuyFeeBps(
    token: Currency,
    reserve0?: CurrencyAmount<Token>,
    reserve1?: CurrencyAmount<Token>,
    enableFeeOnTransferFeeFetching?: boolean
  ): string | undefined {
    if (!enableFeeOnTransferFeeFetching) {
      return undefined
    }

    if (reserve0?.currency.equals(token)) {
      return reserve0.currency.buyFeeBps?.toString()
    }

    if (reserve1?.currency.equals(token)) {
      return reserve1.currency.buyFeeBps?.toString()
    }

    return undefined
  }

  private deriveSellFeeBps(
    token: Currency,
    reserve0?: CurrencyAmount<Token>,
    reserve1?: CurrencyAmount<Token>,
    enableFeeOnTransferFeeFetching?: boolean
  ): string | undefined {
    if (!enableFeeOnTransferFeeFetching) {
      return undefined
    }

    if (reserve0?.currency.equals(token)) {
      return reserve0.currency.sellFeeBps?.toString()
    }

    if (reserve1?.currency.equals(token)) {
      return reserve1.currency.sellFeeBps?.toString()
    }

    return undefined
  }

  private logRouteMetrics(
    log: Logger,
    metric: IMetric,
    startTime: number,
    currencyIn: Currency,
    currencyOut: Currency,
    tokenInAddress: string,
    tokenOutAddress: string,
    tradeType: 'exactIn' | 'exactOut',
    chainId: ChainId,
    amount: CurrencyAmount<Currency>,
    routeString: string,
    swapRoute: SwapRoute
  ): void {
    const tradingPair = `${currencyIn.wrapped.symbol}/${currencyOut.wrapped.symbol}`
    const wildcardInPair = `${currencyIn.wrapped.symbol}/*`
    const wildcardOutPair = `*/${currencyOut.wrapped.symbol}`
    const tradeTypeEnumValue = tradeType == 'exactIn' ? TradeType.EXACT_INPUT : TradeType.EXACT_OUTPUT
    const pairsTracked = PAIRS_TO_TRACK.get(chainId)?.get(tradeTypeEnumValue)

    measureDistributionPercentChangeImpact(5, 10, swapRoute, currencyIn, currencyOut, tradeType, chainId, amount)

    if (
      pairsTracked?.includes(tradingPair) ||
      pairsTracked?.includes(wildcardInPair) ||
      pairsTracked?.includes(wildcardOutPair)
    ) {
      const metricPair = pairsTracked?.includes(tradingPair)
        ? tradingPair
        : pairsTracked?.includes(wildcardInPair)
        ? wildcardInPair
        : wildcardOutPair

      metric.putMetric(
        `GET_QUOTE_AMOUNT_${metricPair}_${tradeType.toUpperCase()}_CHAIN_${chainId}`,
        Number(amount.toExact()),
        MetricLoggerUnit.None
      )

      metric.putMetric(
        `GET_QUOTE_LATENCY_${metricPair}_${tradeType.toUpperCase()}_CHAIN_${chainId}`,
        Date.now() - startTime,
        MetricLoggerUnit.Milliseconds
      )

      // Create a hashcode from the routeString, this will indicate that a different route is being used
      // hashcode function copied from: https://gist.github.com/hyamamoto/fd435505d29ebfa3d9716fd2be8d42f0?permalink_comment_id=4261728#gistcomment-4261728
      const routeStringHash = Math.abs(
        routeString.split('').reduce((s, c) => (Math.imul(31, s) + c.charCodeAt(0)) | 0, 0)
      )
      // Log the chose route
      log.info(
        {
          tradingPair,
          tokenInAddress,
          tokenOutAddress,
          tradeType,
          amount: amount.toExact(),
          routeString,
          routeStringHash,
          chainId,
        },
        `Tracked Route for pair [${tradingPair}/${tradeType.toUpperCase()}] on chain [${chainId}] with route hash [${routeStringHash}] for amount [${amount.toExact()}]`
      )
    }
  }

  protected requestBodySchema(): Joi.ObjectSchema | null {
    return null
  }

  protected requestQueryParamsSchema(): Joi.ObjectSchema | null {
    return QuoteQueryParamsJoi
  }

  protected responseBodySchema(): Joi.ObjectSchema | null {
    return QuoteResponseSchemaJoi
  }

  protected afterHandler(metric: MetricsLogger, response: QuoteResponse, requestStart: number): void {
    metric.putMetric(
      `GET_QUOTE_LATENCY_TOP_LEVEL_${response.hitsCachedRoutes ? 'CACHED_ROUTES_HIT' : 'CACHED_ROUTES_MISS'}`,
      Date.now() - requestStart,
      MetricLoggerUnit.Milliseconds
    )
  }
}
