import { ChainId } from '@uniswap/sdk-core'
import * as cdk from 'aws-cdk-lib'
import * as aws_cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import { Construct } from 'constructs'
import _ from 'lodash'
import { ID_TO_NETWORK_NAME } from '@uniswap/smart-order-router/build/main/util/chains'

const providerForChain: Map<ChainId, string[]> = new Map([
  [ChainId.AVALANCHE, ['INFURA', 'QUIKNODE', 'NIRVANA']],
  [ChainId.OPTIMISM, ['INFURA', 'QUIKNODE', 'NIRVANA', 'ALCHEMY']],
])

function getSelectMetricsForChain(chainId: ChainId) {
  const metrics = []
  for (const providerName of providerForChain.get(chainId)!) {
    metrics.push([
      'Uniswap',
      `RPC_GATEWAY_${chainId}_${providerName}_selected`,
      'Service',
      'RoutingAPI',
      {
        id: `select_count_${chainId}_${providerName}`,
        label: `${providerName} selected on ${ID_TO_NETWORK_NAME(chainId)}`,
      },
    ])
  }
  return metrics
}

function getHealthScoreMetricsForChain(chainId: ChainId) {
  const metrics = []
  for (const providerName of providerForChain.get(chainId)!) {
    metrics.push([
      'Uniswap',
      `RPC_GATEWAY_${chainId}_${providerName}_health_score`,
      'Service',
      'RoutingAPI',
      {
        id: `health_score_${chainId}_${providerName}`,
        label: `${providerName} health score on ${ID_TO_NETWORK_NAME(chainId)}`,
      },
    ])
  }
  return metrics
}

function getLatencyMetricsForChain(chainId: ChainId) {
  const metrics = []
  for (const providerName of providerForChain.get(chainId)!) {
    metrics.push([
      'Uniswap',
      `RPC_GATEWAY_${chainId}_${providerName}_evaluated_latency_getBlockNumber`,
      'Service',
      'RoutingAPI',
      {
        id: `getBlockNumber_latency_${chainId}_${providerName}`,
        label: `${providerName} getBlockNumber latency on ${ID_TO_NETWORK_NAME(chainId)}`,
      },
    ])
    metrics.push([
      'Uniswap',
      `RPC_GATEWAY_${chainId}_${providerName}_evaluated_latency_call`,
      'Service',
      'RoutingAPI',
      {
        id: `call_latency_${chainId}_${providerName}`,
        label: `${providerName} call latency on ${ID_TO_NETWORK_NAME(chainId)}`,
      },
    ])
  }
  return metrics
}

export class RpcGatewayDashboardStack extends cdk.NestedStack {
  constructor(scope: Construct, name: string) {
    super(scope, name)

    const region = cdk.Stack.of(this).region
    const NETWORKS = [ChainId.AVALANCHE, ChainId.OPTIMISM]

    const perChainWidgets: any[] = _.flatMap(NETWORKS, (chainId) => [
      {
        height: 8,
        width: 24,
        type: 'metric',
        properties: {
          metrics: getSelectMetricsForChain(chainId),
          view: 'timeSeries',
          stacked: false,
          region,
          stat: 'Sum',
          period: 300,
          title: `Provider selection for ${ID_TO_NETWORK_NAME(chainId)}`,
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
        height: 8,
        width: 24,
        type: 'metric',
        properties: {
          metrics: getHealthScoreMetricsForChain(chainId),
          view: 'timeSeries',
          stacked: false,
          region,
          stat: 'Maximum',
          period: 300,
          title: `Provider (negative) health score for ${ID_TO_NETWORK_NAME(chainId)}`,
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
        height: 8,
        width: 24,
        type: 'metric',
        properties: {
          metrics: getLatencyMetricsForChain(chainId),
          view: 'timeSeries',
          stacked: false,
          region,
          stat: 'p99',
          period: 300,
          title: `Provider p99 latency for ${ID_TO_NETWORK_NAME(chainId)}`,
          setPeriodToTimeRange: true,
          yAxis: {
            left: {
              showUnits: false,
              label: 'Requests',
            },
          },
        },
      },
    ])

    new aws_cloudwatch.CfnDashboard(this, 'RpcGatewayDashboard', {
      dashboardName: `RpcGatewayDashboard`,
      dashboardBody: JSON.stringify({
        periodOverride: 'inherit',
        widgets: perChainWidgets,
      }),
    })
  }
}
