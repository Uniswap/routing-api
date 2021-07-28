import * as aws_apigateway from '@aws-cdk/aws-apigateway';
import { MethodLoggingLevel } from '@aws-cdk/aws-apigateway';
import * as aws_logs from '@aws-cdk/aws-logs';
import * as aws_waf from '@aws-cdk/aws-wafv2';
import * as cdk from '@aws-cdk/core';
import { CfnOutput } from '@aws-cdk/core';
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
      provisionedConcurrency: number;
      throttlingOverride?: string;
      ethGasStationInfoUrl: string;
    }
  ) {
    super(parent, name, props);

    const { poolCacheBucket, poolCacheKey, tokenListCacheBucket } =
      new RoutingCachingStack(this, 'RoutingCachingStack');

    const {
      nodeRPC,
      nodeRPCUsername,
      nodeRPCPassword,
      provisionedConcurrency,
      throttlingOverride,
      ethGasStationInfoUrl,
    } = props;

    const { routingLambda, routingLambdaAlias } = new RoutingLambdaStack(
      this,
      'RoutingLambdaStack',
      {
        poolCacheBucket,
        poolCacheKey,
        nodeRPC,
        nodeRPCUsername,
        nodeRPCPassword,
        tokenListCacheBucket,
        provisionedConcurrency,
        ethGasStationInfoUrl,
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

    /* const ipThrottlingACL =  */ new aws_waf.CfnWebACL(
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

    /*     const region = cdk.Stack.of(this).region;
    const apiArn = `arn:aws:apigateway:${region}::/restapis/${api.restApiId}/stages/${api.deploymentStage.stageName}`;

    new aws_waf.CfnWebACLAssociation(
      this,
      'RoutingAPIIPThrottlingAssociation',
      {
        resourceArn: apiArn,
        webAclArn: ipThrottlingACL.getAtt('Arn').toString(),
      }
    ); */

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

    this.url = new CfnOutput(this, 'Url', {
      value: api.url,
    });
  }
}
