import * as aws_cloudwatch from '@aws-cdk/aws-cloudwatch'
import * as cdk from '@aws-cdk/core'

export const NAMESPACE = 'Uniswap'

export interface RoutingDashboardProps extends cdk.NestedStackProps {
  apiName: string
  lambdaName: string
}

export class RoutingDashboardStack extends cdk.NestedStack {
  constructor(scope: cdk.Construct, name: string, props: RoutingDashboardProps) {
    super(scope, name, props)

    const { apiName, lambdaName } = props
    const region = cdk.Stack.of(this).region

    new aws_cloudwatch.CfnDashboard(this, 'RoutingAPIDashboard', {
      dashboardName: `RoutingDashboard`,
      dashboardBody: JSON.stringify({
        periodOverride: 'inherit',
        widgets: [
          {
            height: 6,
            width: 24,
            y: 0,
            x: 0,
            type: 'metric',
            properties: {
              metrics: [
                ['AWS/ApiGateway', 'Count', 'ApiName', apiName, { label: 'Requests' }],
                ['.', '5XXError', '.', '.', { label: '5XXError Responses', color: '#ff7f0e' }],
                ['.', '4XXError', '.', '.', { label: '4XXError Responses', color: '#2ca02c' }],
              ],
              view: 'timeSeries',
              stacked: false,
              region,
              stat: 'Sum',
              period: 300,
              title: 'Total Requests/Responses | 5min',
            },
          },
          {
            height: 6,
            width: 24,
            y: 6,
            x: 0,
            type: 'metric',
            properties: {
              metrics: [
                [
                  {
                    expression: 'm1 * 100',
                    label: '5XX Error Rate',
                    id: 'e1',
                    color: '#ff7f0e',
                  },
                ],
                [
                  {
                    expression: 'm2 * 100',
                    label: '4XX Error Rate',
                    id: 'e2',
                    color: '#2ca02c',
                  },
                ],
                [
                  'AWS/ApiGateway',
                  '5XXError',
                  'ApiName',
                  'Routing API',
                  { id: 'm1', label: '5XXError', visible: false },
                ],
                ['.', '4XXError', '.', '.', { id: 'm2', visible: false }],
              ],
              view: 'timeSeries',
              stacked: false,
              region,
              stat: 'Average',
              period: 300,
              title: '5XX/4XX Error Rates | 5min',
              setPeriodToTimeRange: true,
              yAxis: {
                left: {
                  showUnits: false,
                  label: '%',
                },
              },
            },
          },
          {
            height: 6,
            width: 24,
            y: 12,
            x: 0,
            type: 'metric',
            properties: {
              metrics: [['AWS/ApiGateway', 'Latency', 'ApiName', apiName]],
              view: 'timeSeries',
              stacked: false,
              region,
              period: 300,
              stat: 'p90',
              title: 'Latency p90 | 5min',
            },
          },
          {
            type: 'metric',
            x: 0,
            y: 18,
            width: 24,
            height: 6,
            properties: {
              view: 'timeSeries',
              stacked: false,
              metrics: [[NAMESPACE, 'QuotesFetched', 'Service', 'RoutingAPI']],
              region,
              title: 'p90 Quotes Fetched Per Swap',
              period: 300,
              stat: 'p90',
            },
          },
          {
            height: 12,
            width: 24,
            y: 24,
            x: 0,
            type: 'metric',
            properties: {
              metrics: [
                [NAMESPACE, 'TokenListLoad', 'Service', 'RoutingAPI', { color: '#c5b0d5' }],
                ['.', 'GasPriceLoad', '.', '.', { color: '#17becf' }],
                ['.', 'V3PoolsLoad', '.', '.', { color: '#e377c2' }],
                ['.', 'V2PoolsLoad', '.', '.', { color: '#e377c2' }],
                ['.', 'V3SubgraphPoolsLoad', '.', '.', { color: '#1f77b4' }],
                ['.', 'V2SubgraphPoolsLoad', '.', '.', { color: '#bf77b4' }],
                ['.', 'V3QuotesLoad', '.', '.', { color: '#2ca02c' }],
                ['.', 'V2QuotesLoad', '.', '.', { color: '#5ca02c' }],
                ['.', 'FindBestSwapRoute', '.', '.', { color: '#d62728' }],
              ],
              view: 'timeSeries',
              stacked: true,
              region,
              stat: 'p90',
              period: 300,
              title: 'Latency Breakdown | 5min',
            },
          },
          {
            type: 'metric',
            x: 0,
            y: 30,
            width: 24,
            height: 9,
            properties: {
              view: 'timeSeries',
              stacked: false,
              metrics: [
                [NAMESPACE, 'V3top2directswappool', 'Service', 'RoutingAPI'],
                ['.', 'V3top2ethquotetokenpool', '.', '.'],
                ['.', 'V3topbytvl', '.', '.'],
                ['.', 'V3topbytvlusingtokenin', '.', '.'],
                ['.', 'V3topbytvlusingtokeninsecondhops', '.', '.'],
                ['.', 'V2topbytvlusingtokenout', '.', '.'],
                ['.', 'V3topbytvlusingtokenoutsecondhops', '.', '.'],
                ['.', 'V3topbybasewithtokenin', '.', '.'],
                ['.', 'V3topbybasewithtokenout', '.', '.'],
              ],
              region: region,
              title: 'p95 V3 Top N Pools Used From Sources in Best Route | 5min',
              stat: 'p95',
            },
          },
          {
            type: 'metric',
            x: 0,
            y: 39,
            width: 24,
            height: 9,
            properties: {
              view: 'timeSeries',
              stacked: false,
              metrics: [
                [NAMESPACE, 'V2top2directswappool', 'Service', 'RoutingAPI'],
                ['.', 'V2top2ethquotetokenpool', '.', '.'],
                ['.', 'V2topbytvl', '.', '.'],
                ['.', 'V2topbytvlusingtokenin', '.', '.'],
                ['.', 'V2topbytvlusingtokeninsecondhops', '.', '.'],
                ['.', 'V2topbytvlusingtokenout', '.', '.'],
                ['.', 'V2topbytvlusingtokenoutsecondhops', '.', '.'],
                ['.', 'V2topbybasewithtokenin', '.', '.'],
                ['.', 'V2topbybasewithtokenout', '.', '.'],
              ],
              region: region,
              title: 'p95 V2 Top N Pools Used From Sources in Best Route | 5min',
              stat: 'p95',
            },
          },
          {
            type: 'metric',
            x: 0,
            y: 48,
            width: 24,
            height: 9,
            properties: {
              view: 'timeSeries',
              stacked: false,
              metrics: [
                ['AWS/Lambda', 'ProvisionedConcurrentExecutions', 'FunctionName', lambdaName],
                ['.', 'ConcurrentExecutions', '.', '.'],
                ['.', 'ProvisionedConcurrencySpilloverInvocations', '.', '.'],
              ],
              region: region,
              title: 'Routing Lambda Provisioned Concurrency | 5min',
              stat: 'Average',
            },
          },
        ],
      }),
    })

    new aws_cloudwatch.CfnDashboard(this, 'RoutingAPIQuoteProviderDashboard', {
      dashboardName: `RoutingQuoteProviderDashboard`,
      dashboardBody: JSON.stringify({
        periodOverride: 'inherit',
        widgets: [
          {
            height: 6,
            width: 24,
            y: 0,
            x: 0,
            type: 'metric',
            properties: {
              metrics: [[NAMESPACE, 'QuoteApproxGasUsedPerSuccessfulCall', 'Service', 'RoutingAPI']],
              view: 'timeSeries',
              stacked: false,
              region,
              stat: 'Average',
              period: 300,
              title: 'Approx gas used by each call',
            },
          },
          {
            height: 6,
            width: 24,
            y: 6,
            x: 0,
            type: 'metric',
            properties: {
              metrics: [
                [NAMESPACE, 'QuoteTotalCallsToProvider', 'Service', 'RoutingAPI'],
                ['.', 'QuoteExpectedCallsToProvider', '.', '.'],
                ['.', 'QuoteNumRetriedCalls', '.', '.'],
                ['.', 'QuoteNumRetryLoops', '.', '.'],
              ],
              view: 'timeSeries',
              stacked: false,
              region,
              stat: 'Average',
              period: 300,
              title: 'Number of callsretries to provider needed to get quote',
            },
          },
          {
            height: 6,
            width: 24,
            y: 12,
            x: 0,
            type: 'metric',
            properties: {
              metrics: [
                [NAMESPACE, 'QuoteOutOfGasExceptionRetry', 'Service', 'RoutingAPI'],
                ['.', 'QuoteSuccessRateRetry', '.', '.'],
                ['.', 'QuoteBlockHeaderNotFoundRetry', '.', '.'],
                ['.', 'QuoteTimeoutRetry', '.', '.'],
                ['.', 'QuoteUnknownReasonRetry', '.', '.'],
                ['.', 'QuoteBlockConflictErrorRetry', '.', '.'],
              ],
              view: 'timeSeries',
              stacked: false,
              region,
              period: 300,
              stat: 'Sum',
              title: 'Number of requests that retried in the quote provider',
            },
          },
        ],
      }),
    })
  }
}
