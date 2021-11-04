import Joi from '@hapi/joi'
import { Currency, CurrencyAmount, Percent, TradeType } from '@uniswap/sdk-core'
import {
  AlphaRouterConfig,
  IRouter,
  LegacyRoutingConfig,
  MetricLoggerUnit,
  routeAmountsToString,
  SwapConfig,
  SwapRoute,
} from '@uniswap/smart-order-router'
import JSBI from 'jsbi'
import { APIGLambdaHandler, ErrorResponse, HandleRequestParams, Response } from '../handler'
import { ContainerInjected, RequestInjected } from '../injector-sor'
import { PoolInRoute, QuoteResponse, QuoteResponseSchemaJoi } from '../schema'
import { DEFAULT_ROUTING_CONFIG, tokenStringToCurrency } from '../shared'
import { QuoteQueryParams, QuoteQueryParamsJoi } from './schema/quote-schema'

export class QuoteHandler extends APIGLambdaHandler<
  ContainerInjected,
  RequestInjected<IRouter<AlphaRouterConfig | LegacyRoutingConfig>>,
  void,
  QuoteQueryParams,
  QuoteResponse
> {
  public async handleRequest(
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
      },
      requestInjected: { router, log, id: quoteId, chainId, tokenProvider, tokenListProvider, poolProvider, metric },
    } = params

    // Parse user provided token address/symbol to Currency object.
    const before = Date.now()

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

    const routingConfig = {
      ...DEFAULT_ROUTING_CONFIG,
      ...(minSplits ? { minSplits } : {}),
    }

    let swapParams: SwapConfig | undefined = undefined

    if (slippageTolerance && deadline && recipient) {
      const slippagePer10k = Math.round(parseFloat(slippageTolerance) * 100)
      const slippageTolerancePercent = new Percent(slippagePer10k, 10_000)
      swapParams = {
        deadline: Math.floor(Date.now() / 1000) + parseInt(deadline),
        recipient: recipient,
        slippageTolerance: slippageTolerancePercent,
      }
    }

    // e.g. Inputs of form "1.25%" with 2dp max. Convert to fractional representation => 1.25 => 125 / 10000
    let swapRoute: SwapRoute<TradeType> | null
    let amount: CurrencyAmount<Currency>
    switch (type) {
      case 'exactIn':
        amount = CurrencyAmount.fromRawAmount(currencyIn, JSBI.BigInt(amountRaw))

        log.info(
          {
            amountIn: amount.toExact(),
            currency: amount.currency.symbol,
            routingConfig: routingConfig,
          },
          `Exact In Swap: Give ${amount.toExact()} ${amount.currency.symbol}, Want: ${
            currencyOut.symbol
          }. Chain: ${chainId}`
        )

        swapRoute = await router.routeExactIn(currencyIn, currencyOut, amount, swapParams, routingConfig)
        break
      case 'exactOut':
        amount = CurrencyAmount.fromRawAmount(currencyOut, JSBI.BigInt(amountRaw))

        log.info(
          {
            amountIn: amount.toExact(),
            currency: amount.currency.symbol,
            routingConfig: routingConfig,
          },
          `Exact Out Swap: Want ${amount.toExact()} ${amount.currency.symbol} Give: ${
            currencyIn.symbol
          }. Chain: ${chainId}`
        )

        swapRoute = await router.routeExactOut(currencyIn, currencyOut, amount, swapParams, routingConfig)
        break
      default:
        throw new Error('')
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
      route,
      estimatedGasUsed,
      estimatedGasUsedQuoteToken,
      estimatedGasUsedUSD,
      gasPriceWei,
      methodParameters,
      blockNumber,
    } = swapRoute

    const routeResponse: Array<PoolInRoute[]> = []

    for (const subRoute of route) {
      const {
        route: { tokenPath, pools },
        amount,
        quote,
      } = subRoute

      const curRoute: PoolInRoute[] = []
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

        curRoute.push({
          type: 'v3-pool',
          address: poolProvider.getPoolAddress(nextPool.token0, nextPool.token1, nextPool.fee).poolAddress,
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
      }

      routeResponse.push(curRoute)
    }

    const result: QuoteResponse = {
      methodParameters,
      blockNumber: blockNumber.toString(),
      amount: amount.quotient.toString(),
      amountDecimals: amount.toExact(),
      quote: quote.quotient.toString(),
      quoteDecimals: quote.toExact(),
      quoteGasAdjusted: quoteGasAdjusted.quotient.toString(),
      quoteGasAdjustedDecimals: quoteGasAdjusted.toExact(),
      gasUseEstimateQuote: estimatedGasUsedQuoteToken.quotient.toString(),
      gasUseEstimateQuoteDecimals: estimatedGasUsedQuoteToken.toExact(),
      gasUseEstimate: estimatedGasUsed.toString(),
      gasUseEstimateUSD: estimatedGasUsedUSD.toExact(),
      gasPriceWei: gasPriceWei.toString(),
      route: routeResponse,
      routeString: routeAmountsToString(route),
      quoteId,
    }

    return {
      statusCode: 200,
      body: result,
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
}
