import * as cdk from 'aws-cdk-lib'
import { CfnOutput, Duration } from 'aws-cdk-lib'
import * as aws_dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as asg from 'aws-cdk-lib/aws-applicationautoscaling'
import * as aws_cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as aws_cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions'
import * as aws_iam from 'aws-cdk-lib/aws-iam'
import * as aws_lambda from 'aws-cdk-lib/aws-lambda'
import * as aws_lambda_nodejs from 'aws-cdk-lib/aws-lambda-nodejs'
import * as aws_s3 from 'aws-cdk-lib/aws-s3'
import * as aws_sns from 'aws-cdk-lib/aws-sns'
import { Construct } from 'constructs'
import * as path from 'path'
import { DynamoDBTableProps } from './routing-database-stack'
import { RetentionDays } from 'aws-cdk-lib/aws-logs'

export interface RoutingLambdaStackProps extends cdk.NestedStackProps {
  poolCacheBucket: aws_s3.Bucket
  poolCacheBucket2: aws_s3.Bucket
  poolCacheBucket3: aws_s3.Bucket
  poolCacheKey: string
  poolCacheGzipKey: string
  jsonRpcProviders: { [chainName: string]: string }
  tokenListCacheBucket: aws_s3.Bucket
  provisionedConcurrency: number
  ethGasStationInfoUrl: string
  tenderlyUser: string
  tenderlyProject: string
  tenderlyAccessKey: string
  chatbotSNSArn?: string
  routesDynamoDb: aws_dynamodb.Table
  routesDbCachingRequestFlagDynamoDb: aws_dynamodb.Table
  cachedRoutesDynamoDb: aws_dynamodb.Table
  cachingRequestFlagDynamoDb: aws_dynamodb.Table
  cachedV3PoolsDynamoDb: aws_dynamodb.Table
  cachedV2PairsDynamoDb: aws_dynamodb.Table
  tokenPropertiesCachingDynamoDb: aws_dynamodb.Table
  rpcProviderHealthStateDynamoDb: aws_dynamodb.Table
  unicornSecret: string
}
export class RoutingLambdaStack extends cdk.NestedStack {
  public readonly routingLambda: aws_lambda_nodejs.NodejsFunction
  public readonly routingLambdaAlias: aws_lambda.Alias

  constructor(scope: Construct, name: string, props: RoutingLambdaStackProps) {
    super(scope, name, props)
    const {
      poolCacheBucket,
      poolCacheBucket2,
      poolCacheBucket3,
      poolCacheKey,
      poolCacheGzipKey,
      jsonRpcProviders,
      tokenListCacheBucket,
      provisionedConcurrency,
      ethGasStationInfoUrl,
      chatbotSNSArn,
      tenderlyUser,
      tenderlyProject,
      tenderlyAccessKey,
      routesDynamoDb,
      routesDbCachingRequestFlagDynamoDb,
      cachedRoutesDynamoDb,
      cachingRequestFlagDynamoDb,
      cachedV3PoolsDynamoDb,
      cachedV2PairsDynamoDb,
      tokenPropertiesCachingDynamoDb,
      rpcProviderHealthStateDynamoDb,
      unicornSecret,
    } = props

    new CfnOutput(this, 'jsonRpcProviders', {
      value: JSON.stringify(jsonRpcProviders),
    })

    const lambdaRole = new aws_iam.Role(this, 'RoutingLambdaRole', {
      assumedBy: new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaRole'),
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLambdaInsightsExecutionRolePolicy'),
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'),
      ],
    })
    poolCacheBucket.grantRead(lambdaRole)
    poolCacheBucket2.grantRead(lambdaRole)
    poolCacheBucket3.grantRead(lambdaRole)
    tokenListCacheBucket.grantRead(lambdaRole)
    routesDynamoDb.grantReadWriteData(lambdaRole)
    routesDbCachingRequestFlagDynamoDb.grantReadWriteData(lambdaRole)
    cachedRoutesDynamoDb.grantReadWriteData(lambdaRole)
    cachingRequestFlagDynamoDb.grantReadWriteData(lambdaRole)
    cachedV3PoolsDynamoDb.grantReadWriteData(lambdaRole)
    cachedV2PairsDynamoDb.grantReadWriteData(lambdaRole)
    tokenPropertiesCachingDynamoDb.grantReadWriteData(lambdaRole)
    rpcProviderHealthStateDynamoDb.grantReadWriteData(lambdaRole)

    const region = cdk.Stack.of(this).region

    this.routingLambda = new aws_lambda_nodejs.NodejsFunction(this, 'RoutingLambda2', {
      role: lambdaRole,
      runtime: aws_lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../../lib/handlers/index.ts'),
      handler: 'quoteHandler',
      // 11/8/23: URA currently calls the Routing API with a timeout of 10 seconds.
      // Set this lambda's timeout to be slightly lower to give them time to
      // log the response in the event of a failure on our end.
      timeout: cdk.Duration.seconds(9),
      memorySize: 2560,
      deadLetterQueueEnabled: true,
      bundling: {
        minify: true,
        sourceMap: true,
      },

      awsSdkConnectionReuse: true,

      description: 'Routing Lambda',
      environment: {
        VERSION: '19',
        NODE_OPTIONS: '--enable-source-maps',
        POOL_CACHE_BUCKET: poolCacheBucket.bucketName,
        POOL_CACHE_BUCKET_2: poolCacheBucket2.bucketName,
        POOL_CACHE_BUCKET_3: poolCacheBucket3.bucketName,
        POOL_CACHE_KEY: poolCacheKey,
        POOL_CACHE_GZIP_KEY: poolCacheGzipKey,
        TOKEN_LIST_CACHE_BUCKET: tokenListCacheBucket.bucketName,
        ETH_GAS_STATION_INFO_URL: ethGasStationInfoUrl,
        TENDERLY_USER: tenderlyUser,
        TENDERLY_PROJECT: tenderlyProject,
        TENDERLY_ACCESS_KEY: tenderlyAccessKey,
        // WARNING: Dynamo table name should be the tableinstance.name, e.g. routesDynamoDb.tableName.
        //          But we tried and had seen lambd version error:
        //          The following resource(s) failed to create: [RoutingLambda2CurrentVersion49A1BB948389ce4f9c26b15e2ccb07b4c1bab726].
        //          2023-09-01 10:22:43 UTC-0700RoutingLambda2CurrentVersion49A1BB948389ce4f9c26b15e2ccb07b4c1bab726CREATE_FAILED
        //          A version for this Lambda function exists ( 261 ). Modify the function to create a new version.
        //          Hence we do not want to modify the table name below.
        ROUTES_TABLE_NAME: DynamoDBTableProps.RoutesDbTable.Name,
        ROUTES_CACHING_REQUEST_FLAG_TABLE_NAME: DynamoDBTableProps.RoutesDbCachingRequestFlagTable.Name,
        CACHED_ROUTES_TABLE_NAME: DynamoDBTableProps.CacheRouteDynamoDbTable.Name,
        CACHING_REQUEST_FLAG_TABLE_NAME: DynamoDBTableProps.CachingRequestFlagDynamoDbTable.Name,
        CACHED_V3_POOLS_TABLE_NAME: DynamoDBTableProps.V3PoolsDynamoDbTable.Name,
        V2_PAIRS_CACHE_TABLE_NAME: DynamoDBTableProps.V2PairsDynamoCache.Name,
        RPC_PROVIDER_HEALTH_TABLE_NAME: DynamoDBTableProps.RpcProviderHealthStateDbTable.Name,

        // tokenPropertiesCachingDynamoDb.tableName is the correct format.
        // we will start using the correct ones going forward
        TOKEN_PROPERTIES_CACHING_TABLE_NAME: tokenPropertiesCachingDynamoDb.tableName,
        UNICORN_SECRET: unicornSecret,
        ...jsonRpcProviders,
      },
      layers: [
        aws_lambda.LayerVersion.fromLayerVersionArn(
          this,
          'InsightsLayer',
          `arn:aws:lambda:${region}:580247275435:layer:LambdaInsightsExtension:14`
        ),
      ],
      tracing: aws_lambda.Tracing.ACTIVE,
      logRetention: RetentionDays.TWO_WEEKS,
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
        maxCapacity: provisionedConcurrency * 10,
        minCapacity: provisionedConcurrency,
        resourceId: `function:${this.routingLambdaAlias.lambda.functionName}:${this.routingLambdaAlias.aliasName}`,
        scalableDimension: 'lambda:function:ProvisionedConcurrency',
      })

      target.node.addDependency(this.routingLambdaAlias)

      target.scaleToTrackMetric('RoutingProvConcTracking', {
        targetValue: 0.7,
        predefinedMetric: asg.PredefinedMetric.LAMBDA_PROVISIONED_CONCURRENCY_UTILIZATION,
      })
    }
  }
}
