import {
  ID_TO_CHAIN_ID,
  parseAmount,
  SwapRoutes,
} from '@uniswap/smart-order-router';
import { Token } from '@uniswap/sdk-core';

import middy from '@middy/core';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import jsonBodyParser from '@middy/http-json-body-parser';
import urlEncodePathParser from '@middy/http-urlencode-path-parser';
import Joi from '@hapi/joi';
import { validateJoi } from './middleware/validate';
import { apiGatewayResponseMiddleware } from './middleware/response';
import { Body, Injected } from './middleware/inject';
import { UnprocessableEntity } from 'http-json-errors';

const bodySchemaJoi = Joi.object({
  tokenIn: Joi.string().alphanum().required(),
  tokenOut: Joi.string().alphanum().required(),
  amount: Joi.string().required(),
  chainId: Joi.string().required(),
});

export type ValidatedAPIGatewayProxyEvent<TInjected, TBody, TQuery> = Omit<
  APIGatewayProxyEvent,
  'body' | 'queryStringParameters'
> & {
  body: TBody;
  queryStringParameters: TQuery;
  injected: TInjected;
};

export type APIGatewayResult<TResponse> = Omit<
  APIGatewayProxyResult,
  'body'
> & {
  body: TResponse;
};

const baseHandler = async (
  event: ValidatedAPIGatewayProxyEvent<Injected, Body, void>
): Promise<any> => {
  console.log({ event }, 'TEST');

  const {
    body: { tokenIn: tokenInStr, chainId: chainIdNum },
    injected: { tokenProvider, router },
  } = event;

  const chainId = ID_TO_CHAIN_ID(chainIdNum);
  const tokenIn: Token = tokenProvider.getToken(chainId, tokenInStr);
  const tokenOut: Token = tokenProvider.getToken(chainId, 'DAI');
  const amountIn = parseAmount('100', tokenIn);

  const swapRoutes: SwapRoutes | null = await router.routeExactIn(
    tokenIn,
    tokenOut,
    amountIn
  );

  return swapRoutes;
};

const handler = middy(baseHandler)
  .use({
    before: async (request: any) => {
      const { headers, body } = request.event;

      const contentTypeHeader =
        headers?.['Content-Type'] ?? headers?.['content-type'];

      const mimePattern = /^application\/(.+\+)?json(;.*)?$/;
      if (mimePattern.test(contentTypeHeader)) {
        try {
          const data = request.event.isBase64Encoded
            ? Buffer.from(body, 'base64').toString()
            : body;
          request.event.body = JSON.parse(data);
        } catch (err) {
          throw new UnprocessableEntity();
        }
      }
    },
  })
  .use(urlEncodePathParser())
  .use(validateJoi({ bodySchema: bodySchemaJoi }))
  .use(apiGatewayResponseMiddleware());

module.exports = { handler };
