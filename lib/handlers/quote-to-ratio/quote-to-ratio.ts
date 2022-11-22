import Joi from '@hapi/joi'
import { CondensedAddLiquidityOptions, Protocol } from '@uniswap/router-sdk'
import { Currency, CurrencyAmount, Fraction } from '@uniswap/sdk-core'
import {
  AlphaRouterConfig,
  ISwapToRatio,
  MetricLoggerUnit,
  routeAmountsToString,
  SwapAndAddConfig,
  SwapAndAddOptions,
  SwapToRatioStatus,
  SwapType,
} from '@uniswap/smart-order-router'
import { Position } from '@uniswap/v3-sdk'
import JSBI from 'jsbi'
import { APIGLambdaHandler, ErrorResponse, HandleRequestParams, Response } from '../handler'
import { ContainerInjected, RequestInjected } from '../injector-sor'
import { V2PoolInRoute, V3PoolInRoute } from '../schema'
import {
  DEFAULT_ROUTING_CONFIG_BY_CHAIN,
  parseDeadline,
  parseSlippageTolerance,
  tokenStringToCurrency,
} from '../shared'
import {
  QuoteToRatioQueryParams,
  QuoteToRatioQueryParamsJoi,
  QuoteToRatioResponse,
  QuotetoRatioResponseSchemaJoi,
} from './schema/quote-to-ratio-schema'

export class QuoteToRatioHandler extends APIGLambdaHandler<
  ContainerInjected,
  RequestInjected<ISwapToRatio<AlphaRouterConfig, SwapAndAddConfig>>,
  void,
  QuoteToRatioQueryParams,
  QuoteToRatioResponse
> {
  public async handleRequest(
    params: HandleRequestParams<
      ContainerInjected,
      RequestInjected<ISwapToRatio<AlphaRouterConfig, SwapAndAddConfig>>,
      void,
      QuoteToRatioQueryParams
    >
  ): Promise<Response<QuoteToRatioResponse> | ErrorResponse> {
    const {
      requestQueryParams: {
        token0Address,
        token0ChainId,
        token1Address,
        token1ChainId,
        token0Balance: token0BalanceRaw,
        token1Balance: token1BalanceRaw,
        tickLower,
        tickUpper,
        feeAmount,
        recipient,
        slippageTolerance,
        deadline,
        minSplits,
        ratioErrorTolerance,
        maxIterations,
        addLiquidityRecipient,
        addLiquidityTokenId,
      },
      requestInjected: {
        router,
        log,
        id: quoteId,
        chainId,
        tokenProvider,
        tokenListProvider,
        v3PoolProvider,
        v2PoolProvider,
        metric,
      },
    } = params

    // Parse user provided token address/symbol to Currency object.
    const before = Date.now()
    const type = 'exactIn'
    const token0 = await tokenStringToCurrency(tokenListProvider, tokenProvider, token0Address, token0ChainId, log)
    const token1 = await tokenStringToCurrency(tokenListProvider, tokenProvider, token1Address, token1ChainId, log)

    metric.putMetric('Token01StrToToken', Date.now() - before, MetricLoggerUnit.Milliseconds)

    if (!token0) {
      return {
        statusCode: 400,
        errorCode: 'TOKEN_0_INVALID',
        detail: `Could not find token with address "${token0Address}"`,
      }
    }

    if (!token1) {
      return {
        statusCode: 400,
        errorCode: 'TOKEN_1_INVALID',
        detail: `Could not find token with address "${token1Address}"`,
      }
    }

    if (token0ChainId != token1ChainId) {
      return {
        statusCode: 400,
        errorCode: 'TOKEN_CHAINS_DIFFERENT',
        detail: `Cannot request quotes for tokens on different chains`,
      }
    }

    if (token0.equals(token1)) {
      return {
        statusCode: 400,
        errorCode: 'TOKEN_0_1_SAME',
        detail: `token0 and token1 must be different`,
      }
    }

    if (token0.wrapped.address > token1.wrapped.address) {
      return {
        statusCode: 400,
        errorCode: 'TOKENS_MISORDERED',
        detail: `token0 address must be less than token1 address`,
      }
    }

    if (!!addLiquidityTokenId && !!addLiquidityRecipient) {
      return {
        statusCode: 400,
        errorCode: 'TOO_MANY_POSITION_OPTIONS',
        detail: `addLiquidityTokenId and addLiquidityRecipient are mutually exclusive. Must only provide one.`,
      }
    }

    if (!this.validTick(tickLower, feeAmount) || !this.validTick(tickUpper, feeAmount)) {
      return {
        statusCode: 400,
        errorCode: 'INVALID_TICK_SPACING',
        detail: `tickLower and tickUpper must comply with the tick spacing of the target pool`,
      }
    }

    const routingConfig: AlphaRouterConfig = {
      ...DEFAULT_ROUTING_CONFIG_BY_CHAIN(chainId),
      ...(minSplits ? { minSplits } : {}),
    }

    let addLiquidityOptions: CondensedAddLiquidityOptions
    if (addLiquidityTokenId) {
      addLiquidityOptions = { tokenId: addLiquidityTokenId }
    } else if (addLiquidityRecipient) {
      addLiquidityOptions = { recipient: addLiquidityRecipient }
    } else {
      return {
        statusCode: 400,
        errorCode: 'UNSPECIFIED_POSITION_OPTIONS',
        detail: `Either addLiquidityTokenId must be provided for existing positions or addLiquidityRecipient for new positions`,
      }
    }

    let swapAndAddOptions: SwapAndAddOptions | undefined = undefined
    if (slippageTolerance && deadline && recipient) {
      swapAndAddOptions = {
        swapOptions: {
          type: SwapType.SWAP_ROUTER_02,
          deadline: parseDeadline(deadline),
          recipient: recipient,
          slippageTolerance: parseSlippageTolerance(slippageTolerance),
        },
        addLiquidityOptions,
      }
    }

    const ratioErrorToleranceFraction = new Fraction(
      Math.round(parseFloat(ratioErrorTolerance.toString()) * 100),
      10_000
    )

    const token0Balance = CurrencyAmount.fromRawAmount(token0, JSBI.BigInt(token0BalanceRaw))
    const token1Balance = CurrencyAmount.fromRawAmount(token1, JSBI.BigInt(token1BalanceRaw))

    log.info(
      {
        token0: token0.symbol,
        token1: token1.symbol,
        chainId,
        token0Balance: token0Balance.quotient.toString(),
        token1Balance: token1Balance.quotient.toString(),
        tickLower,
        tickUpper,
        feeAmount,
        maxIterations,
        ratioErrorTolerance: ratioErrorToleranceFraction.toFixed(4),
        routingConfig: routingConfig,
      },
      `Swap To Ratio Parameters`
    )

    const poolAccessor = await v3PoolProvider.getPools([[token0.wrapped, token1.wrapped, feeAmount]])
    const pool = poolAccessor.getPool(token0.wrapped, token1.wrapped, feeAmount)
    if (!pool) {
      log.error(`Could not find pool.`, {
        token0,
        token1,
        feeAmount,
      })
      return { statusCode: 400, errorCode: 'POOL_NOT_FOUND' }
    }
    const position = new Position({
      pool,
      tickLower,
      tickUpper,
      liquidity: 1,
    })

    if (this.noSwapNeededForRangeOrder(position, token0Balance, token1Balance)) {
      return { statusCode: 400, errorCode: 'NO_SWAP_NEEDED', detail: 'No swap needed for range order' }
    }

    const swapRoute = await router.routeToRatio(
      token0Balance,
      token1Balance,
      position,
      {
        ratioErrorTolerance: ratioErrorToleranceFraction,
        maxIterations,
      },
      swapAndAddOptions,
      routingConfig
    )

    if (swapRoute.status == SwapToRatioStatus.NO_ROUTE_FOUND) {
      log.info(
        {
          token0: token0.symbol,
          token1: token1.symbol,
          token0Balance: token0Balance.quotient.toString(),
          token1Balance: token1Balance.quotient.toString(),
        },
        `No route found. 404`
      )

      return {
        statusCode: 404,
        errorCode: 'NO_ROUTE',
        detail: 'No route found',
      }
    }

    if (swapRoute.status == SwapToRatioStatus.NO_SWAP_NEEDED) {
      log.info(
        {
          token0: token0.symbol,
          token1: token1.symbol,
          token0Balance: token0Balance.quotient.toString(),
          token1Balance: token1Balance.quotient.toString(),
        },
        `No swap needed found. 404`
      )

      return {
        statusCode: 400,
        errorCode: 'NO_SWAP_NEEDED',
        detail: 'No swap needed',
      }
    }

    const {
      quote,
      quoteGasAdjusted,
      route,
      optimalRatio,
      postSwapTargetPool,
      trade,
      estimatedGasUsed,
      estimatedGasUsedQuoteToken,
      estimatedGasUsedUSD,
      gasPriceWei,
      methodParameters,
      blockNumber,
    } = swapRoute.result

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

    const tokenIn = trade.inputAmount.currency.wrapped
    const tokenOut = trade.outputAmount.currency.wrapped

    const zeroForOne = tokenIn.wrapped.address === token0.wrapped.address
    let token0BalanceUpdated: CurrencyAmount<Currency>
    let token1BalanceUpdated: CurrencyAmount<Currency>
    let optimalRatioAdjusted: Fraction
    let optimalRatioDecimal: string
    let newRatioDecimal: string
    if (zeroForOne) {
      token0BalanceUpdated = token0Balance.subtract(trade.inputAmount)
      token1BalanceUpdated = token1Balance.add(trade.outputAmount)
      optimalRatioAdjusted = optimalRatio
      optimalRatioDecimal = optimalRatioAdjusted.toFixed(token0.wrapped.decimals)
      newRatioDecimal = new Fraction(
        token0BalanceUpdated.quotient.toString(),
        token1BalanceUpdated.quotient.toString()
      ).toFixed(token0.wrapped.decimals)
    } else {
      token0BalanceUpdated = token0Balance.add(trade.outputAmount)
      token1BalanceUpdated = token1Balance.subtract(trade.inputAmount)
      optimalRatioAdjusted = optimalRatio.invert()
      optimalRatioDecimal =
        optimalRatioAdjusted.denominator.toString() == '0'
          ? `0.${'0'.repeat(token1.wrapped.decimals)}`
          : optimalRatioAdjusted.toFixed(token0.wrapped.decimals)
      newRatioDecimal =
        token1BalanceUpdated.numerator.toString() == '0'
          ? `0.${'0'.repeat(token1.wrapped.decimals)}`
          : new Fraction(token0BalanceUpdated.quotient.toString(), token1BalanceUpdated.quotient.toString()).toFixed(
              token0.wrapped.decimals
            )
    }

    const postSwapTargetPoolObject = {
      address: v3PoolProvider.getPoolAddress(
        postSwapTargetPool.token0,
        postSwapTargetPool.token1,
        postSwapTargetPool.fee
      ).poolAddress,
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
      fee: postSwapTargetPool.fee.toString(),
      liquidity: postSwapTargetPool.liquidity.toString(),
      sqrtRatioX96: postSwapTargetPool.sqrtRatioX96.toString(),
      tickCurrent: postSwapTargetPool.tickCurrent.toString(),
    }

    const result: QuoteToRatioResponse = {
      methodParameters,
      blockNumber: blockNumber.toString(),
      amount: trade.inputAmount.quotient.toString(),
      amountDecimals: trade.inputAmount.toFixed(trade.inputAmount.currency.decimals),
      quote: quote.quotient.toString(),
      tokenInAddress: trade.inputAmount.currency.wrapped.address,
      tokenOutAddress: trade.outputAmount.currency.wrapped.address,
      token0BalanceUpdated: token0BalanceUpdated.quotient.toString(),
      token1BalanceUpdated: token1BalanceUpdated.quotient.toString(),
      optimalRatio: optimalRatioDecimal.toString(),
      optimalRatioFraction: {
        numerator: optimalRatioAdjusted.numerator.toString(),
        denominator: optimalRatioAdjusted.denominator.toString(),
      },
      newRatio: newRatioDecimal.toString(),
      newRatioFraction: {
        numerator: token0BalanceUpdated.quotient.toString(),
        denominator: token1BalanceUpdated.quotient.toString(),
      },
      postSwapTargetPool: postSwapTargetPoolObject,
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
      simulationStatus: 'UNATTEMPTED',
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
    return QuoteToRatioQueryParamsJoi
  }

  protected responseBodySchema(): Joi.ObjectSchema | null {
    return QuotetoRatioResponseSchemaJoi
  }

  protected noSwapNeededForRangeOrder(
    position: Position,
    token0Balance: CurrencyAmount<Currency>,
    token1Balance: CurrencyAmount<Currency>
  ): boolean {
    if (position.pool.tickCurrent < position.tickLower) {
      return token1Balance.equalTo(0) && token0Balance.greaterThan(0)
    } else if (position.pool.tickCurrent > position.tickUpper) {
      return token0Balance.equalTo(0) && token1Balance.greaterThan(1)
    } else {
      return false
    }
  }

  protected validTick(tick: number, feeAmount: number): boolean {
    const TICK_SPACINGS = {
      500: 10,
      3000: 60,
      10000: 100,
    } as { [feeAmount: string]: number }

    let validTickSpacing = true

    if (TICK_SPACINGS[feeAmount] != undefined) {
      validTickSpacing = tick % TICK_SPACINGS[feeAmount] === 0
    }

    return validTickSpacing
  }
}
