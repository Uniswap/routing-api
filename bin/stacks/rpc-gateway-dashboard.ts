import { ChainId } from '@uniswap/sdk-core'
import * as cdk from 'aws-cdk-lib'
import * as aws_cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import { Construct } from 'constructs'
import _ from 'lodash'
import { ID_TO_NETWORK_NAME } from '@uniswap/smart-order-router/build/main/util/chains'

const providerForChain: Map<ChainId, string[]> = new Map([
  [ChainId.AVALANCHE, ['INFURA', 'QUIKNODE', 'NIRVANA']],
  [ChainId.OPTIMISM, ['INFURA', 'QUIKNODE', 'NIRVANA', 'ALCHEMY']],
  [ChainId.CELO, ['INFURA', 'QUIKNODE']],
  [ChainId.BNB, ['QUIKNODE']],
  [ChainId.POLYGON, ['INFURA', 'QUIKNODE', 'ALCHEMY']],
  [ChainId.BASE, ['INFURA', 'QUIKNODE', 'ALCHEMY', 'NIRVANA']],
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

function getSuccessMetricsForChain(chainId: ChainId) {
  const metrics = []
  const methodNames = ['call', 'send', 'getGasPrice', 'getBlockNumber']
  for (const providerName of providerForChain.get(chainId)!) {
    for (const methodName of methodNames) {
      metrics.push([
        'Uniswap',
        `RPC_GATEWAY_${chainId}_${providerName}_${methodName}_SUCCESS`,
        'Service',
        'RoutingAPI',
        {
          id: `${methodName}_success_${chainId}_${providerName}`,
          label: `${providerName} ${methodName} success on ${ID_TO_NETWORK_NAME(chainId)}`,
        },
      ])
    }
  }
  return metrics
}

function getHighLatencyMetricsForChain(chainId: ChainId) {
  const metrics = []
  const methodNames = ['call', 'send', 'getGasPrice', 'getBlockNumber']
  for (const providerName of providerForChain.get(chainId)!) {
    for (const methodName of methodNames) {
      metrics.push([
        'Uniswap',
        `RPC_GATEWAY_${chainId}_${providerName}_${methodName}_SUCCESS_HIGH_LATENCY`,
        'Service',
        'RoutingAPI',
        {
          id: `${methodName}_high_latency_${chainId}_${providerName}`,
          label: `${providerName} ${methodName} high latency on ${ID_TO_NETWORK_NAME(chainId)}`,
        },
      ])
    }
  }
  return metrics
}

function getFailedMetricsForChain(chainId: ChainId) {
  const metrics = []
  const methodNames = ['call', 'send', 'getGasPrice', 'getBlockNumber']
  for (const providerName of providerForChain.get(chainId)!) {
    for (const methodName of methodNames) {
      metrics.push([
        'Uniswap',
        `RPC_GATEWAY_${chainId}_${providerName}_${methodName}_FAILED`,
        'Service',
        'RoutingAPI',
        {
          id: `${methodName}_failed_${chainId}_${providerName}`,
          label: `${providerName} ${methodName} failed on ${ID_TO_NETWORK_NAME(chainId)}`,
        },
      ])
    }
  }
  return metrics
}

export class RpcGatewayDashboardStack extends cdk.NestedStack {
  constructor(scope: Construct, name: string) {
    super(scope, name)

    const region = cdk.Stack.of(this).region
    const NETWORKS = [ChainId.AVALANCHE, ChainId.OPTIMISM, ChainId.CELO, ChainId.BNB, ChainId.POLYGON, ChainId.BASE]

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
              label: 'Score (in negative)',
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
              label: 'Ms',
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
          stat: 'p90',
          period: 300,
          title: `Provider p90 latency for ${ID_TO_NETWORK_NAME(chainId)}`,
          setPeriodToTimeRange: true,
          yAxis: {
            left: {
              showUnits: false,
              label: 'Ms',
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
          stat: 'p50',
          period: 300,
          title: `Provider p50 latency for ${ID_TO_NETWORK_NAME(chainId)}`,
          setPeriodToTimeRange: true,
          yAxis: {
            left: {
              showUnits: false,
              label: 'Ms',
            },
          },
        },
      },
      {
        height: 8,
        width: 24,
        type: 'metric',
        properties: {
          metrics: getHighLatencyMetricsForChain(chainId),
          view: 'timeSeries',
          stacked: false,
          region,
          stat: 'Sum',
          period: 300,
          title: `Provider high latency occurrence for ${ID_TO_NETWORK_NAME(chainId)}`,
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
          metrics: getFailedMetricsForChain(chainId),
          view: 'timeSeries',
          stacked: false,
          region,
          stat: 'Sum',
          period: 300,
          title: `Provider failed occurrence for ${ID_TO_NETWORK_NAME(chainId)}`,
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
          metrics: getSuccessMetricsForChain(chainId),
          view: 'timeSeries',
          stacked: false,
          region,
          stat: 'Sum',
          period: 300,
          title: `Provider success occurrence for ${ID_TO_NETWORK_NAME(chainId)}`,
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
