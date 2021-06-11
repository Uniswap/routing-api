import middy from '@middy/core';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { HttpError, InternalServerError } from 'http-json-errors';

export const formatJSONResponse = (
  response: Record<string, unknown>,
  statusCode = 200
): APIGatewayProxyResult => {
  return {
    statusCode,
    body: JSON.stringify(response),
  };
};

export const apiGatewayResponseMiddleware = (): middy.MiddlewareObj => {
  const after: middy.MiddlewareFn<any, any> = async (
    request: middy.Request
  ) => {
    console.log({ request }, 'In response1');
    console.log({ resp: request.response }, 'In response2');

    if (
      !request.event?.httpMethod ||
      request.response === undefined ||
      request.response === null
    ) {
      request.response = { statusCode: 200, body: '' };
      return;
    }

    request.response = {
      statusCode: 200,
      body: JSON.stringify(request.response),
    };
  };

  const onError: middy.MiddlewareFn<
    APIGatewayProxyEvent,
    APIGatewayProxyResult
  > = async (request: middy.Request) => {
    console.log({ request }, 'In error');
    const { error } = request;

    if (error instanceof HttpError) {
      request.response = error;
    } else {
      request.response = new InternalServerError();
    }
  };

  return {
    after,
    onError,
  };
};
