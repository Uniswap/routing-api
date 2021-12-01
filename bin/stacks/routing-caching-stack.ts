import * as aws_cloudwatch from '@aws-cdk/aws-cloudwatch'
import * as aws_cloudwatch_actions from '@aws-cdk/aws-cloudwatch-actions'
import * as aws_events from '@aws-cdk/aws-events'
import * as aws_events_targets from '@aws-cdk/aws-events-targets'
import * as aws_iam from '@aws-cdk/aws-iam'
import { PolicyStatement } from '@aws-cdk/aws-iam'
import * as aws_lambda from '@aws-cdk/aws-lambda'
import * as aws_lambda_nodejs from '@aws-cdk/aws-lambda-nodejs'
import * as aws_s3 from '@aws-cdk/aws-s3'
import * as aws_sns from '@aws-cdk/aws-sns'
import * as cdk from '@aws-cdk/core'
import { Construct, Duration } from '@aws-cdk/core'
import * as path from 'path'
import { STAGE } from '../../lib/util/stage'

export interface RoutingCachingStackProps extends cdk.NestedStackProps {
  stage: string
  route53Arn?: string
  pinata_key?: string
  pinata_secret?: string
  hosted_zone?: string
  chatbotSNSArn?: string
}

export class RoutingCachingStack extends cdk.NestedStack {
  public readonly poolCacheBucket: aws_s3.Bucket
  public readonly poolCacheBucket2: aws_s3.Bucket
  public readonly poolCacheKey: string
  public readonly tokenListCacheBucket: aws_s3.Bucket
  public readonly poolCacheLambda: aws_lambda_nodejs.NodejsFunction
  public readonly ipfsPoolCachingLambda: aws_lambda_nodejs.NodejsFunction

  constructor(scope: Construct, name: string, props: RoutingCachingStackProps) {
    super(scope, name, props)

    const { chatbotSNSArn } = props

    // TODO: Remove and swap to the new bucket below. Kept around for the rollout, but all requests will go to bucket 2.
    this.poolCacheBucket = new aws_s3.Bucket(this, 'PoolCacheBucket')
    this.poolCacheBucket2 = new aws_s3.Bucket(this, 'PoolCacheBucket2')

    this.poolCacheKey = 'poolCache.json'

    const { stage, route53Arn, pinata_key, pinata_secret, hosted_zone } = props

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

    this.poolCacheLambda = new aws_lambda_nodejs.NodejsFunction(this, 'PoolCacheLambda', {
      role: lambdaRole,
      runtime: aws_lambda.Runtime.NODEJS_14_X,
      entry: path.join(__dirname, '../../lib/cron/cache-pools.ts'),
      handler: 'handler',
      timeout: Duration.seconds(900),
      memorySize: 1024,
      bundling: {
        minify: true,
        sourceMap: true,
      },
      layers: [
        aws_lambda.LayerVersion.fromLayerVersionArn(
          this,
          'InsightsLayerPools',
          `arn:aws:lambda:${region}:580247275435:layer:LambdaInsightsExtension:14`
        ),
      ],
      tracing: aws_lambda.Tracing.ACTIVE,
      environment: {
        POOL_CACHE_BUCKET: this.poolCacheBucket.bucketName,
        POOL_CACHE_BUCKET_2: this.poolCacheBucket2.bucketName,
        POOL_CACHE_KEY: this.poolCacheKey,
      },
    })

    this.poolCacheBucket.grantReadWrite(this.poolCacheLambda)
    this.poolCacheBucket2.grantReadWrite(this.poolCacheLambda)

    new aws_events.Rule(this, 'SchedulePoolCache', {
      schedule: aws_events.Schedule.rate(Duration.minutes(15)),
      targets: [new aws_events_targets.LambdaFunction(this.poolCacheLambda)],
    })

    if (stage == STAGE.BETA || stage == STAGE.PROD) {
      this.ipfsPoolCachingLambda = new aws_lambda_nodejs.NodejsFunction(this, 'IpfsPoolCacheLambda', {
        role: lambdaRole,
        runtime: aws_lambda.Runtime.NODEJS_14_X,
        entry: path.join(__dirname, '../../lib/cron/cache-pools-ipfs.ts'),
        handler: 'handler',
        timeout: Duration.seconds(900),
        memorySize: 1024,
        bundling: {
          minify: true,
          sourceMap: true,
        },
        layers: [
          aws_lambda.LayerVersion.fromLayerVersionArn(
            this,
            'InsightsLayerPoolsIPFS',
            `arn:aws:lambda:${region}:580247275435:layer:LambdaInsightsExtension:14`
          ),
        ],
        tracing: aws_lambda.Tracing.ACTIVE,
        environment: {
          PINATA_API_KEY: pinata_key!,
          PINATA_API_SECRET: pinata_secret!,
          ROLE_ARN: route53Arn!,
          HOSTED_ZONE: hosted_zone!,
          STAGE: stage,
          REDEPLOY: '1',
        },
      })

      new aws_events.Rule(this, 'ScheduleIpfsPoolCache', {
        schedule: aws_events.Schedule.rate(Duration.minutes(15)),
        targets: [new aws_events_targets.LambdaFunction(this.ipfsPoolCachingLambda)],
      })
    }

    const lambdaAlarmErrorRate = new aws_cloudwatch.Alarm(this, 'RoutingAPI-PoolCacheToS3LambdaError', {
      metric: this.poolCacheLambda.metricErrors({
        period: Duration.minutes(60),
        statistic: 'sum',
      }),
      threshold: 5,
      evaluationPeriods: 1,
    })

    const lambdaThrottlesErrorRate = new aws_cloudwatch.Alarm(this, 'RoutingAPI-PoolCacheToS3LambdaThrottles', {
      metric: this.poolCacheLambda.metricThrottles({
        period: Duration.minutes(5),
        statistic: 'sum',
      }),
      threshold: 5,
      evaluationPeriods: 1,
    })

    if (chatbotSNSArn) {
      const chatBotTopic = aws_sns.Topic.fromTopicArn(this, 'ChatbotTopic', chatbotSNSArn)

      lambdaAlarmErrorRate.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))

      lambdaThrottlesErrorRate.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))

      if (stage == 'beta' || stage == 'prod') {
        const lambdaIpfsAlarmErrorRate = new aws_cloudwatch.Alarm(this, 'RoutingAPI-PoolCacheToIPFSLambdaError', {
          metric: this.poolCacheLambda.metricErrors({
            period: Duration.minutes(60),
            statistic: 'sum',
          }),
          threshold: 5,
          evaluationPeriods: 1,
        })

        lambdaIpfsAlarmErrorRate.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))
      }
    }

    this.tokenListCacheBucket = new aws_s3.Bucket(this, 'TokenListCacheBucket')

    const tokenListCachingLambda = new aws_lambda_nodejs.NodejsFunction(this, 'TokenListCacheLambda', {
      role: lambdaRole,
      runtime: aws_lambda.Runtime.NODEJS_14_X,
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
