import Joi from '@hapi/joi';
import { Currency, CurrencyAmount, Ether, Percent } from '@uniswap/sdk-core';
import { routeAmountToString, SwapRoute } from '@uniswap/smart-order-router';
import { parseUnits } from 'ethers/lib/utils';
import JSBI from 'jsbi';
import { APIGLambdaHandler, HandleRequestParams, Response } from '../handler';
import { ContainerInjected, RequestInjected } from './injector';
import { QuoteBody, QuoteBodySchemaJoi, QuoteResponse } from './schema/quote';

export class QuoteHandler extends APIGLambdaHandler<
  ContainerInjected,
  RequestInjected,
  QuoteBody,
  QuoteResponse
> {
  public async handleRequest(
    params: HandleRequestParams<ContainerInjected, RequestInjected, QuoteBody>
  ): Promise<Response<QuoteResponse>> {
    const {
      request: {
        chainId,
        tokenIn: tokenInRaw,
        tokenOut: tokenOutRaw,
        amount: amountRaw,
        config: routingConfig,
        type,
        recipient,
        slippageTolerance,
        deadline,
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
            routingConfig,
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
          routingConfig
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
            routingConfig,
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
          routingConfig
        );
        break;
      default:
        throw new Error('');
    }

    if (!swapRoute) {
      return { statusCode: 404, body: 'No route found' };
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

    const routeStrings = routeAmounts.map((routeAmount) => {
      return routeAmountToString(routeAmount);
    });

    const result = {
      methodParameters,
      blockNumber: blockNumber.toString(),
      estimatedGasUsed: estimatedGasUsed.toString(),
      gasPriceWei: gasPriceWei.toString(),
      routes: routeStrings,
      gasAdjustedQuote: quoteGasAdjusted.toExact(),
      rawQuote: quote.toExact(),
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
