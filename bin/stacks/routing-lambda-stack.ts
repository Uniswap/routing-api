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
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { Construct } from 'constructs'
import * as path from 'path'
import { DynamoDBTableProps } from './routing-database-stack'
import { RetentionDays } from 'aws-cdk-lib/aws-logs'
import * as aws_route53 from 'aws-cdk-lib/aws-route53'
import * as aws_route53_targets from 'aws-cdk-lib/aws-route53-targets'

const vpcEndpointServiceMap: Record<string, string> = {
  dev: 'com.amazonaws.vpce.us-east-2.vpce-svc-0945550ad67320638',
  staging: 'com.amazonaws.vpce.us-east-2.vpce-svc-00e58a4116063039d',
  prod: 'com.amazonaws.vpce.us-east-2.vpce-svc-04784c683b22cfabb',
}
const privateHostedZoneName = 'unihq.org'

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
      chatbotSNSArn,
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
    const stage = process.env.STAGE || 'dev' // Default to 'dev' if not set

    // TODO: Add if not dev , not create
    const vpc = new ec2.Vpc(this, `RoutingLambdaVPC-${stage}`, {
      maxAzs: 2, // Number of availability zones
      subnetConfiguration: [
        {
          name: `RoutingPublicSubnet-${stage}`,
          subnetType: ec2.SubnetType.PUBLIC, // Public subnet with internet access
          cidrMask: 24, // IP range for public subnet
        },
        {
          name: `RoutingPrivateSubnet-${stage}`,
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, // Private subnet with access to the internet via NAT Gateway
          cidrMask: 24, // IP range for private subnet
        },
      ],
      natGateways: 1, // One NAT Gateway for private subnet internet access
    })

    const publicSubnets = vpc.selectSubnets({ subnetType: ec2.SubnetType.PUBLIC })
    const vpcEndpoint = new ec2.InterfaceVpcEndpoint(this, `AccessUnirpcEndpoint-${stage}`, {
      vpc,
      service: new ec2.InterfaceVpcEndpointService(vpcEndpointServiceMap[stage], 443),
      subnets: publicSubnets,
      privateDnsEnabled: false, // Enable private DNS for the endpoint
    })

    // Create a private hosted zone
    const hostedZone = new aws_route53.PrivateHostedZone(this, 'UniHQHostedZone', {
      zoneName: privateHostedZoneName,
      vpc,
    })

    const recordName = `routing-${stage}.${privateHostedZoneName}` // e.g. routing-dev.unihq.org
    new aws_route53.ARecord(this, 'RoutingRecord', {
      zone: hostedZone,
      recordName: recordName,
      target: aws_route53.RecordTarget.fromAlias(new aws_route53_targets.InterfaceVpcEndpointTarget(vpcEndpoint)),
    })

    new cdk.CfnOutput(this, 'VpcEndpointId', {
      value: vpcEndpoint.vpcEndpointId,
    })

    const lambdaRole = new aws_iam.Role(this, 'RoutingLambdaRole', {
      assumedBy: new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        // Basic Lambda execution role
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        // General Lambda role
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaRole'),
        // CloudWatch for logs and monitoring
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLambdaInsightsExecutionRolePolicy'),
        // X-Ray for tracing
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'),
      ],
    })

    // Add inline policy for EC2 permissions
    lambdaRole.addToPolicy(
      new aws_iam.PolicyStatement({
        actions: [
          'ec2:CreateNetworkInterface',
          'ec2:DescribeNetworkInterfaces',
          'ec2:DeleteNetworkInterface',
          'ec2:AssignPrivateIpAddresses',
          'ec2:UnassignPrivateIpAddresses',
        ],
        resources: ['*'], // Adjust this to restrict to specific resources if needed
      })
    )

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
      vpc: vpc,
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

      description: 'Caching Routing Lambda',
      environment: {
        VERSION: '1',
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
      vpc: vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
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
        VERSION: '28',
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

    const cachingLambdaAlarmErrorRate = new aws_cloudwatch.Alarm(this, 'CachingRoutingAPI-LambdaErrorRate', {
      metric: new aws_cloudwatch.MathExpression({
        expression: 'errors / invocations',
        usingMetrics: {
          errors: cachingRoutingLambda.metricErrors({
            period: Duration.minutes(5),
            statistic: 'avg',
          }),
          invocations: cachingRoutingLambda.metricInvocations({
            period: Duration.minutes(5),
            statistic: 'avg',
          }),
        },
      }),
      threshold: 0.05,
      evaluationPeriods: 3,
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

    const cachingLambdaThrottlesErrorRate = new aws_cloudwatch.Alarm(this, 'CachingRoutingAPI-LambdaThrottles', {
      metric: cachingRoutingLambda.metricThrottles({
        period: Duration.minutes(5),
        statistic: 'sum',
      }),
      threshold: 10,
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

      cachingLambdaAlarmErrorRate.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))
      lambdaAlarmErrorRate.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))

      cachingLambdaThrottlesErrorRate.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))
      lambdaThrottlesErrorRate.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))
    }

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
