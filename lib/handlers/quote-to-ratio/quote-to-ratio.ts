import Joi from '@hapi/joi';
import { Currency, CurrencyAmount, Fraction, Percent } from '@uniswap/sdk-core';
import { Position } from '@uniswap/v3-sdk';
import {
  AlphaRouterConfig,
  ISwapToRatio,
  MetricLoggerUnit,
  routeAmountsToString,
  SwapConfig,
  SwapAndAddConfig,
} from '@uniswap/smart-order-router';
import JSBI from 'jsbi';
import {
  APIGLambdaHandler,
  ErrorResponse,
  HandleRequestParams,
  Response,
} from '../handler';
import { PoolInRoute } from '../schema';
import { DEFAULT_ROUTING_CONFIG, tokenStringToCurrency } from '../shared';
import { ContainerInjected, RequestInjected } from '../injector-sor';
import {
  QuoteToRatioQueryParams,
  QuoteToRatioQueryParamsJoi,
  QuoteToRatioResponse,
  QuotetoRatioResponseSchemaJoi,
} from './schema/quote-to-ratio-schema';

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
        errorTolerance,
        maxIterations,
      },
      requestInjected: {
        router,
        log,
        id: quoteId,
        chainId,
        tokenProvider,
        tokenListProvider,
        poolProvider,
        metric,
      },
    } = params;

    // Parse user provided token address/symbol to Currency object.
    const before = Date.now();

    const type = 'exactIn';

    const token0 = await tokenStringToCurrency(
      tokenListProvider,
      tokenProvider,
      token0Address,
      token0ChainId,
      log
    );

    const token1 = await tokenStringToCurrency(
      tokenListProvider,
      tokenProvider,
      token1Address,
      token1ChainId,
      log
    );

    metric.putMetric(
      'Token01StrToToken',
      Date.now() - before,
      MetricLoggerUnit.Milliseconds
    );

    if (!token0) {
      return {
        statusCode: 400,
        errorCode: 'TOKEN_0_INVALID',
        detail: `Could not find token with address "${token0Address}"`,
      };
    }

    if (!token1) {
      return {
        statusCode: 400,
        errorCode: 'TOKEN_1_INVALID',
        detail: `Could not find token with address "${token1Address}"`,
      };
    }

    if (token0ChainId != token1ChainId) {
      return {
        statusCode: 400,
        errorCode: 'TOKEN_CHAINS_DIFFERENT',
        detail: `Cannot request quotes for tokens on different chains`,
      };
    }

    if (token0.equals(token1)) {
      return {
        statusCode: 400,
        errorCode: 'TOKEN_0_1_SAME',
        detail: `token0 and token1 must be different`,
      };
    }

    const routingConfig = {
      ...DEFAULT_ROUTING_CONFIG,
      ...(minSplits ? { minSplits } : {}),
    };

    let swapParams: SwapConfig | undefined = undefined;

    if (slippageTolerance && deadline && recipient) {
      const slippagePer10k = Math.round(parseFloat(slippageTolerance) * 100);
      const slippageTolerancePercent = new Percent(slippagePer10k, 10_000);
      swapParams = {
        deadline: Math.floor(Date.now() / 1000) + parseInt(deadline),
        recipient: recipient,
        slippageTolerance: slippageTolerancePercent,
      };
    }

    const token0Balance = CurrencyAmount.fromRawAmount(
      token0,
      JSBI.BigInt(token0BalanceRaw)
    );
    const token1Balance = CurrencyAmount.fromRawAmount(
      token1,
      JSBI.BigInt(token1BalanceRaw)
    );
    const poolAccessor = await poolProvider.getPools([[
      token0.wrapped,
      token1.wrapped,
      feeAmount,
    ]])
    const pool = poolAccessor.getPool(
      token0.wrapped,
      token1.wrapped,
      feeAmount
    )
    if (!pool) {
      log.error(
        `Could not find pool.`
      );
      return { statusCode: 400, errorCode: 'POOL_NOT_FOUND' };
    }
    const position = new Position({
      pool,
      tickLower,
      tickUpper,
      liquidity: 1,
    });
    const errorToleranceFraction = new Fraction(Math.round(parseFloat(errorTolerance.toString()) * 100), 10_000)

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
        errorTolerance: errorToleranceFraction.toFixed(4),
        routingConfig: routingConfig,
      },
      `Swap To Ratio Parameters`
    );

    const swapRoute = await router.routeToRatio(
      token0Balance,
      token1Balance,
      position,
      {
        errorTolerance: errorToleranceFraction,
        maxIterations
      },
      swapParams,
      routingConfig,
    );

    if (!swapRoute) {
      log.info(
        {
          token0: token0.symbol,
          token1: token1.symbol,
          token0Balance: token0Balance.quotient.toString(),
          token1Balance: token1Balance.quotient.toString(),
        },
        `No route found. 404`
      );

      return {
        statusCode: 404,
        errorCode: 'NO_ROUTE',
        detail: 'No route found',
      };
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
    } = swapRoute;

    const routeResponse: Array<PoolInRoute[]> = [];

    for (const subRoute of route) {
      const {
        route: { tokenPath, pools },
        amount,
        quote,
      } = subRoute;

      const curRoute: PoolInRoute[] = [];
      for (let i = 0; i < pools.length; i++) {
        const nextPool = pools[i];
        const tokenIn = tokenPath[i];
        const tokenOut = tokenPath[i + 1];

        let edgeAmountIn = undefined;
        if (i == 0) {
          edgeAmountIn =
            type == 'exactIn'
              ? amount.quotient.toString()
              : quote.quotient.toString();
        }

        let edgeAmountOut = undefined;
        if (i == pools.length - 1) {
          edgeAmountOut =
            type == 'exactIn'
              ? quote.quotient.toString()
              : amount.quotient.toString();
        }

        curRoute.push({
          type: 'v3-pool',
          address: poolProvider.getPoolAddress(
            nextPool.token0,
            nextPool.token1,
            nextPool.fee
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
          fee: nextPool.fee.toString(),
          liquidity: nextPool.liquidity.toString(),
          sqrtRatioX96: nextPool.sqrtRatioX96.toString(),
          tickCurrent: nextPool.tickCurrent.toString(),
          amountIn: edgeAmountIn,
          amountOut: edgeAmountOut,
        });
      }

      routeResponse.push(curRoute);
    }

    const tokenIn = trade.inputAmount.currency.wrapped
    const tokenOut = trade.outputAmount.currency.wrapped

    const zeroForOne = tokenIn == token0
    let token0BalanceUpdated: CurrencyAmount<Currency>;
    let token1BalanceUpdated: CurrencyAmount<Currency>;
    let optimalRatioAdjusted: Fraction;
    let optimalRatioDecimal: string;
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
      optimalRatioDecimal = optimalRatioAdjusted.denominator.toString() == '0'
        ? `0.${'0'.repeat(token1.wrapped.decimals)}`
        : optimalRatioAdjusted.toFixed(token0.wrapped.decimals)
      newRatioDecimal = token1BalanceUpdated.numerator.toString() == '0'
        ? `0.${'0'.repeat(token1.wrapped.decimals)}`
        : new Fraction(
          token0BalanceUpdated.quotient.toString(),
          token1BalanceUpdated.quotient.toString()
        ).toFixed(token0.wrapped.decimals)
    }

    const postSwapTargetPoolObject = {
      address: poolProvider.getPoolAddress(
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
    };

    return {
      statusCode: 200,
      body: result,
    };
  }

  protected requestBodySchema(): Joi.ObjectSchema | null {
    return null;
  }

  protected requestQueryParamsSchema(): Joi.ObjectSchema | null {
    return QuoteToRatioQueryParamsJoi;
  }

  protected responseBodySchema(): Joi.ObjectSchema | null {
    return QuotetoRatioResponseSchemaJoi;
  }
}
