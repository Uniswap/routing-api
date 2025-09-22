import type { APIGatewayProxyEvent, Context, APIGatewayProxyResult } from 'aws-lambda'
import { randomUUID } from 'crypto'

export function lambdaToExpress(
  handler: (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>
) {
  return async (queryParams: any, headers: any): Promise<APIGatewayProxyResult> => {
    try {
      // Minimal event object with only the fields actually used by handlers
      const event: APIGatewayProxyEvent = {
        body: null,
        queryStringParameters: queryParams,
        headers: headers as any,
        // Unused by handlers but required by type
        httpMethod: 'POST',
        path: '/quote',
        resource: '/quote',
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        isBase64Encoded: false,
      }

      const context: Context = {
        awsRequestId: headers['x-request-id']?.toString() || randomUUID(),
        callbackWaitsForEmptyEventLoop: false,
        functionName: 'routing-api-local',
        functionVersion: '1',
        invokedFunctionArn: 'arn:aws:lambda:local:0:function:routing-api',
        memoryLimitInMB: '512',
        logGroupName: '/aws/lambda/routing-api-local',
        logStreamName: 'local',
        getRemainingTimeInMillis: () => 30000,
        done: () => undefined,
        fail: () => undefined,
        succeed: () => undefined,
      }

      const result = await handler(event, context)
      return result
    } catch (err: any) {
      return {
        statusCode: 502,
        body: JSON.stringify({ message: 'Internal server error', error: err?.message }),
        headers: {
          'Content-Type': 'application/json'
        }
      }
    }
  }
}
