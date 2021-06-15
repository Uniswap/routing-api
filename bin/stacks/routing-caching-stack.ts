import * as cdk from 'aws-cdk-lib';
import {
  aws_s3,
  aws_lambda,
  aws_lambda_nodejs,
  aws_iam,
  aws_events,
  aws_events_targets,
  Duration,
} from 'aws-cdk-lib';
import { Schedule } from 'aws-cdk-lib/lib/aws-events';
import { Construct } from 'constructs';
import * as path from 'path';

export class RoutingCachingStack extends cdk.NestedStack {
  public readonly poolCacheBucket: aws_s3.Bucket;
  public readonly poolCacheKey: string;

  constructor(scope: Construct, name: string, props?: cdk.NestedStackProps) {
    super(scope, name, props);

    this.poolCacheBucket = new aws_s3.Bucket(this, 'PoolCacheBucket');
    this.poolCacheKey = 'poolCache.json';

    const lambdaRole = new aws_iam.Role(this, 'RoutingLambdaRole', {
      assumedBy: new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole'
        ),
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchFullAccess'),
      ],
    });

    const poolCachingLambda = new aws_lambda_nodejs.NodejsFunction(
      this,
      'PoolCacheLambda',
      {
        role: lambdaRole,
        runtime: aws_lambda.Runtime.NODEJS_14_X,
        entry: path.join(__dirname, '../../lib/cron/cache-pools.ts'),
        handler: 'handler',
        timeout: Duration.seconds(15),
        memorySize: 1024,
        bundling: {
          minify: true,
          sourceMap: true,
        },
        layers: [
          aws_lambda.LayerVersion.fromLayerVersionArn(
            this,
            'InsightsLayer',
            'arn:aws:lambda:us-east-1:580247275435:layer:LambdaInsightsExtension:14'
          ),
        ],
        tracing: aws_lambda.Tracing.ACTIVE,
        environment: {
          POOL_CACHE_BUCKET: this.poolCacheBucket.bucketName,
          POOL_CACHE_KEY: this.poolCacheKey,
        },
      }
    );

    this.poolCacheBucket.grantReadWrite(poolCachingLambda);

    new aws_events.Rule(this, 'SchedulePoolCache', {
      schedule: Schedule.rate(Duration.minutes(1)),
      targets: [new aws_events_targets.LambdaFunction(poolCachingLambda)],
    });
  }
}
