import Joi from '@hapi/joi';
import { Currency, CurrencyAmount, Ether, Percent } from '@uniswap/sdk-core';
import { SwapRoute } from '@uniswap/smart-order-router';
import { Pool } from '@uniswap/v3-sdk';
import { parseUnits } from 'ethers/lib/utils';
import JSBI from 'jsbi';
import {
  APIGLambdaHandler,
  ErrorResponse,
  HandleRequestParams,
  Response,
} from '../handler';
import { ContainerInjected, RequestInjected } from './injector';
import {
  QuoteBody,
  QuoteBodySchemaJoi,
  QuoteResponse,
  TokenInRoute,
} from './schema/quote';

const ROUTING_CONFIG = {
  topN: 4,
  topNTokenInOut: 3,
  topNSecondHop: 2,
  maxSwapsPerPath: 3,
  maxSplits: 3,
  distributionPercent: 5,
  multicallChunkSize: 50,
};

export class QuoteHandler extends APIGLambdaHandler<
  ContainerInjected,
  RequestInjected,
  QuoteBody,
  QuoteResponse
> {
  public async handleRequest(
    params: HandleRequestParams<ContainerInjected, RequestInjected, QuoteBody>
  ): Promise<Response<QuoteResponse> | ErrorResponse> {
    const {
      request: {
        chainId,
        tokenIn: tokenInRaw,
        tokenOut: tokenOutRaw,
        amount: amountRaw,
        type,
        recipient,
        slippageTolerance,
        deadline,
        inputTokenPermit,
      },
      requestInjected: { router, log, quoteId },
      containerInjected: { tokenProvider },
    } = params;

    // Parse user provided token string to Currency object.
    let currencyIn: Currency;
    let currencyOut: Currency;

    if (tokenInRaw == 'ETH') {
      currencyIn = Ether.onChain(chainId);
    } else {
      currencyIn = tokenProvider.getToken(chainId, tokenInRaw);
    }

    if (tokenOutRaw == 'ETH') {
      currencyOut = Ether.onChain(chainId);
    } else {
      currencyOut = tokenProvider.getToken(chainId, tokenOutRaw);
    }

    // e.g. Inputs of form "1.25%" with 2dp max. Convert to fractional representation => 1.25 => 125 / 10000
    const slippagePer10k = Math.round(parseFloat(slippageTolerance) * 100);
    const slippageTolerancePercent = new Percent(slippagePer10k, 10_000);
    const swapParams = {
      deadline: Math.floor(Date.now() / 1000) + parseInt(deadline),
      recipient: recipient,
      slippageTolerance: slippageTolerancePercent,
      inputTokenPermit,
    };

    let swapRoute: SwapRoute | null;
    switch (type) {
      case 'exactIn':
        const parsedAmountExactIn = parseUnits(amountRaw, currencyIn.decimals);
        const amountIn = CurrencyAmount.fromRawAmount(
          currencyIn,
          JSBI.BigInt(parsedAmountExactIn)
        );

        log.info(
          {
            amountIn: amountIn.toExact(),
            currency: amountIn.currency.symbol,
            routingConfig: ROUTING_CONFIG,
          },
          `Exact In Swap: Give ${amountIn.toExact()} ${
            amountIn.currency.symbol
          }, Want: ${currencyOut.symbol}`
        );

        swapRoute = await router.routeExactIn(
          currencyIn,
          currencyOut,
          amountIn,
          swapParams,
          ROUTING_CONFIG
        );
        break;
      case 'exactOut':
        const parsedAmountExactOut = parseUnits(
          amountRaw,
          currencyOut.decimals
        );
        const amountOut = CurrencyAmount.fromRawAmount(
          currencyOut,
          JSBI.BigInt(parsedAmountExactOut)
        );

        log.info(
          {
            amountIn: amountOut.toExact(),
            currency: amountOut.currency.symbol,
            routingConfig: ROUTING_CONFIG,
          },
          `Exact Out Swap: Want ${amountOut.toExact()} ${
            amountOut.currency.symbol
          } Give: ${currencyIn.symbol}`
        );

        swapRoute = await router.routeExactOut(
          currencyIn,
          currencyOut,
          amountOut,
          swapParams,
          ROUTING_CONFIG
        );
        break;
      default:
        throw new Error('');
    }

    if (!swapRoute) {
      return {
        statusCode: 404,
        errorCode: 'NO_ROUTE',
        detail: 'No route found.',
      };
    }

    const {
      quote,
      quoteGasAdjusted,
      routeAmounts,
      estimatedGasUsed,
      gasPriceWei,
      methodParameters,
      blockNumber,
    } = swapRoute;

    const firstTokenInRoute: TokenInRoute = {
      type: 'token',
      address: currencyIn.wrapped.address,
      symbol: currencyIn.wrapped.symbol!,
    };

    for (const routeAmount of routeAmounts) {
      const {
        route: { tokenPath, pools },
        percentage,
      } = routeAmount;

      let curTokenInRoute = firstTokenInRoute;
      for (let i = 0; i < pools.length; i++) {
        if (!curTokenInRoute.nextPools) {
          curTokenInRoute.nextPools = {};
        }

        const nextPool = pools[i];
        const nextToken = tokenPath[i + 1];

        const nextTokenInRoute: TokenInRoute = {
          type: 'token',
          address: nextToken.address,
          symbol: nextToken.symbol!,
        };

        curTokenInRoute.nextPools[i == 0 ? percentage : '100'] = {
          address: Pool.getAddress(
            nextPool.token0,
            nextPool.token1,
            nextPool.fee
          ),
          type: 'pool',
          fee: nextPool.fee.toString(),
          token0Address: nextPool.token0.address,
          token1Address: nextPool.token1.address,
          token0Symbol: nextPool.token0.symbol!,
          token1Symbol: nextPool.token1.symbol!,
          nextToken: nextTokenInRoute,
        };

        curTokenInRoute = nextTokenInRoute;
      }
    }

    const result: QuoteResponse = {
      methodParameters,
      blockNumber: blockNumber.toString(),
      gasUseEstimate: estimatedGasUsed.toString(),
      gasPriceWei: gasPriceWei.toString(),
      route: firstTokenInRoute,
      quoteGasAdjusted: quoteGasAdjusted.toExact(),
      quote: quote.toExact(),
      quoteId,
    };

    log.info({ result }, 'Request ended.');
    return { statusCode: 200, body: result };
  }

  protected requestBodySchema(): Joi.ObjectSchema | null {
    return QuoteBodySchemaJoi;
  }

  protected responseBodySchema(): Joi.ObjectSchema | null {
    return null;
  }
}
