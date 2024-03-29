import { SUPPORTED_CHAINS } from '@uniswap/smart-order-router'
import * as cdk from 'aws-cdk-lib'
import { ChainId } from '@uniswap/sdk-core'
import { CfnOutput, Duration } from 'aws-cdk-lib'
import * as aws_apigateway from 'aws-cdk-lib/aws-apigateway'
import { MethodLoggingLevel } from 'aws-cdk-lib/aws-apigateway'
import * as aws_cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import { ComparisonOperator, MathExpression } from 'aws-cdk-lib/aws-cloudwatch'
import * as aws_cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions'
import * as aws_logs from 'aws-cdk-lib/aws-logs'
import * as aws_sns from 'aws-cdk-lib/aws-sns'
import * as aws_waf from 'aws-cdk-lib/aws-wafv2'
import { Construct } from 'constructs'
import { STAGE } from '../../lib/util/stage'
import { RoutingCachingStack } from './routing-caching-stack'
import { RoutingDashboardStack } from './routing-dashboard-stack'
import { RoutingLambdaStack } from './routing-lambda-stack'
import { RoutingDatabaseStack } from './routing-database-stack'
import { RpcGatewayDashboardStack } from './rpc-gateway-dashboard'
import { REQUEST_SOURCES } from '../../lib/util/requestSources'
import { TESTNETS } from '../../lib/util/testNets'

export const CHAINS_NOT_MONITORED: ChainId[] = TESTNETS
export const REQUEST_SOURCES_NOT_MONITORED = ['unknown']

export class RoutingAPIStack extends cdk.Stack {
  public readonly url: CfnOutput

  constructor(
    parent: Construct,
    name: string,
    props: cdk.StackProps & {
      jsonRpcProviders: { [chainName: string]: string }
      provisionedConcurrency: number
      throttlingOverride?: string
      ethGasStationInfoUrl: string
      chatbotSNSArn?: string
      stage: string
      internalApiKey?: string
      route53Arn?: string
      pinata_key?: string
      pinata_secret?: string
      hosted_zone?: string
      tenderlyUser: string
      tenderlyProject: string
      tenderlyAccessKey: string
      unicornSecret: string
    }
  ) {
    super(parent, name, props)

    const {
      jsonRpcProviders,
      provisionedConcurrency,
      throttlingOverride,
      ethGasStationInfoUrl,
      chatbotSNSArn,
      stage,
      internalApiKey,
      route53Arn,
      pinata_key,
      pinata_secret,
      hosted_zone,
      tenderlyUser,
      tenderlyProject,
      tenderlyAccessKey,
      unicornSecret,
    } = props

    const {
      poolCacheBucket,
      poolCacheBucket2,
      poolCacheKey,
      poolCacheLambdaNameArray,
      tokenListCacheBucket,
      ipfsPoolCachingLambda,
    } = new RoutingCachingStack(this, 'RoutingCachingStack', {
      chatbotSNSArn,
      stage,
      route53Arn,
      pinata_key,
      pinata_secret,
      hosted_zone,
    })

    const {
      routesDynamoDb,
      routesDbCachingRequestFlagDynamoDb,
      cachedRoutesDynamoDb,
      cachingRequestFlagDynamoDb,
      cachedV3PoolsDynamoDb,
      cachedV2PairsDynamoDb,
      tokenPropertiesCachingDynamoDb,
      rpcProviderStateDynamoDb,
    } = new RoutingDatabaseStack(this, 'RoutingDatabaseStack', {})

    const { routingLambda, routingLambdaAlias } = new RoutingLambdaStack(this, 'RoutingLambdaStack', {
      poolCacheBucket,
      poolCacheBucket2,
      poolCacheKey,
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
      rpcProviderStateDynamoDb,
      unicornSecret,
    })

    const accessLogGroup = new aws_logs.LogGroup(this, 'RoutingAPIGAccessLogs')

    const api = new aws_apigateway.RestApi(this, 'routing-api', {
      restApiName: 'Routing API',
      deployOptions: {
        tracingEnabled: true,
        loggingLevel: MethodLoggingLevel.ERROR,
        accessLogDestination: new aws_apigateway.LogGroupLogDestination(accessLogGroup),
        accessLogFormat: aws_apigateway.AccessLogFormat.jsonWithStandardFields({
          ip: false,
          caller: false,
          user: false,
          requestTime: true,
          httpMethod: true,
          resourcePath: true,
          status: true,
          protocol: true,
          responseLength: true,
        }),
      },
      defaultCorsPreflightOptions: {
        allowOrigins: aws_apigateway.Cors.ALL_ORIGINS,
        allowMethods: aws_apigateway.Cors.ALL_METHODS,
      },
    })

    const ipThrottlingACL = new aws_waf.CfnWebACL(this, 'RoutingAPIIPThrottlingACL', {
      defaultAction: { allow: {} },
      scope: 'REGIONAL',
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'RoutingAPIIPBasedThrottling',
      },
      customResponseBodies: {
        RoutingAPIThrottledResponseBody: {
          contentType: 'APPLICATION_JSON',
          content: '{"errorCode": "TOO_MANY_REQUESTS"}',
        },
      },
      name: 'RoutingAPIIPThrottling',
      rules: [
        {
          name: 'ip',
          priority: 0,
          statement: {
            rateBasedStatement: {
              // Limit is per 5 mins, i.e. 120 requests every 5 mins
              limit: throttlingOverride ? parseInt(throttlingOverride) : 120,
              // API is of type EDGE so is fronted by Cloudfront as a proxy.
              // Use the ip set in X-Forwarded-For by Cloudfront, not the regular IP
              // which would just resolve to Cloudfronts IP.
              aggregateKeyType: 'FORWARDED_IP',
              forwardedIpConfig: {
                headerName: 'X-Forwarded-For',
                fallbackBehavior: 'MATCH',
              },
              scopeDownStatement: {
                notStatement: {
                  statement: {
                    byteMatchStatement: {
                      fieldToMatch: {
                        singleHeader: {
                          name: 'x-api-key',
                        },
                      },
                      positionalConstraint: 'EXACTLY',
                      searchString: internalApiKey,
                      textTransformations: [
                        {
                          type: 'NONE',
                          priority: 0,
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
          action: {
            block: {
              customResponse: {
                responseCode: 429,
                customResponseBodyKey: 'RoutingAPIThrottledResponseBody',
              },
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'RoutingAPIIPBasedThrottlingRule',
          },
        },
      ],
    })

    const region = cdk.Stack.of(this).region
    const apiArn = `arn:aws:apigateway:${region}::/restapis/${api.restApiId}/stages/${api.deploymentStage.stageName}`

    new aws_waf.CfnWebACLAssociation(this, 'RoutingAPIIPThrottlingAssociation', {
      resourceArn: apiArn,
      webAclArn: ipThrottlingACL.getAtt('Arn').toString(),
    })

    new RoutingDashboardStack(this, 'RoutingDashboardStack', {
      apiName: api.restApiName,
      routingLambdaName: routingLambda.functionName,
      poolCacheLambdaNameArray,
      ipfsPoolCacheLambdaName: ipfsPoolCachingLambda ? ipfsPoolCachingLambda.functionName : undefined,
    })

    new RpcGatewayDashboardStack(this, 'RpcGatewayDashboardStack')

    const lambdaIntegration = new aws_apigateway.LambdaIntegration(routingLambdaAlias)

    const quote = api.root.addResource('quote', {
      defaultCorsPreflightOptions: {
        allowOrigins: aws_apigateway.Cors.ALL_ORIGINS,
        allowMethods: aws_apigateway.Cors.ALL_METHODS,
      },
    })
    quote.addMethod('GET', lambdaIntegration)

    // All alarms default to GreaterThanOrEqualToThreshold for when to be triggered.
    const apiAlarm5xxSev2 = new aws_cloudwatch.Alarm(this, 'RoutingAPI-SEV2-5XXAlarm', {
      alarmName: 'RoutingAPI-SEV2-5XX',
      metric: api.metricServerError({
        period: Duration.minutes(5),
        // For this metric 'avg' represents error rate.
        statistic: 'avg',
      }),
      threshold: 0.02,
      // Beta has much less traffic so is more susceptible to transient errors.
      evaluationPeriods: stage == STAGE.BETA ? 5 : 3,
    })

    const apiAlarm5xxSev3 = new aws_cloudwatch.Alarm(this, 'RoutingAPI-SEV3-5XXAlarm', {
      alarmName: 'RoutingAPI-SEV3-5XX',
      metric: api.metricServerError({
        period: Duration.minutes(5),
        // For this metric 'avg' represents error rate.
        statistic: 'avg',
      }),
      threshold: 0.01,
      // Beta has much less traffic so is more susceptible to transient errors.
      evaluationPeriods: stage == STAGE.BETA ? 5 : 3,
    })

    const apiAlarm4xxSev2 = new aws_cloudwatch.Alarm(this, 'RoutingAPI-SEV2-4XXAlarm', {
      alarmName: 'RoutingAPI-SEV2-4XX',
      metric: api.metricClientError({
        period: Duration.minutes(5),
        statistic: 'avg',
      }),
      threshold: 0.6,
      evaluationPeriods: 3,
    })

    const apiAlarm4xxSev3 = new aws_cloudwatch.Alarm(this, 'RoutingAPI-SEV3-4XXAlarm', {
      alarmName: 'RoutingAPI-SEV3-4XX',
      metric: api.metricClientError({
        period: Duration.minutes(5),
        statistic: 'avg',
      }),
      threshold: 0.4,
      evaluationPeriods: 3,
    })

    const apiAlarmLatencySev2 = new aws_cloudwatch.Alarm(this, 'RoutingAPI-SEV2-Latency', {
      alarmName: 'RoutingAPI-SEV2-Latency',
      metric: api.metricLatency({
        period: Duration.minutes(5),
        statistic: 'p90',
      }),
      threshold: 6500,
      evaluationPeriods: 3,
    })

    const apiAlarmLatencySev3 = new aws_cloudwatch.Alarm(this, 'RoutingAPI-SEV3-Latency', {
      alarmName: 'RoutingAPI-SEV3-Latency',
      metric: api.metricLatency({
        period: Duration.minutes(5),
        statistic: 'p90',
      }),
      threshold: 3500,
      evaluationPeriods: 3,
    })

    // Simulations can fail for valid reasons. For example, if the simulation reverts due
    // to slippage checks (can happen with FOT tokens sometimes since our quoter does not
    // account for the fees taken during transfer when we show the user the quote).
    //
    // For this reason we only alert on SEV3 to avoid unnecessary pages.
    const simulationAlarmSev3 = new aws_cloudwatch.Alarm(this, 'RoutingAPI-SEV3-Simulation', {
      alarmName: 'RoutingAPI-SEV3-Simulation',
      metric: new MathExpression({
        expression: '100*(simulationFailed/simulationRequested)',
        period: Duration.minutes(30),
        usingMetrics: {
          simulationRequested: new aws_cloudwatch.Metric({
            namespace: 'Uniswap',
            metricName: `Simulation Requested`,
            dimensionsMap: { Service: 'RoutingAPI' },
            unit: aws_cloudwatch.Unit.COUNT,
            statistic: 'sum',
          }),
          simulationFailed: new aws_cloudwatch.Metric({
            namespace: 'Uniswap',
            metricName: `SimulationFailed`,
            dimensionsMap: { Service: 'RoutingAPI' },
            unit: aws_cloudwatch.Unit.COUNT,
            statistic: 'sum',
          }),
        },
      }),
      threshold: 20,
      evaluationPeriods: 3,
      treatMissingData: aws_cloudwatch.TreatMissingData.NOT_BREACHING, // Missing data points are treated as "good" and within the threshold
    })

    // Alarms for high 400 error rate for each chain
    const percent4XXByChainAlarm: cdk.aws_cloudwatch.Alarm[] = []
    SUPPORTED_CHAINS.forEach((chainId) => {
      if (CHAINS_NOT_MONITORED.includes(chainId)) {
        return
      }
      const alarmName = `RoutingAPI-SEV3-4XXAlarm-ChainId: ${chainId.toString()}`
      const metric = new MathExpression({
        expression: '100*(response400/invocations)',
        usingMetrics: {
          invocations: new aws_cloudwatch.Metric({
            namespace: 'Uniswap',
            metricName: `GET_QUOTE_REQUESTED_CHAINID: ${chainId.toString()}`,
            dimensionsMap: { Service: 'RoutingAPI' },
            unit: aws_cloudwatch.Unit.COUNT,
            statistic: 'sum',
          }),
          response400: new aws_cloudwatch.Metric({
            namespace: 'Uniswap',
            metricName: `GET_QUOTE_400_CHAINID: ${chainId.toString()}`,
            dimensionsMap: { Service: 'RoutingAPI' },
            unit: aws_cloudwatch.Unit.COUNT,
            statistic: 'sum',
          }),
        },
      })
      const alarm = new aws_cloudwatch.Alarm(this, alarmName, {
        alarmName,
        metric,
        threshold: 80,
        evaluationPeriods: 2,
      })
      percent4XXByChainAlarm.push(alarm)
    })

    // Alarms for high 500 error rate for each chain
    const successRateByChainAlarm: cdk.aws_cloudwatch.Alarm[] = []
    SUPPORTED_CHAINS.forEach((chainId) => {
      if (CHAINS_NOT_MONITORED.includes(chainId)) {
        return
      }
      const alarmName = `RoutingAPI-SEV2-SuccessRate-Alarm-ChainId: ${chainId.toString()}`
      const metric = new MathExpression({
        expression: '100*(response200/(invocations-response400))',
        usingMetrics: {
          invocations: new aws_cloudwatch.Metric({
            namespace: 'Uniswap',
            metricName: `GET_QUOTE_REQUESTED_CHAINID: ${chainId.toString()}`,
            dimensionsMap: { Service: 'RoutingAPI' },
            unit: aws_cloudwatch.Unit.COUNT,
            statistic: 'sum',
          }),
          response400: new aws_cloudwatch.Metric({
            namespace: 'Uniswap',
            metricName: `GET_QUOTE_400_CHAINID: ${chainId.toString()}`,
            dimensionsMap: { Service: 'RoutingAPI' },
            unit: aws_cloudwatch.Unit.COUNT,
            statistic: 'sum',
          }),
          response200: new aws_cloudwatch.Metric({
            namespace: 'Uniswap',
            metricName: `GET_QUOTE_200_CHAINID: ${chainId.toString()}`,
            dimensionsMap: { Service: 'RoutingAPI' },
            unit: aws_cloudwatch.Unit.COUNT,
            statistic: 'sum',
          }),
        },
      })
      const alarm = new aws_cloudwatch.Alarm(this, alarmName, {
        alarmName,
        metric,
        comparisonOperator: ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
        threshold: 95, // This is alarm will trigger if the SR is less than or equal to 95%
        evaluationPeriods: 2,
      })
      successRateByChainAlarm.push(alarm)
    })

    // Alarms for high 500 error rate for each request source
    const successRateByRequestSourceAlarm: cdk.aws_cloudwatch.Alarm[] = []
    REQUEST_SOURCES.forEach((requestSource) => {
      if (REQUEST_SOURCES_NOT_MONITORED.includes(requestSource)) {
        return
      }
      const alarmName = `RoutingAPI-SEV2-SuccessRate-Alarm-RequestSource: ${requestSource.toString()}`
      const metric = new MathExpression({
        expression: '100*(response200/(invocations-response400))',
        usingMetrics: {
          invocations: new aws_cloudwatch.Metric({
            namespace: 'Uniswap',
            metricName: `GET_QUOTE_REQUEST_SOURCE: ${requestSource.toString()}`,
            dimensionsMap: { Service: 'RoutingAPI' },
            unit: aws_cloudwatch.Unit.COUNT,
            statistic: 'sum',
          }),
          response400: new aws_cloudwatch.Metric({
            namespace: 'Uniswap',
            metricName: `GET_QUOTE_400_REQUEST_SOURCE: ${requestSource.toString()}`,
            dimensionsMap: { Service: 'RoutingAPI' },
            unit: aws_cloudwatch.Unit.COUNT,
            statistic: 'sum',
          }),
          response200: new aws_cloudwatch.Metric({
            namespace: 'Uniswap',
            metricName: `GET_QUOTE_200_REQUEST_SOURCE: ${requestSource.toString()}`,
            dimensionsMap: { Service: 'RoutingAPI' },
            unit: aws_cloudwatch.Unit.COUNT,
            statistic: 'sum',
          }),
        },
      })
      const alarm = new aws_cloudwatch.Alarm(this, alarmName, {
        alarmName,
        metric,
        comparisonOperator: ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
        threshold: 95, // This is alarm will trigger if the SR is less than or equal to 95%
        evaluationPeriods: 2,
      })
      successRateByRequestSourceAlarm.push(alarm)
    })

    // Alarms for high 500 error rate for each request source and chain id
    const successRateByRequestSourceAndChainIdAlarm: cdk.aws_cloudwatch.Alarm[] = []
    REQUEST_SOURCES.forEach((requestSource) => {
      if (REQUEST_SOURCES_NOT_MONITORED.includes(requestSource)) {
        return
      }

      SUPPORTED_CHAINS.forEach((chainId) => {
        if (CHAINS_NOT_MONITORED.includes(chainId)) {
          return
        }
        const alarmName = `RoutingAPI-SEV3-SuccessRate-Alarm-RequestSource-ChainId: ${requestSource.toString()} ${chainId}`
        const metric = new MathExpression({
          expression: '100*(response200/(invocations-response400))',
          usingMetrics: {
            invocations: new aws_cloudwatch.Metric({
              namespace: 'Uniswap',
              metricName: `GET_QUOTE_REQUEST_SOURCE_AND_CHAINID: ${requestSource.toString()} ${chainId}`,
              dimensionsMap: { Service: 'RoutingAPI' },
              unit: aws_cloudwatch.Unit.COUNT,
              statistic: 'sum',
            }),
            response400: new aws_cloudwatch.Metric({
              namespace: 'Uniswap',
              metricName: `GET_QUOTE_400_REQUEST_SOURCE_AND_CHAINID: ${requestSource.toString()} ${chainId}`,
              dimensionsMap: { Service: 'RoutingAPI' },
              unit: aws_cloudwatch.Unit.COUNT,
              statistic: 'sum',
            }),
            response200: new aws_cloudwatch.Metric({
              namespace: 'Uniswap',
              metricName: `GET_QUOTE_200_REQUEST_SOURCE_AND_CHAINID: ${requestSource.toString()} ${chainId}`,
              dimensionsMap: { Service: 'RoutingAPI' },
              unit: aws_cloudwatch.Unit.COUNT,
              statistic: 'sum',
            }),
          },
        })
        const alarm = new aws_cloudwatch.Alarm(this, alarmName, {
          alarmName,
          metric,
          comparisonOperator: ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
          threshold: 95, // This is alarm will trigger if the SR is less than or equal to 95%
          evaluationPeriods: 2,
        })
        successRateByRequestSourceAndChainIdAlarm.push(alarm)
      })
    })

    if (chatbotSNSArn) {
      const chatBotTopic = aws_sns.Topic.fromTopicArn(this, 'ChatbotTopic', chatbotSNSArn)
      apiAlarm5xxSev2.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))
      apiAlarm4xxSev2.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))
      apiAlarmLatencySev2.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))
      apiAlarm5xxSev3.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))
      apiAlarm4xxSev3.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))
      apiAlarmLatencySev3.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))
      simulationAlarmSev3.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))

      percent4XXByChainAlarm.forEach((alarm) => {
        alarm.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))
      })
      successRateByChainAlarm.forEach((alarm) => {
        alarm.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))
      })
      successRateByRequestSourceAlarm.forEach((alarm) => {
        alarm.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))
      })
      successRateByRequestSourceAndChainIdAlarm.forEach((alarm) => {
        alarm.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))
      })
    }

    this.url = new CfnOutput(this, 'Url', {
      value: api.url,
    })
  }
}
