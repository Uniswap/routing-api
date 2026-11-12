import * as cdk from 'aws-cdk-lib'
import { Duration } from 'aws-cdk-lib'
import * as aws_events from 'aws-cdk-lib/aws-events'
import * as aws_events_targets from 'aws-cdk-lib/aws-events-targets'
import * as aws_iam from 'aws-cdk-lib/aws-iam'
import { PolicyStatement } from 'aws-cdk-lib/aws-iam'
import * as aws_lambda from 'aws-cdk-lib/aws-lambda'
import * as aws_lambda_nodejs from 'aws-cdk-lib/aws-lambda-nodejs'
import * as aws_s3 from 'aws-cdk-lib/aws-s3'
import { Construct } from 'constructs'
import * as path from 'path'
import { STAGE } from '../../lib/util/stage'
import { PoolCachingFilePrefixes } from '../../lib/util/poolCachingFilePrefixes'

export interface RoutingCachingStackProps extends cdk.NestedStackProps {
  stage: string
  route53Arn?: string
  pinata_key?: string
  pinata_secret?: string
  hosted_zone?: string
}

export class RoutingCachingStack extends cdk.NestedStack {
  public readonly poolCacheBucket: aws_s3.Bucket
  public readonly poolCacheBucket2: aws_s3.Bucket
  public readonly poolCacheBucket3: aws_s3.Bucket
  public readonly poolCacheKey: string
  public readonly poolCacheGzipKey: string
  public readonly tokenListCacheBucket: aws_s3.Bucket

  constructor(scope: Construct, name: string, props: RoutingCachingStackProps) {
    super(scope, name, props)

    // The pool cache buckets are kept: the routing Lambda still reads the last
    // objects written to them (see V{2,3,4}AWSSubgraphProvider). The scheduled
    // Lambdas that refreshed those objects from the subgraphs are gone, so the
    // objects are no longer updated.
    // TODO: Remove and swap to the new bucket below. Kept around for the rollout, but all requests will go to bucket 2.
    this.poolCacheBucket = new aws_s3.Bucket(this, 'PoolCacheBucket')
    this.poolCacheBucket2 = new aws_s3.Bucket(this, 'PoolCacheBucket2')
    this.poolCacheBucket3 = new aws_s3.Bucket(this, 'PoolCacheBucket3')

    this.poolCacheBucket2.addLifecycleRule({
      enabled: true,
      // This isn't the right fix in the long run, but it will prevent the outage that we experienced when the V2 pool
      // data expired (See https://www.notion.so/uniswaplabs/Routing-API-Mainnet-outage-V2-Subgraph-11527aab3bd540888f92b33017bf26b4 for more detail).
      // The better short-term solution is to bake resilience into the V2SubgraphProvider (https://linear.app/uniswap/issue/ROUTE-31/use-v2-v3-fallback-provider-in-routing-api),
      // instrument the pool cache lambda, and take measures to improve its success rate.

      // Note that there is a trade-off here: we may serve stale V2 pools which can result in a suboptimal routing path if the file hasn't been recently updated.
      // This stale data is preferred to no-data until we can implement the above measures.

      // For now, choose an arbitrarily large TTL (in this case, 10 years) to prevent the key from being deleted.
      expiration: cdk.Duration.days(365 * 10),
    })

    this.poolCacheBucket3.addLifecycleRule({
      enabled: true,
      // See the comment above for the reasoning behind this TTL.
      expiration: cdk.Duration.days(365 * 10),
    })

    this.poolCacheKey = PoolCachingFilePrefixes.PlainText
    this.poolCacheGzipKey = PoolCachingFilePrefixes.GzipText

    const { stage, route53Arn } = props

    const lambdaRole = new aws_iam.Role(this, 'RoutingLambdaRole', {
      assumedBy: new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchFullAccess'),
      ],
    })

    if (stage == STAGE.BETA || stage == STAGE.PROD) {
      lambdaRole.addToPolicy(
        new PolicyStatement({
          resources: [route53Arn!],
          actions: ['sts:AssumeRole'],
          sid: '1',
        })
      )
    }

    const region = cdk.Stack.of(this).region

    this.tokenListCacheBucket = new aws_s3.Bucket(this, 'TokenListCacheBucket')

    const tokenListCachingLambda = new aws_lambda_nodejs.NodejsFunction(this, 'TokenListCacheLambda', {
      role: lambdaRole,
      runtime: aws_lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../../lib/cron/cache-token-lists.ts'),
      handler: 'handler',
      timeout: Duration.seconds(180),
      memorySize: 256,
      bundling: {
        minify: true,
        sourceMap: true,
      },
      layers: [
        aws_lambda.LayerVersion.fromLayerVersionArn(
          this,
          'InsightsLayerTokenList',
          `arn:aws:lambda:${region}:580247275435:layer:LambdaInsightsExtension:14`
        ),
      ],
      description: 'Token List Cache Lambda',
      tracing: aws_lambda.Tracing.ACTIVE,
      environment: {
        TOKEN_LIST_CACHE_BUCKET: this.tokenListCacheBucket.bucketName,
      },
    })

    this.tokenListCacheBucket.grantReadWrite(tokenListCachingLambda)

    new aws_events.Rule(this, 'ScheduleTokenListCache', {
      schedule: aws_events.Schedule.rate(Duration.minutes(15)),
      targets: [new aws_events_targets.LambdaFunction(tokenListCachingLambda)],
    })
  }
}
