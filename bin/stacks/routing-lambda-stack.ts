import * as aws_iam from '@aws-cdk/aws-iam';
import * as aws_lambda from '@aws-cdk/aws-lambda';
import * as aws_lambda_nodejs from '@aws-cdk/aws-lambda-nodejs';
import * as aws_s3 from '@aws-cdk/aws-s3';
import * as cdk from '@aws-cdk/core';
import * as path from 'path';

export interface RoutingLambdaStackProps extends cdk.NestedStackProps {
  poolCacheBucket: aws_s3.Bucket;
  poolCacheKey: string;
  nodeRPC: string;
}
export class RoutingLambdaStack extends cdk.NestedStack {
  public readonly routingLambda: aws_lambda_nodejs.NodejsFunction;
  // public readonly routingLambdaAlias: aws_lambda.Alias;

  constructor(
    scope: cdk.Construct,
    name: string,
    props: RoutingLambdaStackProps
  ) {
    super(scope, name, props);
    const { poolCacheBucket, poolCacheKey, nodeRPC } = props;

    const lambdaRole = new aws_iam.Role(this, 'RoutingLambdaRole', {
      assumedBy: new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole'
        ),
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName(
          'CloudWatchLambdaInsightsExecutionRolePolicy'
        ),
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName(
          'AWSXRayDaemonWriteAccess'
        ),
      ],
    });
    poolCacheBucket.grantRead(lambdaRole);

    const region = cdk.Stack.of(this).region;

    this.routingLambda = new aws_lambda_nodejs.NodejsFunction(
      this,
      'RoutingLambda',
      {
        role: lambdaRole,
        runtime: aws_lambda.Runtime.NODEJS_14_X,
        entry: path.join(__dirname, '../../lib/handlers/index.ts'),
        handler: 'quoteHandler',
        timeout: cdk.Duration.seconds(15),
        memorySize: 2048,
        bundling: {
          minify: true,
          sourceMap: true,
        },
        environment: {
          NODE_OPTIONS: '--enable-source-maps',
          POOL_CACHE_BUCKET: poolCacheBucket.bucketName,
          POOL_CACHE_KEY: poolCacheKey,
          JSON_RPC_URL: nodeRPC,
        },
        layers: [
          aws_lambda.LayerVersion.fromLayerVersionArn(
            this,
            'InsightsLayer',
            `arn:aws:lambda:${region}:580247275435:layer:LambdaInsightsExtension:14`
          ),
        ],
        tracing: aws_lambda.Tracing.ACTIVE,
      }
    );

    // this.routingLambdaAlias = new aws_lambda.Alias(this, 'LiveAlias', {
    //   aliasName: 'live',
    //   version: this.routingLambda.currentVersion,
    //   provisionedConcurrentExecutions: 20,
    // });
  }
}
