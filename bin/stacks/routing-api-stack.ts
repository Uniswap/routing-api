import * as cdk from 'aws-cdk-lib';
import { aws_apigateway, aws_logs } from 'aws-cdk-lib';
import { MethodLoggingLevel } from 'aws-cdk-lib/lib/aws-apigateway';
import { RoutingCachingStack } from './routing-caching-stack';
import { RoutingDashboardStack } from './routing-dashboard-stack';
import { RoutingLambdaStack } from './routing-lambda-stack';

export class RoutingAPIStack extends cdk.Stack {
  constructor(parent: cdk.App, name: string, props?: cdk.StackProps) {
    super(parent, name, props);

    const { poolCacheBucket, poolCacheKey } = new RoutingCachingStack(
      this,
      'RoutingCachingStack'
    );

    const { routingLambda } = new RoutingLambdaStack(
      this,
      'RoutingLambdaStack',
      { poolCacheBucket, poolCacheKey }
    );

    const accessLogGroup = new aws_logs.LogGroup(
      this,
      'RoutingAPIGAccessLogs'
    );

    const api = new aws_apigateway.RestApi(this, 'routing-api', {
      restApiName: 'Routing API',
      deployOptions: {
        tracingEnabled: true,
        loggingLevel: MethodLoggingLevel.ERROR,
        accessLogDestination: new aws_apigateway.LogGroupLogDestination(accessLogGroup),
        accessLogFormat: aws_apigateway.AccessLogFormat.jsonWithStandardFields()
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
  }
}
