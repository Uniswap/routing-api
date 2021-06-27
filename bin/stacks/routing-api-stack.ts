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
    }
  ) {
    super(parent, name, props);

    const { poolCacheBucket, poolCacheKey } = new RoutingCachingStack(
      this,
      'RoutingCachingStack'
    );

    const { nodeRPC, nodeRPCUsername, nodeRPCPassword } = props;

    const { routingLambda } = new RoutingLambdaStack(
      this,
      'RoutingLambdaStack',
      {
        poolCacheBucket,
        poolCacheKey,
        nodeRPC,
        nodeRPCUsername,
        nodeRPCPassword,
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
    });

    const lambdaIntegration = new aws_apigateway.LambdaIntegration(
      routingLambda
    );

    const quote = api.root.addResource('quote');
    quote.addMethod('POST', lambdaIntegration); // POST /swap

    this.url = new CfnOutput(this, 'Url', {
      value: api.url,
    });
  }
}
