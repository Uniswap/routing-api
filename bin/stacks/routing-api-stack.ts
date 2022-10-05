import { ChainId, SUPPORTED_CHAINS } from '@uniswap/smart-order-router'
import * as cdk from 'aws-cdk-lib'
import { CfnOutput, Duration } from 'aws-cdk-lib'
import * as aws_apigateway from 'aws-cdk-lib/aws-apigateway'
import { MethodLoggingLevel } from 'aws-cdk-lib/aws-apigateway'
import * as aws_cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import { MathExpression } from 'aws-cdk-lib/aws-cloudwatch'
import * as aws_cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions'
import * as aws_logs from 'aws-cdk-lib/aws-logs'
import * as aws_sns from 'aws-cdk-lib/aws-sns'
import * as aws_waf from 'aws-cdk-lib/aws-wafv2'
import { Construct } from 'constructs'
import { STAGE } from '../../lib/util/stage'
import { RoutingCachingStack } from './routing-caching-stack'
import { RoutingDashboardStack } from './routing-dashboard-stack'
import { RoutingLambdaStack } from './routing-lambda-stack'

export const CHAINS_NOT_MONITORED: ChainId[] = [
  ChainId.RINKEBY,
  ChainId.ARBITRUM_RINKEBY,
  ChainId.ROPSTEN,
  ChainId.KOVAN,
  ChainId.OPTIMISTIC_KOVAN,
  ChainId.GÖRLI,
  ChainId.POLYGON_MUMBAI,
]

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
      route53Arn?: string
      pinata_key?: string
      pinata_secret?: string
      hosted_zone?: string
      tenderlyUser: string
      tenderlyProject: string
      tenderlyAccessKey: string
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
      route53Arn,
      pinata_key,
      pinata_secret,
      hosted_zone,
      tenderlyUser,
      tenderlyProject,
      tenderlyAccessKey,
    } = props

    const {
      poolCacheBucket,
      poolCacheBucket2,
      poolCacheKey,
      tokenListCacheBucket,
      poolCacheLambda,
      ipfsPoolCachingLambda,
    } = new RoutingCachingStack(this, 'RoutingCachingStack', {
      chatbotSNSArn,
      stage,
      route53Arn,
      pinata_key,
      pinata_secret,
      hosted_zone,
    })

    const { routingLambda, routingLambdaAlias, routeToRatioLambda } = new RoutingLambdaStack(
      this,
      'RoutingLambdaStack',
      {
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
      }
    )

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
      poolCacheLambdaName: poolCacheLambda.functionName,
      ipfsPoolCacheLambdaName: ipfsPoolCachingLambda ? ipfsPoolCachingLambda.functionName : undefined,
    })

    const lambdaIntegration = new aws_apigateway.LambdaIntegration(routingLambdaAlias)

    const quote = api.root.addResource('quote', {
      defaultCorsPreflightOptions: {
        allowOrigins: aws_apigateway.Cors.ALL_ORIGINS,
        allowMethods: aws_apigateway.Cors.ALL_METHODS,
      },
    })
    quote.addMethod('GET', lambdaIntegration)

    const routeToRatioLambdaIntegration = new aws_apigateway.LambdaIntegration(routeToRatioLambda)

    const quoteToRatio = api.root.addResource('quoteToRatio', {
      defaultCorsPreflightOptions: {
        allowOrigins: aws_apigateway.Cors.ALL_ORIGINS,
        allowMethods: aws_apigateway.Cors.ALL_METHODS,
      },
    })
    quoteToRatio.addMethod('GET', routeToRatioLambdaIntegration)

    // All alarms default to GreaterThanOrEqualToThreshold for when to be triggered.
    const apiAlarm5xxSev2 = new aws_cloudwatch.Alarm(this, 'RoutingAPI-SEV2-5XXAlarm', {
      alarmName: 'RoutingAPI-SEV2-5XX',
      metric: api.metricServerError({
        period: Duration.minutes(5),
        // For this metric 'avg' represents error rate.
        statistic: 'avg',
      }),
      threshold: 0.05,
      // Beta has much less traffic so is more susceptible to transient errors.
      evaluationPeriods: stage == STAGE.BETA ? 5 : 3,
    })

    const apiAlarm4xxSev2 = new aws_cloudwatch.Alarm(this, 'RoutingAPI-SEV2-4XXAlarm', {
      alarmName: 'RoutingAPI-SEV2-4XX',
      metric: api.metricClientError({
        period: Duration.minutes(5),
        statistic: 'avg',
      }),
      threshold: 0.95,
      evaluationPeriods: 3,
    })

    const apiAlarmLatencySev2 = new aws_cloudwatch.Alarm(this, 'RoutingAPI-SEV2-Latency', {
      alarmName: 'RoutingAPI-SEV2-Latency',
      metric: api.metricLatency({
        period: Duration.minutes(5),
        statistic: 'p90',
      }),
      threshold: 8500,
      evaluationPeriods: 3,
    })

    const apiAlarm5xxSev3 = new aws_cloudwatch.Alarm(this, 'RoutingAPI-SEV3-5XXAlarm', {
      alarmName: 'RoutingAPI-SEV3-5XX',
      metric: api.metricServerError({
        period: Duration.minutes(5),
        // For this metric 'avg' represents error rate.
        statistic: 'avg',
      }),
      threshold: 0.03,
      // Beta has much less traffic so is more susceptible to transient errors.
      evaluationPeriods: stage == STAGE.BETA ? 5 : 3,
    })

    const apiAlarm4xxSev3 = new aws_cloudwatch.Alarm(this, 'RoutingAPI-SEV3-4XXAlarm', {
      alarmName: 'RoutingAPI-SEV3-4XX',
      metric: api.metricClientError({
        period: Duration.minutes(5),
        statistic: 'avg',
      }),
      threshold: 0.8,
      evaluationPeriods: 3,
    })

    const apiAlarmLatencySev3 = new aws_cloudwatch.Alarm(this, 'RoutingAPI-SEV3-Latency', {
      alarmName: 'RoutingAPI-SEV3-Latency',
      metric: api.metricLatency({
        period: Duration.minutes(5),
        statistic: 'p90',
      }),
      threshold: 5500,
      evaluationPeriods: 3,
    })

    const simulationAlarmSev2 = new aws_cloudwatch.Alarm(this, 'RoutingAPI-SEV2-Simulation', {
      alarmName: 'RoutingAPI-SEV2-Simulation',
      metric: new MathExpression({
        expression: '100*(simulationFailed/simulationRequested)',
        usingMetrics: {
          simulationRequested: new aws_cloudwatch.Metric({
            namespace: 'Uniswap',
            metricName: `Simulation Requested`,
            dimensionsMap: { Service: 'RoutingAPI' },
            unit: aws_cloudwatch.Unit.COUNT,
            period: Duration.minutes(5),
            statistic: 'sum',
          }),
          simulationFailed: new aws_cloudwatch.Metric({
            namespace: 'Uniswap',
            metricName: `SimulationFailed`,
            dimensionsMap: { Service: 'RoutingAPI' },
            unit: aws_cloudwatch.Unit.COUNT,
            period: Duration.minutes(5),
            statistic: 'sum',
          }),
        },
      }),
      threshold: 40,
      evaluationPeriods: 2,
    })

    const simulationAlarmSev3 = new aws_cloudwatch.Alarm(this, 'RoutingAPI-SEV3-Simulation', {
      alarmName: 'RoutingAPI-SEV3-Simulation',
      metric: new MathExpression({
        expression: '100*(simulationFailed/simulationRequested)',
        usingMetrics: {
          simulationRequested: new aws_cloudwatch.Metric({
            namespace: 'Uniswap',
            metricName: `Simulation Requested`,
            dimensionsMap: { Service: 'RoutingAPI' },
            unit: aws_cloudwatch.Unit.COUNT,
            period: Duration.minutes(5),
            statistic: 'sum',
          }),
          simulationFailed: new aws_cloudwatch.Metric({
            namespace: 'Uniswap',
            metricName: `SimulationFailed`,
            dimensionsMap: { Service: 'RoutingAPI' },
            unit: aws_cloudwatch.Unit.COUNT,
            period: Duration.minutes(5),
            statistic: 'sum',
          }),
        },
      }),
      threshold: 20,
      evaluationPeriods: 2,
    })

    // Alarms for 200 rate being too low for each chain
    const percent2XXByChainAlarm: cdk.aws_cloudwatch.Alarm[] = []
    SUPPORTED_CHAINS.forEach((chainId) => {
      if (CHAINS_NOT_MONITORED.includes(chainId)) {
        return
      }
      const alarmName = `RoutingAPI-SEV3-2XXAlarm-ChainId: ${chainId.toString()}`
      const metric = new MathExpression({
        expression: '100*(response200/invocations)',
        usingMetrics: {
          invocations: new aws_cloudwatch.Metric({
            namespace: 'Uniswap',
            metricName: `GET_QUOTE_REQUESTED_CHAINID: ${chainId.toString()}`,
            dimensionsMap: { Service: 'RoutingAPI' },
            unit: aws_cloudwatch.Unit.COUNT,
            period: Duration.minutes(5),
            statistic: 'sum',
          }),
          response200: new aws_cloudwatch.Metric({
            namespace: 'Uniswap',
            metricName: `GET_QUOTE_200_CHAINID: ${chainId.toString()}`,
            dimensionsMap: { Service: 'RoutingAPI' },
            unit: aws_cloudwatch.Unit.COUNT,
            period: Duration.minutes(5),
            statistic: 'sum',
          }),
        },
      })
      const alarm = new aws_cloudwatch.Alarm(this, alarmName, {
        alarmName,
        metric,
        threshold: 20,
        evaluationPeriods: 2,
        comparisonOperator: aws_cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
      })
      percent2XXByChainAlarm.push(alarm)
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
          invocations: api.metric(`GET_QUOTE_REQUESTED_CHAINID: ${chainId.toString()}`, {
            period: Duration.minutes(5),
            statistic: 'sum',
          }),
          response400: api.metric(`GET_QUOTE_400_CHAINID: ${chainId.toString()}`, {
            period: Duration.minutes(5),
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

    if (chatbotSNSArn) {
      const chatBotTopic = aws_sns.Topic.fromTopicArn(this, 'ChatbotTopic', chatbotSNSArn)
      apiAlarm5xxSev2.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))
      apiAlarm4xxSev2.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))
      apiAlarmLatencySev2.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))
      apiAlarm5xxSev3.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))
      apiAlarm4xxSev3.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))
      apiAlarmLatencySev3.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))
      simulationAlarmSev2.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))
      simulationAlarmSev3.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))

      percent2XXByChainAlarm.forEach((alarm) => {
        alarm.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))
      })
      percent4XXByChainAlarm.forEach((alarm) => {
        alarm.addAlarmAction(new aws_cloudwatch_actions.SnsAction(chatBotTopic))
      })
    }

    this.url = new CfnOutput(this, 'Url', {
      value: api.url,
    })
  }
}
