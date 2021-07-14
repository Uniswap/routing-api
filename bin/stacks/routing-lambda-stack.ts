import * as asg from '@aws-cdk/aws-applicationautoscaling';
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
  nodeRPCUsername: string;
  nodeRPCPassword: string;
  tokenListCacheBucket: aws_s3.Bucket;
  provisionedConcurrency: number;
}
export class RoutingLambdaStack extends cdk.NestedStack {
  public readonly routingLambda: aws_lambda_nodejs.NodejsFunction;
  public readonly routingLambdaAlias: aws_lambda.Alias;

  constructor(
    scope: cdk.Construct,
    name: string,
    props: RoutingLambdaStackProps
  ) {
    super(scope, name, props);
    const {
      poolCacheBucket,
      poolCacheKey,
      nodeRPC,
      nodeRPCUsername,
      nodeRPCPassword,
      tokenListCacheBucket,
      provisionedConcurrency,
    } = props;

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
    tokenListCacheBucket.grantRead(lambdaRole);

    const region = cdk.Stack.of(this).region;

    this.routingLambda = new aws_lambda_nodejs.NodejsFunction(
      this,
      'RoutingLambda2',
      {
        role: lambdaRole,
        runtime: aws_lambda.Runtime.NODEJS_14_X,
        entry: path.join(__dirname, '../../lib/handlers/index.ts'),
        handler: 'quoteHandler',
        timeout: cdk.Duration.seconds(15),
        memorySize: 1024,
        bundling: {
          minify: true,
          sourceMap: true,
        },
        environment: {
          NODE_OPTIONS: '--enable-source-maps',
          POOL_CACHE_BUCKET: poolCacheBucket.bucketName,
          POOL_CACHE_KEY: poolCacheKey,
          JSON_RPC_URL: nodeRPC,
          JSON_RPC_USERNAME: nodeRPCUsername,
          JSON_RPC_PASSWORD: nodeRPCPassword,
          TOKEN_LIST_CACHE_BUCKET: tokenListCacheBucket.bucketName,
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

    const enableProvisionedConcurrency = provisionedConcurrency > 0;

    this.routingLambdaAlias = new aws_lambda.Alias(this, 'RoutingLiveAlias', {
      aliasName: 'live',
      version: this.routingLambda.currentVersion,
      provisionedConcurrentExecutions: enableProvisionedConcurrency
        ? provisionedConcurrency
        : undefined,
    });

    if (enableProvisionedConcurrency) {
      const target = new asg.ScalableTarget(this, 'RoutingProvConcASG', {
        serviceNamespace: asg.ServiceNamespace.LAMBDA,
        maxCapacity: provisionedConcurrency * 5,
        minCapacity: provisionedConcurrency,
        resourceId: `function:${this.routingLambdaAlias.lambda.functionName}:${this.routingLambdaAlias.aliasName}`,
        scalableDimension: 'lambda:function:ProvisionedConcurrency',
      });

      target.node.addDependency(this.routingLambdaAlias);

      target.scaleToTrackMetric('RoutingProvConcTracking', {
        targetValue: 0.8,
        predefinedMetric:
          asg.PredefinedMetric.LAMBDA_PROVISIONED_CONCURRENCY_UTILIZATION,
      });
    }
  }
}
