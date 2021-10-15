import * as aws_apigateway from '@aws-cdk/aws-apigateway';
import { MethodLoggingLevel } from '@aws-cdk/aws-apigateway';
import * as aws_cloudwatch from '@aws-cdk/aws-cloudwatch';
import * as aws_cloudwatch_actions from '@aws-cdk/aws-cloudwatch-actions';
import * as aws_logs from '@aws-cdk/aws-logs';
import * as aws_sns from '@aws-cdk/aws-sns';
import * as aws_waf from '@aws-cdk/aws-wafv2';
import * as cdk from '@aws-cdk/core';
import { CfnOutput, Duration } from '@aws-cdk/core';
import { RoutingCachingStack } from './routing-caching-stack';
import { RoutingDashboardStack } from './routing-dashboard-stack';
import { RoutingLambdaStack } from './routing-lambda-stack';

export class RoutingAPIStack extends cdk.Stack {
  public readonly url: CfnOutput;

  constructor(
    parent: cdk.Construct,
    name: string,
    props: cdk.StackProps & {
      nodeRPC: string;
      nodeRPCUsername: string;
      nodeRPCPassword: string;
      nodeRPCRinkeby: string;
      nodeRPCUsernameRinkeby: string;
      nodeRPCPasswordRinkeby: string;
      provisionedConcurrency: number;
      throttlingOverride?: string;
      ethGasStationInfoUrl: string;
      chatbotSNSArn?: string;
      stage: string;
      route53Arn?: string;
      pinata_key?: string;
      pinata_secret?: string;
      hosted_zone?: string;
    }
  ) {
    super(parent, name, props);

    const {
      nodeRPC,
      nodeRPCUsername,
      nodeRPCPassword,
      nodeRPCRinkeby,
      nodeRPCUsernameRinkeby,
      nodeRPCPasswordRinkeby,
      provisionedConcurrency,
      throttlingOverride,
      ethGasStationInfoUrl,
      chatbotSNSArn,
      stage,
      route53Arn,
      pinata_key,
      pinata_secret,
      hosted_zone,
    } = props;

    const { poolCacheBucket, poolCacheKey, tokenListCacheBucket } =
      new RoutingCachingStack(this, 'RoutingCachingStack', {
        chatbotSNSArn,
        stage,
        route53Arn,
        pinata_key,
        pinata_secret,
        hosted_zone,
      });

    const { routingLambda, routingLambdaAlias, routeToRatioLambda } = new RoutingLambdaStack(
      this,
      'RoutingLambdaStack',
      {
        poolCacheBucket,
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
      }
    );

    const accessLogGroup = new aws_logs.LogGroup(this, 'RoutingAPIGAccessLogs');

    const api = new aws_apigateway.RestApi(this, 'routing-api', {
      restApiName: 'Routing API',
      deployOptions: {
        tracingEnabled: true,
        loggingLevel: MethodLoggingLevel.ERROR,
        accessLogDestination: new aws_apigateway.LogGroupLogDestination(
          accessLogGroup
        ),
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
    });

    const ipThrottlingACL = new aws_waf.CfnWebACL(
      this,
      'RoutingAPIIPThrottlingACL',
      {
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
      }
    );

    const region = cdk.Stack.of(this).region;
    const apiArn = `arn:aws:apigateway:${region}::/restapis/${api.restApiId}/stages/${api.deploymentStage.stageName}`;

    new aws_waf.CfnWebACLAssociation(
      this,
      'RoutingAPIIPThrottlingAssociation',
      {
        resourceArn: apiArn,
        webAclArn: ipThrottlingACL.getAtt('Arn').toString(),
      }
    );

    new RoutingDashboardStack(this, 'RoutingDashboardStack', {
      apiName: api.restApiName,
      lambdaName: routingLambda.functionName,
    });

    const lambdaIntegration = new aws_apigateway.LambdaIntegration(
      routingLambdaAlias
    );

    const quote = api.root.addResource('quote', {
      defaultCorsPreflightOptions: {
        allowOrigins: aws_apigateway.Cors.ALL_ORIGINS,
        allowMethods: aws_apigateway.Cors.ALL_METHODS,
      },
    });
    quote.addMethod('GET', lambdaIntegration);


    const routeToRatioLambdaIntegration = new aws_apigateway.LambdaIntegration(
      routeToRatioLambda
    );

    const quoteToRatio = api.root.addResource('quoteToRatio', {
      defaultCorsPreflightOptions: {
        allowOrigins: aws_apigateway.Cors.ALL_ORIGINS,
        allowMethods: aws_apigateway.Cors.ALL_METHODS,
      },
    });
    quoteToRatio.addMethod('GET', routeToRatioLambdaIntegration);


    const apiAlarm5xx = new aws_cloudwatch.Alarm(this, 'RoutingAPI-5XXAlarm', {
      metric: api.metricServerError({
        period: Duration.minutes(5),
        statistic: 'avg',
      }),
      threshold: 0.05,
      evaluationPeriods: 3,
    });

    const apiAlarm4xx = new aws_cloudwatch.Alarm(this, 'RoutingAPI-4XXAlarm', {
      metric: api.metricClientError({
        period: Duration.minutes(5),
        statistic: 'avg',
      }),
      threshold: 0.8,
      evaluationPeriods: 3,
    });

    const apiAlarmLatency = new aws_cloudwatch.Alarm(
      this,
      'RoutingAPI-Latency',
      {
        metric: api.metricLatency({
          period: Duration.minutes(5),
          statistic: 'p90',
        }),
        threshold: 5000,
        evaluationPeriods: 3,
      }
    );

    if (chatbotSNSArn) {
      const chatBotTopic = aws_sns.Topic.fromTopicArn(
        this,
        'ChatbotTopic',
        chatbotSNSArn
      );
      apiAlarm5xx.addAlarmAction(
        new aws_cloudwatch_actions.SnsAction(chatBotTopic)
      );
      apiAlarm4xx.addAlarmAction(
        new aws_cloudwatch_actions.SnsAction(chatBotTopic)
      );
      apiAlarmLatency.addAlarmAction(
        new aws_cloudwatch_actions.SnsAction(chatBotTopic)
      );
    }

    this.url = new CfnOutput(this, 'Url', {
      value: api.url,
    });
  }
}
