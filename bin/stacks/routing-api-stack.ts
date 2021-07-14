import * as aws_apigateway from '@aws-cdk/aws-apigateway';
import { MethodLoggingLevel } from '@aws-cdk/aws-apigateway';
import * as aws_logs from '@aws-cdk/aws-logs';
import * as cdk from '@aws-cdk/core';
import { CfnOutput } from '@aws-cdk/core';
import { RoutingCachingStack } from './routing-caching-stack';
import { RoutingDashboardStack } from './routing-dashboard-stack';
import { RoutingLambdaStack } from './routing-lambda-stack';

export class RoutingAPIStack extends cdk.Stack {
  public readonly url: CfnOutput;

  constructor(
    parent: cdk.Construct,
    name: string,
    props: cdk.StackProps & {
      nodeRPC: string;
      nodeRPCUsername: string;
      nodeRPCPassword: string;
      provisionedConcurrency: number;
    }
  ) {
    super(parent, name, props);

    const { poolCacheBucket, poolCacheKey, tokenListCacheBucket } =
      new RoutingCachingStack(this, 'RoutingCachingStack');

    const {
      nodeRPC,
      nodeRPCUsername,
      nodeRPCPassword,
      provisionedConcurrency,
    } = props;

    const { routingLambda, routingLambdaAlias } = new RoutingLambdaStack(
      this,
      'RoutingLambdaStack',
      {
        poolCacheBucket,
        poolCacheKey,
        nodeRPC,
        nodeRPCUsername,
        nodeRPCPassword,
        tokenListCacheBucket,
        provisionedConcurrency,
      }
    );

    const accessLogGroup = new aws_logs.LogGroup(this, 'RoutingAPIGAccessLogs');

    const api = new aws_apigateway.RestApi(this, 'routing-api', {
      restApiName: 'Routing API',
      deployOptions: {
        tracingEnabled: true,
        loggingLevel: MethodLoggingLevel.ERROR,
        accessLogDestination: new aws_apigateway.LogGroupLogDestination(
          accessLogGroup
        ),
        accessLogFormat:
          aws_apigateway.AccessLogFormat.jsonWithStandardFields(),
      },
    });

    new RoutingDashboardStack(this, 'RoutingDashboardStack', {
      apiName: api.restApiName,
      lambdaName: routingLambda.functionName,
    });

    const lambdaIntegration = new aws_apigateway.LambdaIntegration(
      routingLambdaAlias
    );

    const quote = api.root.addResource('quote');
    quote.addMethod('POST', lambdaIntegration);

    this.url = new CfnOutput(this, 'Url', {
      value: api.url,
    });
  }
}
