import Joi from '@hapi/joi'
import { Protocol } from '@uniswap/router-sdk'
import { Currency, CurrencyAmount, TradeType } from '@uniswap/sdk-core'
import {
  AlphaRouterConfig,
  IRouter,
  LegacyRoutingConfig,
  MetricLoggerUnit,
  routeAmountsToString,
  SwapOptions,
  SwapRoute,
} from '@uniswap/smart-order-router'
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
} from '../shared'
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
        forceCrossProtocol,
        protocols: protocolsStr,
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

    const routingConfig: AlphaRouterConfig = {
      ...DEFAULT_ROUTING_CONFIG_BY_CHAIN(chainId),
      ...(minSplits ? { minSplits } : {}),
      ...(forceCrossProtocol ? { forceCrossProtocol } : {}),
      protocols,
    }

    let swapParams: SwapOptions | undefined = undefined

    // e.g. Inputs of form "1.25%" with 2dp max. Convert to fractional representation => 1.25 => 125 / 10000
    if (slippageTolerance && deadline && recipient) {
      const slippageTolerancePercent = parseSlippageTolerance(slippageTolerance)
      swapParams = {
        deadline: parseDeadline(deadline),
        recipient: recipient,
        slippageTolerance: slippageTolerancePercent,
      }
    }

    let swapRoute: SwapRoute | null
    let amount: CurrencyAmount<Currency>

    let tokenPairSymbol = ''
    let tokenPairSymbolChain = ''
    if (currencyIn.symbol && currencyOut.symbol) {
      tokenPairSymbol = _([currencyIn.symbol, currencyOut.symbol]).sort().join('/')
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
      route,
      estimatedGasUsed,
      estimatedGasUsedQuoteToken,
      estimatedGasUsedUSD,
      gasPriceWei,
      methodParameters,
      blockNumber,
    } = swapRoute

    const routeResponse: Array<V3PoolInRoute[] | V2PoolInRoute[]> = []

    for (const subRoute of route) {
      const { amount, quote, tokenPath } = subRoute

      if (subRoute.protocol == Protocol.V3) {
        const pools = subRoute.route.pools
        const curRoute: V3PoolInRoute[] = []
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
        }

        routeResponse.push(curRoute)
      } else if (subRoute.protocol == Protocol.V2) {
        const pools = subRoute.route.pairs
        const curRoute: V2PoolInRoute[] = []
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
            },
            tokenOut: {
              chainId: tokenOut.chainId,
              decimals: tokenOut.decimals.toString(),
              address: tokenOut.address,
              symbol: tokenOut.symbol!,
            },
            reserve0: {
              token: {
                chainId: reserve0.currency.wrapped.chainId,
                decimals: reserve0.currency.wrapped.decimals.toString(),
                address: reserve0.currency.wrapped.address,
                symbol: reserve0.currency.wrapped.symbol!,
              },
              quotient: reserve0.quotient.toString(),
            },
            reserve1: {
              token: {
                chainId: reserve1.currency.wrapped.chainId,
                decimals: reserve1.currency.wrapped.decimals.toString(),
                address: reserve1.currency.wrapped.address,
                symbol: reserve1.currency.wrapped.symbol!,
              },
              quotient: reserve1.quotient.toString(),
            },
            amountIn: edgeAmountIn,
            amountOut: edgeAmountOut,
          })
        }

        routeResponse.push(curRoute)
      }
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
