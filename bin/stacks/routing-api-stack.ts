import * as cdk from 'aws-cdk-lib';
import { aws_apigateway } from 'aws-cdk-lib';
import { RoutingLambdaStack } from './routing-lambda-stack';

export class RoutingAPIStack extends cdk.Stack {
  constructor(parent: cdk.App, name: string, props?: cdk.StackProps) {
    super(parent, name, props);

    const { routingLambda } = new RoutingLambdaStack(
      this,
      'RoutingLambdaStack'
    );

    const api = new aws_apigateway.RestApi(this, 'routing-api', {
      restApiName: 'Routing API',
    });

    const lambdaIntegration = new aws_apigateway.LambdaIntegration(
      routingLambda
    );

    const quote = api.root.addResource('quote');
    quote.addMethod('POST', lambdaIntegration); // POST /swap
  }
}
