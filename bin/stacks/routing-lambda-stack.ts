import * as cdk from 'aws-cdk-lib';
import { aws_lambda, aws_lambda_nodejs, aws_iam, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';

export class RoutingLambdaStack extends cdk.NestedStack {
  public readonly routingLambda: aws_lambda_nodejs.NodejsFunction;

  constructor(scope: Construct, name: string, props?: cdk.NestedStackProps) {
    super(scope, name, props);

    const lambdaRole = new aws_iam.Role(this, 'RoutingLambdaRole', {
      assumedBy: new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole'
        ),
      ],
    });

    this.routingLambda = new aws_lambda_nodejs.NodejsFunction(
      this,
      'RoutingLambda',
      {
        role: lambdaRole,
        runtime: aws_lambda.Runtime.NODEJS_14_X,
        entry: path.join(__dirname, '../../lib/handlers/index.ts'),
        handler: 'handler',
        timeout: Duration.seconds(15),
        memorySize: 2048,
        bundling: {
          sourceMap: true,
        },
        environment: {
          NODE_OPTIONS: '--enable-source-maps',
        },
      }
    );
  }
}
