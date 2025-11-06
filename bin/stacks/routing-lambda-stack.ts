import * as cdk from 'aws-cdk-lib'
import { CfnOutput } from 'aws-cdk-lib'
import * as aws_dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as asg from 'aws-cdk-lib/aws-applicationautoscaling'
import * as aws_iam from 'aws-cdk-lib/aws-iam'
import * as aws_lambda from 'aws-cdk-lib/aws-lambda'
import * as aws_lambda_nodejs from 'aws-cdk-lib/aws-lambda-nodejs'
import * as aws_s3 from 'aws-cdk-lib/aws-s3'
import { Construct } from 'constructs'
import * as path from 'path'
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
  tenderlyNodeApiKey: string
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
  uniGraphQLEndpoint: string
  uniGraphQLHeaderOrigin: string
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
      poolCacheGzipKey,
      jsonRpcProviders,
      tokenListCacheBucket,
      provisionedConcurrency,
      ethGasStationInfoUrl,
      tenderlyUser,
      tenderlyProject,
      tenderlyAccessKey,
      tenderlyNodeApiKey,
      routesDynamoDb,
      routesDbCachingRequestFlagDynamoDb,
      cachedRoutesDynamoDb,
      cachingRequestFlagDynamoDb,
      cachedV3PoolsDynamoDb,
      cachedV2PairsDynamoDb,
      tokenPropertiesCachingDynamoDb,
      rpcProviderHealthStateDynamoDb,
      unicornSecret,
      uniGraphQLEndpoint,
      uniGraphQLHeaderOrigin,
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

    const cachingRoutingLambda = new aws_lambda_nodejs.NodejsFunction(this, 'CachingRoutingLambda', {
      role: lambdaRole,
      runtime: aws_lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../../lib/handlers/index.ts'),
      handler: 'quoteHandler',
      // 04/18/2025: async routing lambda can have much longer timeout
      timeout: cdk.Duration.seconds(18),
      memorySize: 5120,
      deadLetterQueueEnabled: true,
      bundling: {
        minify: true,
        sourceMap: true,
      },

      awsSdkConnectionReuse: true,

      description: 'Caching Routing Lambda',
      environment: {
        VERSION: '2',
        NODE_OPTIONS: '--enable-source-maps',
        POOL_CACHE_BUCKET: poolCacheBucket.bucketName,
        POOL_CACHE_BUCKET_3: poolCacheBucket3.bucketName,
        POOL_CACHE_GZIP_KEY: poolCacheGzipKey,
        TOKEN_LIST_CACHE_BUCKET: tokenListCacheBucket.bucketName,
        ETH_GAS_STATION_INFO_URL: ethGasStationInfoUrl,
        TENDERLY_USER: tenderlyUser,
        TENDERLY_PROJECT: tenderlyProject,
        TENDERLY_ACCESS_KEY: tenderlyAccessKey,
        TENDERLY_NODE_API_KEY: tenderlyNodeApiKey,
        // Use actual table names from DynamoDB instances instead of hardcoded names
        // This allows staging environments to use auto-generated table names
        ROUTES_TABLE_NAME: routesDynamoDb.tableName,
        ROUTES_CACHING_REQUEST_FLAG_TABLE_NAME: routesDbCachingRequestFlagDynamoDb.tableName,
        CACHED_ROUTES_TABLE_NAME: cachedRoutesDynamoDb.tableName,
        CACHING_REQUEST_FLAG_TABLE_NAME: cachingRequestFlagDynamoDb.tableName,
        CACHED_V3_POOLS_TABLE_NAME: cachedV3PoolsDynamoDb.tableName,
        V2_PAIRS_CACHE_TABLE_NAME: cachedV2PairsDynamoDb.tableName,
        RPC_PROVIDER_HEALTH_TABLE_NAME: rpcProviderHealthStateDynamoDb.tableName,
        TOKEN_PROPERTIES_CACHING_TABLE_NAME: tokenPropertiesCachingDynamoDb.tableName,
        UNICORN_SECRET: unicornSecret,
        GQL_URL: uniGraphQLEndpoint,
        GQL_H_ORGN: uniGraphQLHeaderOrigin,
        ...jsonRpcProviders,
      },
      layers: [
        aws_lambda.LayerVersion.fromLayerVersionArn(
          this,
          'CachingInsightsLayer',
          `arn:aws:lambda:${region}:580247275435:layer:LambdaInsightsExtension:14`
        ),
      ],
      tracing: aws_lambda.Tracing.ACTIVE,
      logRetention: RetentionDays.TWO_WEEKS,
    })

    this.routingLambda = new aws_lambda_nodejs.NodejsFunction(this, 'RoutingLambda2', {
      role: lambdaRole,
      runtime: aws_lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../../lib/handlers/index.ts'),
      handler: 'quoteHandler',
      // Increased timeout to handle token list fetching and complex routing
      // Previous 9s timeout was causing frequent timeouts
      timeout: cdk.Duration.seconds(15),
      memorySize: 5120,
      deadLetterQueueEnabled: true,
      bundling: {
        minify: true,
        sourceMap: true,
      },

      awsSdkConnectionReuse: true,

      description: 'Routing Lambda',
      environment: {
        VERSION: '29',
        NODE_OPTIONS: '--enable-source-maps',
        POOL_CACHE_BUCKET: poolCacheBucket.bucketName,
        POOL_CACHE_BUCKET_3: poolCacheBucket3.bucketName,
        POOL_CACHE_GZIP_KEY: poolCacheGzipKey,
        TOKEN_LIST_CACHE_BUCKET: tokenListCacheBucket.bucketName,
        ETH_GAS_STATION_INFO_URL: ethGasStationInfoUrl,
        TENDERLY_USER: tenderlyUser,
        TENDERLY_PROJECT: tenderlyProject,
        TENDERLY_ACCESS_KEY: tenderlyAccessKey,
        TENDERLY_NODE_API_KEY: tenderlyNodeApiKey,
        // Use actual table names from DynamoDB instances instead of hardcoded names
        // This allows staging environments to use auto-generated table names
        ROUTES_TABLE_NAME: routesDynamoDb.tableName,
        ROUTES_CACHING_REQUEST_FLAG_TABLE_NAME: routesDbCachingRequestFlagDynamoDb.tableName,
        CACHED_ROUTES_TABLE_NAME: cachedRoutesDynamoDb.tableName,
        CACHING_REQUEST_FLAG_TABLE_NAME: cachingRequestFlagDynamoDb.tableName,
        CACHED_V3_POOLS_TABLE_NAME: cachedV3PoolsDynamoDb.tableName,
        V2_PAIRS_CACHE_TABLE_NAME: cachedV2PairsDynamoDb.tableName,
        RPC_PROVIDER_HEALTH_TABLE_NAME: rpcProviderHealthStateDynamoDb.tableName,
        TOKEN_PROPERTIES_CACHING_TABLE_NAME: tokenPropertiesCachingDynamoDb.tableName,
        UNICORN_SECRET: unicornSecret,
        GQL_URL: uniGraphQLEndpoint,
        GQL_H_ORGN: uniGraphQLHeaderOrigin,
        CACHING_ROUTING_LAMBDA_FUNCTION_NAME: cachingRoutingLambda.functionName,
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

    const enableProvisionedConcurrency = provisionedConcurrency > 0

    const cachingRoutingLambdaAlias = new aws_lambda.Alias(this, 'CachingRoutingLiveAlias', {
      aliasName: 'live',
      version: cachingRoutingLambda.currentVersion,
      provisionedConcurrentExecutions: enableProvisionedConcurrency ? provisionedConcurrency : undefined,
    })
    this.routingLambdaAlias = new aws_lambda.Alias(this, 'RoutingLiveAlias', {
      aliasName: 'live',
      version: this.routingLambda.currentVersion,
      provisionedConcurrentExecutions: enableProvisionedConcurrency ? provisionedConcurrency : undefined,
    })

    if (enableProvisionedConcurrency) {
      const cachingTarget = new asg.ScalableTarget(this, 'CachingRoutingProvConcASG', {
        serviceNamespace: asg.ServiceNamespace.LAMBDA,
        maxCapacity: provisionedConcurrency * 10,
        minCapacity: provisionedConcurrency,
        resourceId: `function:${cachingRoutingLambdaAlias.lambda.functionName}:${cachingRoutingLambdaAlias.aliasName}`,
        scalableDimension: 'lambda:function:ProvisionedConcurrency',
      })

      cachingTarget.node.addDependency(cachingRoutingLambdaAlias)

      cachingTarget.scaleToTrackMetric('CachingRoutingProvConcTracking', {
        targetValue: 0.7,
        predefinedMetric: asg.PredefinedMetric.LAMBDA_PROVISIONED_CONCURRENCY_UTILIZATION,
      })

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
