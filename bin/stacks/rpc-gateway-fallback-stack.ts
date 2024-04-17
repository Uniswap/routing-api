import * as cdk from 'aws-cdk-lib'
import { aws_cloudwatch, aws_cloudwatch_actions, aws_iam, aws_lambda, aws_lambda_nodejs } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import path from 'path'
import { getRpcGatewayEnabledChains } from '../../lib/rpc/ProdConfig'
import { ComparisonOperator, MathExpression } from 'aws-cdk-lib/aws-cloudwatch'
import { RetentionDays } from 'aws-cdk-lib/aws-logs'
import { DynamoDBTableProps } from './routing-database-stack'
import * as aws_dynamodb from 'aws-cdk-lib/aws-dynamodb'

export interface RpcGatewayFallbackStackPros extends cdk.NestedStackProps {
  rpcProviderHealthStateDynamoDb: aws_dynamodb.Table
}

export class RpcGatewayFallbackStack extends cdk.NestedStack {
  constructor(scope: Construct, name: string, props: RpcGatewayFallbackStackPros) {
    super(scope, name, props)

    const lambdaRole = new aws_iam.Role(this, 'ProviderFallbackLambdaRole', {
      assumedBy: new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaRole'),
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLambdaInsightsExecutionRolePolicy'),
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'),
      ],
    })

    const rpcHealthProviderStateDynamoDB = props.rpcProviderHealthStateDynamoDb
    rpcHealthProviderStateDynamoDB.grantReadWriteData(lambdaRole)

    const region = cdk.Stack.of(this).region

    const providerFallbackLambda = new aws_lambda_nodejs.NodejsFunction(this, 'ProviderFallbackLambda', {
      role: lambdaRole,
      runtime: aws_lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../../lib/rpc/handler/index.ts'),
      handler: 'fallbackHandler',
      timeout: cdk.Duration.seconds(5),
      memorySize: 1024,
      description: 'Provider Fallback Lambda',
      bundling: {
        minify: true,
        sourceMap: true,
      },
      layers: [
        aws_lambda.LayerVersion.fromLayerVersionArn(
          this,
          'InsightsLayer',
          `arn:aws:lambda:${region}:580247275435:layer:LambdaInsightsExtension:14`
        ),
      ],
      tracing: aws_lambda.Tracing.ACTIVE,
      logRetention: RetentionDays.ONE_MONTH,

      environment: {
        PROVIDER_HEALTH_STATE_DB_TABLE_NAME: DynamoDBTableProps.RpcProviderHealthStateDbTable.Name,
      },
    })

    // TODO(jie): Enable these ErrorRate alarms
    for (const [chainId, providerNames] of getRpcGatewayEnabledChains()) {
      for (const providerName of providerNames) {
        const providerNameFix = providerName === 'QUICKNODE' ? 'QUIKNODE' : providerName
        const alarmName = `RoutingAPI-RpcGateway-ErrorRateAlarm-ChainId-${chainId}-Provider-${providerNameFix}`
        // TODO(jie): Use this for prod error rate alarm
        // const metric = new MathExpression({
        //   expression: '100*(callFails/(callSuccesses+callFails))',
        //   usingMetrics: {
        //     callSuccesses: new aws_cloudwatch.Metric({
        //       namespace: 'Uniswap',
        //       metricName: `RPC_GATEWAY_${chainId}_${providerNameFix}_SUCCESS`,
        //       dimensionsMap: { Service: 'RoutingAPI' },
        //       unit: aws_cloudwatch.Unit.COUNT,
        //       statistic: 'sum'
        //     }),
        //     callFails: new aws_cloudwatch.Metric({
        //       namespace: 'Uniswap',
        //       metricName: `RPC_GATEWAY_${chainId}_${providerNameFix}_FAILED`,
        //       dimensionsMap: { Service: 'RoutingAPI' },
        //       unit: aws_cloudwatch.Unit.COUNT,
        //       statistic: 'sum'
        //     }),
        //   }
        // })
        // TODO(jie): This is for test only. Should be removed after testing
        const metric = new MathExpression({
          expression: 'callSuccesses',
          usingMetrics: {
            callSuccesses: new aws_cloudwatch.Metric({
              namespace: 'Uniswap',
              metricName: `RPC_GATEWAY_${chainId}_${providerNameFix}_SUCCESS`,
              dimensionsMap: { Service: 'RoutingAPI' },
              unit: aws_cloudwatch.Unit.COUNT,
              statistic: 'sum',
              period: cdk.Duration.seconds(30),
            }),
          },
        })
        const alarm = new aws_cloudwatch.Alarm(this, alarmName, {
          alarmName,
          metric,
          comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
          threshold: 150,
          evaluationPeriods: 1,
        })

        const lambdaAliasName = `ErrorRate-${chainId}-${providerNameFix}`
        const lambdaAlias = new aws_lambda.Alias(this, lambdaAliasName, {
          aliasName: lambdaAliasName,
          version: providerFallbackLambda.currentVersion,
        })

        alarm.addAlarmAction(new aws_cloudwatch_actions.LambdaAction(lambdaAlias))
      }
    }

    // TODO(jie): Figure out how to write latency alarms
    // TODO(jie): Connect lambda call and alarm action
    // const rpcGatewayLatencyAlarmPerChainIdAndProvider: cdk.aws_cloudwatch.Alarm[] = []
    // for (const [chainId, providerNames] of getRpcGatewayEnabledChains()) {
    //   for (const providerName of providerNames) {
    //     const alarmName = `RoutingAPI-RpcGateway-LatencyAlarm-ChainId-${chainId}-Provider-${providerName}`
    //     const alarm = new aws_cloudwatch.Alarm(this, alarmName, {
    //       alarmName,
    //       metric: api.metricLatency({
    //         period: Duration.minutes(5),
    //         statistic: 'p90',
    //       }),
    //       threshold: 3500,
    //       evaluationPeriods: 3,
    //     })
    //     const alarm = new aws_cloudwatch.Alarm(this, alarmName, {
    //       `RoutingAPI-RpcGateway-LatencyAlarm-ChainId-${chainId}-Provider-${providerName}`
    //       metric,
    //       comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    //       threshold: 50, // This is alarm will trigger if fail rate >= 50%
    //       evaluationPeriods: 2
    //     })
    //     rpcGatewayErrorRateAlarmPerChainIdAndProvider.push(alarm)
    //   }
    // }
  }
}
