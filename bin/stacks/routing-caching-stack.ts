import { Protocol } from '@uniswap/router-sdk'
import * as cdk from 'aws-cdk-lib'
import { Duration } from 'aws-cdk-lib'
import * as aws_cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import { MathExpression } from 'aws-cdk-lib/aws-cloudwatch'
import * as aws_cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions'
import * as aws_events from 'aws-cdk-lib/aws-events'
import * as aws_events_targets from 'aws-cdk-lib/aws-events-targets'
import * as aws_iam from 'aws-cdk-lib/aws-iam'
import { PolicyStatement } from 'aws-cdk-lib/aws-iam'
import * as aws_lambda from 'aws-cdk-lib/aws-lambda'
import * as aws_lambda_nodejs from 'aws-cdk-lib/aws-lambda-nodejs'
import * as aws_s3 from 'aws-cdk-lib/aws-s3'
import * as aws_sns from 'aws-cdk-lib/aws-sns'
import { Construct } from 'constructs'
import * as path from 'path'
import { chainProtocols } from '../../lib/cron/cache-config'
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
  public readonly ipfsPoolCachingLambda: aws_lambda_nodejs.NodejsFunction
  public readonly ipfsCleanPoolCachingLambda: aws_lambda_nodejs.NodejsFunction
  public readonly poolCacheLambdaNameArray: string[] = []

  constructor(scope: Construct, name: string, props: RoutingCachingStackProps) {
    super(scope, name, props)

    const { chatbotSNSArn } = props

    const chatBotTopic = chatbotSNSArn ? aws_sns.Topic.fromTopicArn(this, 'ChatbotTopic', chatbotSNSArn) : undefined

    // TODO: Remove and swap to the new bucket below. Kept around for the rollout, but all requests will go to bucket 2.
    this.poolCacheBucket = new aws_s3.Bucket(this, 'PoolCacheBucket')
    this.poolCacheBucket2 = new aws_s3.Bucket(this, 'PoolCacheBucket2')

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

    const lambdaLayerVersion = aws_lambda.LayerVersion.fromLayerVersionArn(
      this,
      'InsightsLayerPools',
      `arn:aws:lambda:${region}:580247275435:layer:LambdaInsightsExtension:14`
    )

    // Spin up a new pool cache lambda for each config in chain X protocol
    for (let i = 0; i < chainProtocols.length; i++) {
      const { protocol, chainId, timeout } = chainProtocols[i]
      const lambda = new aws_lambda_nodejs.NodejsFunction(
        this,
        `PoolCacheLambda-ChainId${chainId}-Protocol${protocol}`,
        {
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
          description: `Pool Cache Lambda for Chain with ChainId ${chainId} and Protocol ${protocol}`,
          layers: [lambdaLayerVersion],
          tracing: aws_lambda.Tracing.ACTIVE,
          environment: {
            POOL_CACHE_BUCKET: this.poolCacheBucket.bucketName,
            POOL_CACHE_BUCKET_2: this.poolCacheBucket2.bucketName,
            POOL_CACHE_KEY: this.poolCacheKey,
            chainId: chainId.toString(),
            protocol,
            timeout: timeout.toString(),
          },
        }
      )
      new aws_events.Rule(this, `SchedulePoolCache-ChainId${chainId}-Protocol${protocol}`, {
        schedule: aws_events.Schedule.rate(Duration.minutes(15)),
        targets: [new aws_events_targets.LambdaFunction(lambda)],
      })
      this.poolCacheBucket2.grantReadWrite(lambda)
      const lambdaAlarmErrorRate = new aws_cloudwatch.Alarm(
        this,
        `RoutingAPI-SEV4-PoolCacheToS3LambdaErrorRate-ChainId${chainId}-Protocol${protocol}`,
        {
          metric: new MathExpression({
            expression: '(invocations - errors) < 1',
            usingMetrics: {
              invocations: lambda.metricInvocations({
                period: Duration.minutes(60),
                statistic: 'sum',
              }),
              errors: lambda.metricErrors({
                period: Duration.minutes(60),
                statistic: 'sum',
              }),
            },
          }),
          threshold: protocol === Protocol.V3 ? 50 : 85,
          evaluationPeriods: protocol === Protocol.V3 ? 12 : 144,
        }
      )
      const lambdaThrottlesErrorRate = new aws_cloudwatch.Alarm(
        this,
        `RoutingAPI-PoolCacheToS3LambdaThrottles-ChainId${chainId}-Protocol${protocol}`,
        {
          metric: lambda.metricThrottles({
            period: Duration.minutes(5),
            statistic: 'sum',
          }),
          threshold: 5,
          evaluationPeriods: 1,
        }
      )
      if (chatBotTopic) {
        lambdaAlarmErrorRate.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))
        lambdaThrottlesErrorRate.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))
      }
      this.poolCacheLambdaNameArray.push(lambda.functionName)
    }

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
        description: 'IPFS Pool Cache Lambda',
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

      this.ipfsCleanPoolCachingLambda = new aws_lambda_nodejs.NodejsFunction(this, 'CleanIpfsPoolCacheLambda', {
        role: lambdaRole,
        runtime: aws_lambda.Runtime.NODEJS_14_X,
        entry: path.join(__dirname, '../../lib/cron/clean-pools-ipfs.ts'),
        handler: 'handler',
        timeout: Duration.seconds(900),
        memorySize: 512,
        bundling: {
          minify: true,
          sourceMap: true,
        },
        description: 'Clean IPFS Pool Cache Lambda',
        layers: [
          aws_lambda.LayerVersion.fromLayerVersionArn(
            this,
            'InsightsLayerPoolsCleanIPFS',
            `arn:aws:lambda:${region}:580247275435:layer:LambdaInsightsExtension:14`
          ),
        ],
        tracing: aws_lambda.Tracing.ACTIVE,
        environment: {
          PINATA_API_KEY: pinata_key!,
          PINATA_API_SECRET: pinata_secret!,
          STAGE: stage,
          REDEPLOY: '1',
        },
      })

      new aws_events.Rule(this, 'ScheduleCleanIpfsPoolCache', {
        schedule: aws_events.Schedule.rate(Duration.minutes(30)),
        targets: [new aws_events_targets.LambdaFunction(this.ipfsCleanPoolCachingLambda)],
      })
    }

    if (chatBotTopic) {
      if (stage == 'beta' || stage == 'prod') {
        const lambdaIpfsAlarmErrorRate = new aws_cloudwatch.Alarm(this, 'RoutingAPI-PoolCacheToIPFSLambdaError', {
          metric: this.ipfsPoolCachingLambda.metricErrors({
            period: Duration.minutes(60),
            statistic: 'sum',
          }),
          threshold: 13,
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
