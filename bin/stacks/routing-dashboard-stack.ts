import { ChainId } from '@uniswap/smart-order-router'
import * as cdk from 'aws-cdk-lib'
import * as aws_cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import { Construct } from 'constructs'
import _ from 'lodash'
import { QuoteAmountsWidgetsFactory } from '../../lib/dashboards/quote-amounts-widgets-factory'
import { SUPPORTED_CHAINS } from '../../lib/handlers/injector-sor'
import { CachedRoutesWidgetsFactory } from '../../lib/dashboards/cached-routes-widgets-factory'
import { ID_TO_NETWORK_NAME } from '@uniswap/smart-order-router/build/main/util/chains'

export const NAMESPACE = 'Uniswap'

export type LambdaWidget = {
  type: string
  x: number
  y: number
  width: number
  height: number
  properties: { view: string; stacked: boolean; metrics: string[][]; region: string; title: string; stat: string }
}

export interface RoutingDashboardProps extends cdk.NestedStackProps {
  apiName: string
  routingLambdaName: string
  poolCacheLambdaNameArray: string[]
  ipfsPoolCacheLambdaName?: string
}

export class RoutingDashboardStack extends cdk.NestedStack {
  constructor(scope: Construct, name: string, props: RoutingDashboardProps) {
    super(scope, name, props)

    const { apiName, routingLambdaName, poolCacheLambdaNameArray, ipfsPoolCacheLambdaName } = props
    const region = cdk.Stack.of(this).region

    // No CDK resource exists for contributor insights at the moment so use raw CloudFormation.
    const REQUESTED_QUOTES_RULE_NAME = 'RequestedQuotes'
    const REQUESTED_QUOTES_BY_CHAIN_RULE_NAME = 'RequestedQuotesByChain'
    new cdk.CfnResource(this, 'QuoteContributorInsights', {
      type: 'AWS::CloudWatch::InsightRule',
      properties: {
        RuleBody: JSON.stringify({
          Schema: {
            Name: 'CloudWatchLogRule',
            Version: 1,
          },
          AggregateOn: 'Count',
          Contribution: {
            Filters: [
              {
                Match: '$.tokenPairSymbol',
                IsPresent: true,
              },
            ],
            Keys: ['$.tokenPairSymbol'],
          },
          LogFormat: 'JSON',
          LogGroupNames: [`/aws/lambda/${routingLambdaName}`],
        }),
        RuleName: REQUESTED_QUOTES_RULE_NAME,
        RuleState: 'ENABLED',
      },
    })

    new cdk.CfnResource(this, 'QuoteByChainContributorInsights', {
      type: 'AWS::CloudWatch::InsightRule',
      properties: {
        RuleBody: JSON.stringify({
          Schema: {
            Name: 'CloudWatchLogRule',
            Version: 1,
          },
          AggregateOn: 'Count',
          Contribution: {
            Filters: [
              {
                Match: '$.tokenPairSymbolChain',
                IsPresent: true,
              },
            ],
            Keys: ['$.tokenPairSymbolChain'],
          },
          LogFormat: 'JSON',
          LogGroupNames: [`/aws/lambda/${routingLambdaName}`],
        }),
        RuleName: REQUESTED_QUOTES_BY_CHAIN_RULE_NAME,
        RuleState: 'ENABLED',
      },
    })

    const poolCacheLambdaMetrics: string[][] = []
    poolCacheLambdaNameArray.forEach((poolCacheLambdaName) => {
      poolCacheLambdaMetrics.push(['AWS/Lambda', `${poolCacheLambdaName}Errors`, 'FunctionName', poolCacheLambdaName])
      poolCacheLambdaMetrics.push(['.', `${poolCacheLambdaName}Invocations`, '.', '.'])
    })
    new aws_cloudwatch.CfnDashboard(this, 'RoutingAPIDashboard', {
      dashboardName: `RoutingDashboard`,
      dashboardBody: JSON.stringify({
        periodOverride: 'inherit',
        widgets: [
          {
            height: 6,
            width: 24,
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
              title: 'Total Requests/Responses',
            },
          },
          {
            height: 6,
            width: 24,
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
              title: '5XX/4XX Error Rates',
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
            height: 8,
            width: 24,
            type: 'metric',
            properties: {
              metrics: SUPPORTED_CHAINS.map((chainId) => [
                NAMESPACE,
                `GET_QUOTE_REQUESTED_CHAINID: ${chainId}`,
                'Service',
                'RoutingAPI',
                { id: `mreqc${chainId}`, label: `Requests on ${ID_TO_NETWORK_NAME(chainId)}` },
              ]),
              view: 'timeSeries',
              stacked: false,
              region,
              stat: 'Sum',
              period: 300,
              title: 'Requests by Chain',
              setPeriodToTimeRange: true,
              yAxis: {
                left: {
                  showUnits: false,
                  label: 'Requests',
                },
              },
            },
          },
          {
            type: 'metric',
            width: 12,
            height: 8,
            properties: {
              view: 'timeSeries',
              stacked: false,
              metrics: _.flatMap(SUPPORTED_CHAINS, (chainId) => [
                [
                  NAMESPACE,
                  `GET_QUOTE_LATENCY_CHAIN_${chainId}`,
                  'Service',
                  'RoutingAPI',
                  { stat: 'p99.99', label: `${ID_TO_NETWORK_NAME(chainId)} P99.99` },
                ],
                ['...', { stat: 'p99.9', label: `${ID_TO_NETWORK_NAME(chainId)} P99.9` }],
                ['...', { stat: 'p99', label: `${ID_TO_NETWORK_NAME(chainId)} P99` }],
                ['...', { stat: 'p95', label: `${ID_TO_NETWORK_NAME(chainId)} P95` }],
                ['...', { stat: 'p90', label: `${ID_TO_NETWORK_NAME(chainId)} P90` }],
              ]),
              region,
              title: `P9X Latency by Chain`,
              period: 300,
              setPeriodToTimeRange: true,
              stat: 'SampleCount',
              yAxis: {
                left: {
                  min: 0,
                  showUnits: false,
                  label: 'Milliseconds',
                },
              },
            },
          },
          {
            type: 'metric',
            width: 12,
            height: 8,
            properties: {
              view: 'timeSeries',
              stacked: false,
              metrics: _.flatMap(SUPPORTED_CHAINS, (chainId) => [
                [
                  NAMESPACE,
                  `GET_QUOTE_LATENCY_CHAIN_${chainId}`,
                  'Service',
                  'RoutingAPI',
                  { stat: 'p50', label: `${ID_TO_NETWORK_NAME(chainId)} Median` },
                ],
                ['...', { stat: 'Average', label: `${ID_TO_NETWORK_NAME(chainId)} Average` }],
                ['...', { stat: 'Minimum', label: `${ID_TO_NETWORK_NAME(chainId)} Minimum` }],
              ]),
              region,
              title: `Average and Minimum Latency by Chain`,
              period: 300,
              setPeriodToTimeRange: true,
              stat: 'SampleCount',
              yAxis: {
                left: {
                  min: 0,
                  showUnits: false,
                  label: 'Milliseconds',
                },
              },
            },
          },
          {
            height: 6,
            width: 24,
            type: 'metric',
            properties: {
              metrics: _.flatMap(SUPPORTED_CHAINS, (chainId) => [
                [
                  {
                    expression: `(m200c${chainId} / (mreqc${chainId} - m400c${chainId})) * 100`,
                    label: `Success Rate on ${ID_TO_NETWORK_NAME(chainId)}`,
                    id: `e1c${chainId}`,
                  },
                ],
                [
                  NAMESPACE,
                  `GET_QUOTE_REQUESTED_CHAINID: ${chainId}`,
                  'Service',
                  'RoutingAPI',
                  { id: `mreqc${chainId}`, label: `Requests on Chain ${chainId}`, visible: false },
                ],
                [
                  '.',
                  `GET_QUOTE_200_CHAINID: ${chainId}`,
                  '.',
                  '.',
                  { id: `m200c${chainId}`, label: `2XX Requests on Chain ${chainId}`, visible: false },
                ],
                [
                  '.',
                  `GET_QUOTE_400_CHAINID: ${chainId}`,
                  '.',
                  '.',
                  { id: `m400c${chainId}`, label: `4XX Errors on Chain ${chainId}`, visible: false },
                ],
              ]),
              view: 'timeSeries',
              stacked: false,
              region,
              stat: 'Sum',
              period: 300,
              title: 'Success Rates by Chain',
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
            type: 'metric',
            properties: {
              metrics: _.flatMap(SUPPORTED_CHAINS, (chainId) => [
                [
                  {
                    expression: `(m500c${chainId} / mreqc${chainId}) * 100`,
                    label: `5XX Error Rate on ${ID_TO_NETWORK_NAME(chainId)}`,
                    id: `e1c${chainId}`,
                  },
                ],
                [
                  {
                    expression: `(m400c${chainId} / mreqc${chainId}) * 100`,
                    label: `4XX Error Rate on ${ID_TO_NETWORK_NAME(chainId)}`,
                    id: `e2c${chainId}`,
                  },
                ],
                [
                  NAMESPACE,
                  `GET_QUOTE_REQUESTED_CHAINID: ${chainId}`,
                  'Service',
                  'RoutingAPI',
                  { id: `mreqc${chainId}`, label: `Requests on Chain ${chainId}`, visible: false },
                ],
                [
                  '.',
                  `GET_QUOTE_500_CHAINID: ${chainId}`,
                  '.',
                  '.',
                  { id: `m500c${chainId}`, label: `5XX Errors on Chain ${chainId}`, visible: false },
                ],
                [
                  '.',
                  `GET_QUOTE_400_CHAINID: ${chainId}`,
                  '.',
                  '.',
                  { id: `m400c${chainId}`, label: `4XX Errors on Chain ${chainId}`, visible: false },
                ],
              ]),
              view: 'timeSeries',
              stacked: false,
              region,
              stat: 'Sum',
              period: 300,
              title: '5XX/4XX Error Rates by Chain',
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
            type: 'metric',
            properties: {
              metrics: [['AWS/ApiGateway', 'Latency', 'ApiName', apiName]],
              view: 'timeSeries',
              stacked: false,
              region,
              period: 300,
              stat: 'p90',
              title: 'Latency p90',
            },
          },
          {
            type: 'metric',
            width: 24,
            height: 6,
            properties: {
              view: 'timeSeries',
              stacked: false,
              metrics: [
                [NAMESPACE, 'QuotesFetched', 'Service', 'RoutingAPI'],
                [NAMESPACE, 'V3QuotesFetched', 'Service', 'RoutingAPI'],
                [NAMESPACE, 'V2QuotesFetched', 'Service', 'RoutingAPI'],
                [NAMESPACE, 'MixedQuotesFetched', 'Service', 'RoutingAPI'],
              ],
              region,
              title: 'p90 Quotes Fetched Per Swap',
              period: 300,
              stat: 'p90',
            },
          },
          {
            type: 'metric',
            width: 24,
            height: 6,
            properties: {
              view: 'timeSeries',
              stacked: false,
              insightRule: {
                maxContributorCount: 25,
                orderBy: 'Sum',
                ruleName: REQUESTED_QUOTES_RULE_NAME,
              },
              legend: {
                position: 'bottom',
              },
              region,
              title: 'Requested Quotes',
              period: 300,
              stat: 'Sum',
            },
          },
          {
            type: 'metric',
            width: 24,
            height: 6,
            properties: {
              view: 'timeSeries',
              stacked: false,
              insightRule: {
                maxContributorCount: 25,
                orderBy: 'Sum',
                ruleName: REQUESTED_QUOTES_BY_CHAIN_RULE_NAME,
              },
              legend: {
                position: 'bottom',
              },
              region,
              title: 'Requested Quotes By Chain',
              period: 300,
              stat: 'Sum',
            },
          },
          {
            type: 'metric',
            width: 24,
            height: 6,
            properties: {
              view: 'timeSeries',
              stacked: false,
              metrics: [
                [NAMESPACE, 'MixedAndV3AndV2SplitRoute', 'Service', 'RoutingAPI'],
                [NAMESPACE, 'MixedAndV3SplitRoute', 'Service', 'RoutingAPI'],
                [NAMESPACE, 'MixedAndV2SplitRoute', 'Service', 'RoutingAPI'],
                [NAMESPACE, 'MixedSplitRoute', 'Service', 'RoutingAPI'],
                [NAMESPACE, 'MixedRoute', 'Service', 'RoutingAPI'],
                [NAMESPACE, 'V3AndV2SplitRoute', 'Service', 'RoutingAPI'],
                [NAMESPACE, 'V3SplitRoute', 'Service', 'RoutingAPI'],
                [NAMESPACE, 'V3Route', 'Service', 'RoutingAPI'],
                [NAMESPACE, 'V2SplitRoute', 'Service', 'RoutingAPI'],
                [NAMESPACE, 'V2Route', 'Service', 'RoutingAPI'],
              ],
              region,
              title: 'Types of routes returned across all chains',
              period: 300,
              stat: 'Sum',
            },
          },
          {
            type: 'metric',
            width: 24,
            height: 6,
            properties: {
              view: 'timeSeries',
              stacked: false,
              metrics: _.flatMap(SUPPORTED_CHAINS, (chainId: ChainId) => [
                [NAMESPACE, `MixedAndV3AndV2SplitRouteForChain${chainId}`, 'Service', 'RoutingAPI'],
                [NAMESPACE, `MixedAndV3SplitRouteForChain${chainId}`, 'Service', 'RoutingAPI'],
                [NAMESPACE, `MixedAndV2SplitRouteForChain${chainId}`, 'Service', 'RoutingAPI'],
                [NAMESPACE, `MixedSplitRouteForChain${chainId}`, 'Service', 'RoutingAPI'],
                [NAMESPACE, `MixedRouteForChain${chainId}`, 'Service', 'RoutingAPI'],
                [NAMESPACE, `V3AndV2SplitRouteForChain${chainId}`, 'Service', 'RoutingAPI'],
                [NAMESPACE, `V3SplitRouteForChain${chainId}`, 'Service', 'RoutingAPI'],
                [NAMESPACE, `V3RouteForChain${chainId}`, 'Service', 'RoutingAPI'],
                [NAMESPACE, `V2SplitRouteForChain${chainId}`, 'Service', 'RoutingAPI'],
                [NAMESPACE, `V2RouteForChain${chainId}`, 'Service', 'RoutingAPI'],
              ]),
              region,
              title: 'Types of V3 routes returned by chain',
              period: 300,
              stat: 'Sum',
            },
          },
          {
            type: 'metric',
            width: 24,
            height: 6,
            properties: {
              metrics: _.flatMap(SUPPORTED_CHAINS, (chainId: ChainId) => [
                ['Uniswap', `QuoteFoundForChain${chainId}`, 'Service', 'RoutingAPI'],
                ['Uniswap', `QuoteRequestedForChain${chainId}`, 'Service', 'RoutingAPI'],
              ]),
              view: 'timeSeries',
              stacked: false,
              stat: 'Sum',
              period: 300,
              region,
              title: 'Quote Requested/Found by Chain',
            },
          },
          {
            height: 12,
            width: 24,
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
                ['.', 'MixedQuotesLoad', '.', '.', { color: '#fefa63' }],
                ['.', 'V2QuotesLoad', '.', '.', { color: '#7f7f7f' }],
                ['.', 'FindBestSwapRoute', '.', '.', { color: '#d62728' }],
              ],
              view: 'timeSeries',
              stacked: true,
              region,
              stat: 'p90',
              period: 300,
              title: 'Latency Breakdown',
            },
          },
          {
            type: 'metric',
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
              title: 'p95 V3 Top N Pools Used From Sources in Best Route',
              stat: 'p95',
            },
          },
          {
            type: 'metric',
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
              title: 'p95 V2 Top N Pools Used From Sources in Best Route',
              stat: 'p95',
            },
          },
          {
            type: 'metric',
            width: 24,
            height: 9,
            properties: {
              view: 'timeSeries',
              stacked: false,
              metrics: [
                ['AWS/Lambda', 'ProvisionedConcurrentExecutions', 'FunctionName', routingLambdaName],
                ['.', 'ConcurrentExecutions', '.', '.'],
                ['.', 'ProvisionedConcurrencySpilloverInvocations', '.', '.'],
              ],
              region: region,
              title: 'Routing Lambda Provisioned Concurrency',
              stat: 'Average',
            },
          },
          {
            type: 'metric',
            width: 24,
            height: 9,
            properties: {
              view: 'timeSeries',
              stacked: false,
              metrics: [
                ...poolCacheLambdaMetrics,
                ...(ipfsPoolCacheLambdaName
                  ? [
                      ['AWS/Lambda', 'Errors', 'FunctionName', ipfsPoolCacheLambdaName],
                      ['.', 'Invocations', '.', '.'],
                    ]
                  : []),
              ],
              region: region,
              title: 'Pool Cache Lambda Error/Invocations',
              stat: 'Sum',
            },
          },
        ],
      }),
    })

    const quoteAmountsWidgets = new QuoteAmountsWidgetsFactory(NAMESPACE, region)
    new aws_cloudwatch.CfnDashboard(this, 'RoutingAPITrackedPairsDashboard', {
      dashboardName: 'RoutingAPITrackedPairsDashboard',
      dashboardBody: JSON.stringify({
        periodOverride: 'inherit',
        widgets: quoteAmountsWidgets.generateWidgets(),
      }),
    })

    const cachedRoutesWidgets = new CachedRoutesWidgetsFactory(NAMESPACE, region, routingLambdaName)
    new aws_cloudwatch.CfnDashboard(this, 'CachedRoutesPerformanceDashboard', {
      dashboardName: 'CachedRoutesPerformanceDashboard',
      dashboardBody: JSON.stringify({
        periodOverride: 'inherit',
        widgets: cachedRoutesWidgets.generateWidgets(),
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
              title: 'Number of retries to provider needed to get quote',
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
