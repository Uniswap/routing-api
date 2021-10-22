import Joi from '@hapi/joi';
import { CurrencyAmount, Fraction, Percent } from '@uniswap/sdk-core';
import { Pool, Position } from '@uniswap/v3-sdk';
import {
  MetricLoggerUnit,
  routeAmountsToString,
  SwapConfig,
} from '@uniswap/smart-order-router';
import JSBI from 'jsbi';
import {
  APIGLambdaHandler,
  ErrorResponse,
  HandleRequestParams,
  Response,
} from '../handler';
import { PoolInRoute, QuoteResponseSchemaJoi } from '../schema';
import { DEFAULT_ROUTING_CONFIG, tokenStringToCurrency } from '../shared';
import { ContainerInjected, RequestInjected } from './injector';
import {
  QuoteToRatioQueryParams,
  QuoteToRatioQueryParamsJoi,
  QuoteToRatioResponse,
  QuotetoRatioResponseSchemaJoi,
} from './schema/quote-to-ratio-schema';

export class QuoteToRatioHandler extends APIGLambdaHandler<
  ContainerInjected,
  RequestInjected,
  void,
  QuoteToRatioQueryParams,
  QuoteToRatioResponse
> {
  public async handleRequest(
    params: HandleRequestParams<
      ContainerInjected,
      RequestInjected,
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
      'TokenInOutStrToToken',
      Date.now() - before,
      MetricLoggerUnit.Milliseconds
    );

    if (!token0) {
      return {
        statusCode: 400,
        errorCode: 'TOKEN_IN_INVALID',
        detail: `Could not find token with address "${token0Address}"`,
      };
    }

    if (!token1) {
      return {
        statusCode: 400,
        errorCode: 'TOKEN_OUT_INVALID',
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
        errorCode: 'TOKEN_IN_OUT_SAME',
        detail: `tokenIn and tokenOut must be different`,
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
      JSBI.BigInt(token0BalanceRaw).toString()
    );
    const token1Balance = CurrencyAmount.fromRawAmount(
      token1,
      JSBI.BigInt(token1BalanceRaw).toString()
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
    ) as unknown as Pool
    if (!pool) {
      log.error(
        `Could not find pool.`
      );
      return {statusCode: 400, errorCode: 'TODO: test error'};
    }
    const position = new Position({
      pool,
      tickLower,
      tickUpper,
      liquidity: 1,
    });
    const errorToleranceFraction = new Fraction(errorTolerance, 100)

    log.info(
      {
        token0: token0.symbol,
        token1: token1.symbol,
        routingConfig: routingConfig,
      },
      `Swap to ratio -  token0: ${token0.symbol}, token0Balance: ${token0Balance}, token1: ${token1.symbol}. token1Balance: ${token1Balance}, Chain: ${chainId}`
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
          token0Balance,
          token1Balance,
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

    const result: QuoteToRatioResponse = {
      methodParameters,
      blockNumber: blockNumber.toString(),
      amount: swapRoute.trade.inputAmount.quotient.toString(),
      amountDecimals: swapRoute.trade.inputAmount.toFixed(swapRoute.trade.inputAmount.currency.decimals),
      quote: quote.quotient.toString(),
      tokenIn: swapRoute.trade.inputAmount.currency.wrapped.address,
      tokenOut: swapRoute.trade.outputAmount.currency.wrapped.address,
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
