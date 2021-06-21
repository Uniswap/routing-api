import * as cdk from 'aws-cdk-lib';
import { aws_cloudwatch, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export const NAMESPACE = 'Uniswap';

export interface RoutingDashboardProps extends cdk.NestedStackProps {
  apiName: string;
}

export class RoutingDashboardStack extends cdk.NestedStack {
  constructor(scope: Construct, name: string, props: RoutingDashboardProps) {
    super(scope, name, props);

    const { apiName } = props;
    const region = Stack.of(this).region;

    new aws_cloudwatch.CfnDashboard(this, 'RoutingAPIDashboard', {
      dashboardName: 'RoutingDashboard',
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
                [
                  'AWS/ApiGateway',
                  'Count',
                  'ApiName',
                  apiName,
                  { label: 'Requests' },
                ],
                ['.', '5XXError', '.', '.', { label: '5XXError Responses' }],
                ['.', '4XXError', '.', '.', { label: '4XXError Responses' }],
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
                [{ expression: 'm1 * 100', label: '5XX Error Rate', id: 'e1' }],
                [{ expression: 'm2 * 100', label: '4XX Error Rate', id: 'e2' }],
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
              title: 'Average Quotes Fetched Per Swap',
              period: 300,
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
                [
                  NAMESPACE,
                  'TokenListLoad',
                  'Service',
                  'RoutingAPI',
                  { color: '#c5b0d5' },
                ],
                ['.', 'GasPriceLoad', '.', '.', { color: '#17becf' }],
                ['.', 'PoolsLoad', '.', '.', { color: '#e377c2' }],
                ['.', 'SubgraphPoolsLoad', '.', '.', { color: '#1f77b4' }],
                ['.', 'FindBestSwapRoute', '.', '.', { color: '#d62728' }],
                ['.', 'QuotesLoad', '.', '.', { color: '#2ca02c' }],
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
                [NAMESPACE, 'Top2directswappool', 'Service', 'RoutingAPI'],
                ['.', 'Top2ethquotetokenpool', '.', '.'],
                ['.', 'Topbytvl', '.', '.'],
                ['.', 'Topbytvlusingtokenin', '.', '.'],
                ['.', 'Topbytvlusingtokeninsecondhops', '.', '.'],
                ['.', 'Topbytvlusingtokenout', '.', '.'],
                ['.', 'Topbytvlusingtokenoutsecondhops', '.', '.'],
              ],
              region: region,
              title: 'Top N Pools Used From Sources in Best Route | 5min',
              stat: 'Maximum',
            },
          },
        ],
      }),
    });
  }
}
