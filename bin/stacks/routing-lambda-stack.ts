import * as asg from '@aws-cdk/aws-applicationautoscaling'
import * as aws_cloudwatch from '@aws-cdk/aws-cloudwatch'
import * as aws_cloudwatch_actions from '@aws-cdk/aws-cloudwatch-actions'
import * as aws_iam from '@aws-cdk/aws-iam'
import * as aws_lambda from '@aws-cdk/aws-lambda'
import * as aws_lambda_nodejs from '@aws-cdk/aws-lambda-nodejs'
import * as aws_s3 from '@aws-cdk/aws-s3'
import * as aws_sns from '@aws-cdk/aws-sns'
import * as cdk from '@aws-cdk/core'
import { Duration } from '@aws-cdk/core'
import * as path from 'path'

export interface RoutingLambdaStackProps extends cdk.NestedStackProps {
  poolCacheBucket: aws_s3.Bucket
  poolCacheBucket2: aws_s3.Bucket
  poolCacheKey: string
  nodeRPC: string
  nodeRPCUsername: string
  nodeRPCPassword: string
  nodeRPCRinkeby: string
  nodeRPCUsernameRinkeby: string
  nodeRPCPasswordRinkeby: string
  tokenListCacheBucket: aws_s3.Bucket
  provisionedConcurrency: number
  ethGasStationInfoUrl: string
  chatbotSNSArn?: string
}
export class RoutingLambdaStack extends cdk.NestedStack {
  public readonly routingLambda: aws_lambda_nodejs.NodejsFunction
  public readonly routeToRatioLambda: aws_lambda_nodejs.NodejsFunction
  public readonly routingLambdaAlias: aws_lambda.Alias

  constructor(scope: cdk.Construct, name: string, props: RoutingLambdaStackProps) {
    super(scope, name, props)
    const {
      poolCacheBucket,
      poolCacheBucket2,
      poolCacheKey,
      nodeRPC,
      nodeRPCUsername,
      nodeRPCPassword,
      nodeRPCRinkeby,
      nodeRPCUsernameRinkeby,
      nodeRPCPasswordRinkeby,
      tokenListCacheBucket,
      provisionedConcurrency,
      ethGasStationInfoUrl,
      chatbotSNSArn,
    } = props

    const lambdaRole = new aws_iam.Role(this, 'RoutingLambdaRole', {
      assumedBy: new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLambdaInsightsExecutionRolePolicy'),
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'),
      ],
    })
    poolCacheBucket.grantRead(lambdaRole)
    poolCacheBucket2.grantRead(lambdaRole)
    tokenListCacheBucket.grantRead(lambdaRole)

    const region = cdk.Stack.of(this).region

    this.routingLambda = new aws_lambda_nodejs.NodejsFunction(this, 'RoutingLambda2', {
      role: lambdaRole,
      runtime: aws_lambda.Runtime.NODEJS_14_X,
      entry: path.join(__dirname, '../../lib/handlers/index.ts'),
      handler: 'quoteHandler',
      timeout: cdk.Duration.seconds(29),
      memorySize: 1024,
      bundling: {
        minify: true,
        sourceMap: true,
      },
      environment: {
        VERSION: '2',
        NODE_OPTIONS: '--enable-source-maps',
        POOL_CACHE_BUCKET: poolCacheBucket.bucketName,
        POOL_CACHE_BUCKET_2: poolCacheBucket2.bucketName,
        POOL_CACHE_KEY: poolCacheKey,
        JSON_RPC_URL: nodeRPC,
        JSON_RPC_USERNAME: nodeRPCUsername,
        JSON_RPC_PASSWORD: nodeRPCPassword,
        JSON_RPC_URL_RINKEBY: nodeRPCRinkeby,
        JSON_RPC_USERNAME_RINKEBY: nodeRPCUsernameRinkeby,
        JSON_RPC_PASSWORD_RINKEBY: nodeRPCPasswordRinkeby,
        TOKEN_LIST_CACHE_BUCKET: tokenListCacheBucket.bucketName,
        ETH_GAS_STATION_INFO_URL: ethGasStationInfoUrl,
      },
      layers: [
        aws_lambda.LayerVersion.fromLayerVersionArn(
          this,
          'InsightsLayer',
          `arn:aws:lambda:${region}:580247275435:layer:LambdaInsightsExtension:14`
        ),
      ],
      tracing: aws_lambda.Tracing.ACTIVE,
    })

    this.routeToRatioLambda = new aws_lambda_nodejs.NodejsFunction(this, 'RouteToRatioLambda2', {
      role: lambdaRole,
      runtime: aws_lambda.Runtime.NODEJS_14_X,
      entry: path.join(__dirname, '../../lib/handlers/index.ts'),
      handler: 'quoteToRatioHandler',
      timeout: cdk.Duration.seconds(29),
      memorySize: 1024,
      bundling: {
        minify: true,
        sourceMap: true,
      },
      environment: {
        VERSION: '2',
        NODE_OPTIONS: '--enable-source-maps',
        POOL_CACHE_BUCKET: poolCacheBucket.bucketName,
        POOL_CACHE_BUCKET_2: poolCacheBucket2.bucketName,
        POOL_CACHE_KEY: poolCacheKey,
        JSON_RPC_URL: nodeRPC,
        JSON_RPC_USERNAME: nodeRPCUsername,
        JSON_RPC_PASSWORD: nodeRPCPassword,
        JSON_RPC_URL_RINKEBY: nodeRPCRinkeby,
        JSON_RPC_USERNAME_RINKEBY: nodeRPCUsernameRinkeby,
        JSON_RPC_PASSWORD_RINKEBY: nodeRPCPasswordRinkeby,
        TOKEN_LIST_CACHE_BUCKET: tokenListCacheBucket.bucketName,
        ETH_GAS_STATION_INFO_URL: ethGasStationInfoUrl,
      },
      layers: [
        aws_lambda.LayerVersion.fromLayerVersionArn(
          this,
          'InsightsLayerSwapAndAdd',
          `arn:aws:lambda:${region}:580247275435:layer:LambdaInsightsExtension:14`
        ),
      ],
      tracing: aws_lambda.Tracing.ACTIVE,
    })

    const lambdaAlarmErrorRate = new aws_cloudwatch.Alarm(this, 'RoutingAPI-LambdaErrorRate', {
      metric: new aws_cloudwatch.MathExpression({
        expression: 'errors / invocations',
        usingMetrics: {
          errors: this.routingLambda.metricErrors({
            period: Duration.minutes(5),
            statistic: 'avg',
          }),
          invocations: this.routingLambda.metricInvocations({
            period: Duration.minutes(5),
            statistic: 'avg',
          }),
        },
      }),
      threshold: 0.05,
      evaluationPeriods: 3,
    })

    const lambdaThrottlesErrorRate = new aws_cloudwatch.Alarm(this, 'RoutingAPI-LambdaThrottles', {
      metric: this.routingLambda.metricThrottles({
        period: Duration.minutes(5),
        statistic: 'sum',
      }),
      threshold: 10,
      evaluationPeriods: 3,
    })

    if (chatbotSNSArn) {
      const chatBotTopic = aws_sns.Topic.fromTopicArn(this, 'ChatbotTopic', chatbotSNSArn)

      lambdaAlarmErrorRate.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))

      lambdaThrottlesErrorRate.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))
    }

    const enableProvisionedConcurrency = provisionedConcurrency > 0

    this.routingLambdaAlias = new aws_lambda.Alias(this, 'RoutingLiveAlias', {
      aliasName: 'live',
      version: this.routingLambda.currentVersion,
      provisionedConcurrentExecutions: enableProvisionedConcurrency ? provisionedConcurrency : undefined,
    })

    if (enableProvisionedConcurrency) {
      const target = new asg.ScalableTarget(this, 'RoutingProvConcASG', {
        serviceNamespace: asg.ServiceNamespace.LAMBDA,
        maxCapacity: provisionedConcurrency * 5,
        minCapacity: provisionedConcurrency,
        resourceId: `function:${this.routingLambdaAlias.lambda.functionName}:${this.routingLambdaAlias.aliasName}`,
        scalableDimension: 'lambda:function:ProvisionedConcurrency',
      })

      target.node.addDependency(this.routingLambdaAlias)

      target.scaleToTrackMetric('RoutingProvConcTracking', {
        targetValue: 0.8,
        predefinedMetric: asg.PredefinedMetric.LAMBDA_PROVISIONED_CONCURRENCY_UTILIZATION,
      })
    }
  }
}
