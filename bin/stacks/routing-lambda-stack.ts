import * as cdk from 'aws-cdk-lib';
import {
  aws_iam,
  aws_lambda,
  aws_lambda_nodejs,
  aws_s3,
  Duration,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';

export interface RoutingLambdaStackProps extends cdk.NestedStackProps {
  poolCacheBucket: aws_s3.Bucket;
  poolCacheKey: string;
}
export class RoutingLambdaStack extends cdk.NestedStack {
  public readonly routingLambda: aws_lambda_nodejs.NodejsFunction;

  constructor(scope: Construct, name: string, props: RoutingLambdaStackProps) {
    super(scope, name, props);
    const { poolCacheBucket, poolCacheKey } = props;

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
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
      ],
    });

    this.routingLambda = new aws_lambda_nodejs.NodejsFunction(
      this,
      'RoutingLambda',
      {
        role: lambdaRole,
        runtime: aws_lambda.Runtime.NODEJS_14_X,
        entry: path.join(__dirname, '../../lib/handlers/index.ts'),
        handler: 'quoteHandler',
        timeout: Duration.seconds(15),
        memorySize: 2048,
        bundling: {
          minify: true,
          sourceMap: true,
        },
        environment: {
          NODE_OPTIONS: '--enable-source-maps',
          POOL_CACHE_BUCKET: poolCacheBucket.bucketName,
          POOL_CACHE_KEY: poolCacheKey,
          INFURA_KEY: process.env.INFURA_KEY ? process.env.INFURA_KEY : '',
        },
        layers: [
          aws_lambda.LayerVersion.fromLayerVersionArn(
            this,
            'InsightsLayer',
            'arn:aws:lambda:us-east-1:580247275435:layer:LambdaInsightsExtension:14'
          ),
        ],
        tracing: aws_lambda.Tracing.ACTIVE,
      }
    );
  }
}
