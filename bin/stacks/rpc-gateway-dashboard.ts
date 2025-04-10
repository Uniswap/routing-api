import { ChainId } from '@uniswap/sdk-core'
import * as cdk from 'aws-cdk-lib'
import * as aws_cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import { Construct } from 'constructs'
import _ from 'lodash'
import { ID_TO_NETWORK_NAME } from '@uniswap/smart-order-router/build/main/util/chains'
import { CallType, MAJOR_METHOD_NAMES } from '../../lib/rpc/SingleJsonRpcProvider'
import { SUPPORTED_CHAINS } from '../../lib/handlers/injector-sor'
import { TESTNETS } from '../../lib/util/testNets'
import { getRpcGatewayEnabledChains } from '../../lib/rpc/ProdConfig'
import { getProviderId } from '../../lib/rpc/utils'

const providerNameForChain: Map<ChainId, string[]> = getRpcGatewayEnabledChains()

function getProviderNameForChain(chainId: ChainId): string[] {
  if (!providerNameForChain.has(chainId)) {
    return []
  }
  const providerNames = providerNameForChain.get(chainId)!
  // Due to historical reason, we used 'QUIKNODE' rather than 'QUICKNODE' for metric names.
  return providerNames.map((name) => (name === 'QUICKNODE' ? 'QUIKNODE' : name))
}

function getSelectMetricsForChain(chainId: ChainId) {
  const metrics = []
  for (const providerName of getProviderNameForChain(chainId)) {
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

function getProviderDbHealthStateChangeForChain(chainId: ChainId) {
  const metrics = []
  for (const providerName of getProviderNameForChain(chainId)) {
    const providerId = getProviderId(chainId, providerName)
    metrics.push([
      'Uniswap',
      `RPC_GATEWAY_FALLBACK_${providerId}_INTO_UNHEALTHY`,
      'Service',
      'RoutingAPI',
      {
        id: `db_into_unhealthy_${chainId}_${providerName}`,
        label: `${providerName} DB into UNHEALTHY ${ID_TO_NETWORK_NAME(chainId)}`,
      },
    ])
    metrics.push([
      'Uniswap',
      `RPC_GATEWAY_FALLBACK_${providerId}_INTO_HEALTHY`,
      'Service',
      'RoutingAPI',
      {
        id: `db_into_healthy_${chainId}_${providerName}`,
        label: `${providerName} DB into HEALTHY ${ID_TO_NETWORK_NAME(chainId)}`,
      },
    ])
  }
  return metrics
}

function getLatencyMetricsForChain(chainId: ChainId) {
  const metrics = []
  for (const providerName of getProviderNameForChain(chainId)) {
    for (const methodName of MAJOR_METHOD_NAMES) {
      for (const callType in CallType) {
        metrics.push([
          'Uniswap',
          `RPC_GATEWAY_${chainId}_${providerName}_evaluated_${CallType[callType]}_latency_${methodName}`,
          'Service',
          'RoutingAPI',
          {
            id: `${methodName}_latency_${chainId}_${providerName}`,
            label: `${providerName} ${methodName} ${callType} latency on ${ID_TO_NETWORK_NAME(chainId)}`,
          },
        ])
      }
    }
  }
  return metrics
}

function getSuccessMetricsForChain(chainId: ChainId) {
  const metrics = []
  const methodNames = ['call', 'send', 'getGasPrice', 'getBlockNumber']
  for (const providerName of getProviderNameForChain(chainId)) {
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

function getFailedMetricsForChain(chainId: ChainId) {
  const metrics = []
  const methodNames = ['call', 'send', 'getGasPrice', 'getBlockNumber']
  for (const providerName of getProviderNameForChain(chainId)) {
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

function getDbSyncRequestedMetricsForChain(chainId: ChainId) {
  const metrics = []
  for (const providerName of getProviderNameForChain(chainId)) {
    metrics.push([
      'Uniswap',
      `RPC_GATEWAY_${chainId}_${providerName}_db_sync_REQUESTED`,
      'Service',
      'RoutingAPI',
      {
        id: `db_sync_success_${chainId}_${providerName}`,
        label: `${providerName} db sync requested ${ID_TO_NETWORK_NAME(chainId)}`,
      },
    ])
  }
  return metrics
}

function getDbSyncSampledMetricsForChain(chainId: ChainId) {
  const metrics = []
  for (const providerName of getProviderNameForChain(chainId)) {
    metrics.push([
      'Uniswap',
      `RPC_GATEWAY_${chainId}_${providerName}_db_sync_SAMPLED`,
      'Service',
      'RoutingAPI',
      {
        id: `db_sync_success_${chainId}_${providerName}`,
        label: `${providerName} db sync sampled ${ID_TO_NETWORK_NAME(chainId)}`,
      },
    ])
  }
  return metrics
}

function getDbSyncSuccessMetricsForChain(chainId: ChainId) {
  const metrics = []
  for (const providerName of getProviderNameForChain(chainId)) {
    metrics.push([
      'Uniswap',
      `RPC_GATEWAY_${chainId}_${providerName}_db_sync_SUCCESS`,
      'Service',
      'RoutingAPI',
      {
        id: `db_sync_success_${chainId}_${providerName}`,
        label: `${providerName} db sync success ${ID_TO_NETWORK_NAME(chainId)}`,
      },
    ])
  }
  return metrics
}

function getDbSyncFailMetricsForChain(chainId: ChainId) {
  const metrics = []
  for (const providerName of getProviderNameForChain(chainId)) {
    metrics.push([
      'Uniswap',
      `RPC_GATEWAY_${chainId}_${providerName}_db_sync_FAIL`,
      'Service',
      'RoutingAPI',
      {
        id: `db_sync_fail_${chainId}_${providerName}`,
        label: `${providerName} db sync fail ${ID_TO_NETWORK_NAME(chainId)}`,
      },
    ])
  }
  return metrics
}

function getCheckHealthMetricsForChain(chainId: ChainId) {
  const metrics = []
  for (const providerName of getProviderNameForChain(chainId)) {
    metrics.push([
      'Uniswap',
      `RPC_GATEWAY_${chainId}_${providerName}_check_health`,
      'Service',
      'RoutingAPI',
      {
        id: `check_health_${chainId}_${providerName}`,
        label: `${providerName} (Shadow) Check health for ${ID_TO_NETWORK_NAME(chainId)}`,
      },
    ])
  }
  return metrics
}

function getQuoteCountForChain(chainId: ChainId) {
  const metrics = []
  metrics.push([
    'Uniswap',
    `GET_QUOTE_REQUESTED_CHAINID: ${chainId}`,
    'Service',
    'RoutingAPI',
    {
      id: `quote_count_${chainId}`,
      label: `Quote request count for ${ID_TO_NETWORK_NAME(chainId)}`,
    },
  ])
  return metrics
}

function getRpcGatewayQuoteCountForChain(chainId: ChainId) {
  const metrics = []
  metrics.push([
    'Uniswap',
    `RPC_GATEWAY_GET_QUOTE_REQUESTED_CHAINID: ${chainId}`,
    'Service',
    'RoutingAPI',
    {
      id: `quote_count_${chainId}`,
      label: `Quote request count for ${ID_TO_NETWORK_NAME(chainId)} using RPC gateway`,
    },
  ])
  return metrics
}

function getQuoteLatencyForChain(chainId: ChainId) {
  const metrics = []
  metrics.push([
    'Uniswap',
    `GET_QUOTE_LATENCY_CHAIN_${chainId}`,
    'Service',
    'RoutingAPI',
    {
      id: `quote_latency_${chainId}`,
      label: `Quote latency for ${ID_TO_NETWORK_NAME(chainId)}`,
    },
  ])
  return metrics
}

function getRpcGatewayQuoteLatencyForChain(chainId: ChainId) {
  const metrics = []
  metrics.push([
    'Uniswap',
    `RPC_GATEWAY_GET_QUOTE_LATENCY_CHAIN_${chainId}`,
    'Service',
    'RoutingAPI',
    {
      id: `quote_latency_${chainId}`,
      label: `Quote latency for ${ID_TO_NETWORK_NAME(chainId)} using RPC gateway`,
    },
  ])
  return metrics
}

function getQuote5xxCountForChain(chainId: ChainId) {
  const metrics = []
  metrics.push([
    'Uniswap',
    `GET_QUOTE_500_CHAINID: ${chainId}`,
    'Service',
    'RoutingAPI',
    {
      id: `quote_5xx_count_${chainId}`,
      label: `Quote request 5xx count for ${ID_TO_NETWORK_NAME(chainId)}`,
    },
  ])
  return metrics
}

function getRpcGatewayQuote5xxCountForChain(chainId: ChainId) {
  const metrics = []
  metrics.push([
    'Uniswap',
    `RPC_GATEWAY_GET_QUOTE_500_CHAINID: ${chainId}`,
    'Service',
    'RoutingAPI',
    {
      id: `quote_5xx_count_${chainId}`,
      label: `Quote request 5xx count for ${ID_TO_NETWORK_NAME(chainId)} using RPC gateway`,
    },
  ])
  return metrics
}

export class RpcGatewayDashboardStack extends cdk.NestedStack {
  constructor(scope: Construct, name: string) {
    super(scope, name)

    const region = cdk.Stack.of(this).region
    const MAIN_NETWORKS = SUPPORTED_CHAINS.filter((chainId) => !TESTNETS.includes(chainId))
    const TEST_NETWORKS = SUPPORTED_CHAINS.filter((chainId) => TESTNETS.includes(chainId))

    const perChainWidgets: any[] = _.flatMap(MAIN_NETWORKS.concat(TEST_NETWORKS), (chainId) => [
      {
        type: 'text',
        width: 24,
        height: 1,
        properties: {
          markdown: `Metrics for ${ID_TO_NETWORK_NAME(chainId)}`,
        },
      },
      {
        height: 8,
        width: 24,
        type: 'metric',
        properties: {
          metrics: getQuoteCountForChain(chainId),
          view: 'timeSeries',
          stacked: false,
          region,
          stat: 'Sum',
          period: 300,
          title: `Quote count for ${ID_TO_NETWORK_NAME(chainId)}`,
          setPeriodToTimeRange: true,
          yAxis: {
            left: {
              showUnits: false,
              label: 'Occurrences',
            },
          },
        },
      },
      {
        height: 8,
        width: 24,
        type: 'metric',
        properties: {
          metrics: getRpcGatewayQuoteCountForChain(chainId),
          view: 'timeSeries',
          stacked: false,
          region,
          stat: 'Sum',
          period: 300,
          title: `Quote count for ${ID_TO_NETWORK_NAME(chainId)} using RPC gateway`,
          setPeriodToTimeRange: true,
          yAxis: {
            left: {
              showUnits: false,
              label: 'Occurrences',
            },
          },
        },
      },
      {
        height: 8,
        width: 24,
        type: 'metric',
        properties: {
          metrics: getQuote5xxCountForChain(chainId),
          view: 'timeSeries',
          stacked: false,
          region,
          stat: 'Sum',
          period: 300,
          title: `Quote 5xx count for ${ID_TO_NETWORK_NAME(chainId)}`,
          setPeriodToTimeRange: true,
          yAxis: {
            left: {
              showUnits: false,
              label: 'Occurrences',
            },
          },
        },
      },
      {
        height: 8,
        width: 24,
        type: 'metric',
        properties: {
          metrics: getRpcGatewayQuote5xxCountForChain(chainId),
          view: 'timeSeries',
          stacked: false,
          region,
          stat: 'Sum',
          period: 300,
          title: `Quote 5xx count for ${ID_TO_NETWORK_NAME(chainId)} using RPC gateway`,
          setPeriodToTimeRange: true,
          yAxis: {
            left: {
              showUnits: false,
              label: 'Occurrences',
            },
          },
        },
      },
      {
        height: 8,
        width: 24,
        type: 'metric',
        properties: {
          metrics: getQuoteLatencyForChain(chainId),
          view: 'timeSeries',
          stacked: false,
          region,
          stat: 'p99',
          period: 300,
          title: `Quote p99 latency for ${ID_TO_NETWORK_NAME(chainId)}`,
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
          metrics: getQuoteLatencyForChain(chainId),
          view: 'timeSeries',
          stacked: false,
          region,
          stat: 'p90',
          period: 300,
          title: `Quote p90 latency for ${ID_TO_NETWORK_NAME(chainId)}`,
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
          metrics: getQuoteLatencyForChain(chainId),
          view: 'timeSeries',
          stacked: false,
          region,
          stat: 'p50',
          period: 300,
          title: `Quote p50 latency for ${ID_TO_NETWORK_NAME(chainId)}`,
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
          metrics: getRpcGatewayQuoteLatencyForChain(chainId),
          view: 'timeSeries',
          stacked: false,
          region,
          stat: 'p99',
          period: 300,
          title: `Quote p99 latency for ${ID_TO_NETWORK_NAME(chainId)} using RPC gateway`,
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
          metrics: getRpcGatewayQuoteLatencyForChain(chainId),
          view: 'timeSeries',
          stacked: false,
          region,
          stat: 'p90',
          period: 300,
          title: `Quote p90 latency for ${ID_TO_NETWORK_NAME(chainId)} using RPC gateway`,
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
          metrics: getRpcGatewayQuoteLatencyForChain(chainId),
          view: 'timeSeries',
          stacked: false,
          region,
          stat: 'p50',
          period: 300,
          title: `Quote p50 latency for ${ID_TO_NETWORK_NAME(chainId)} using RPC gateway`,
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
          metrics: getProviderDbHealthStateChangeForChain(chainId),
          view: 'timeSeries',
          stacked: false,
          region,
          stat: 'Maximum',
          period: 300,
          title: `Provider DB health change for ${ID_TO_NETWORK_NAME(chainId)}`,
          setPeriodToTimeRange: true,
          yAxis: {
            left: {
              showUnits: false,
              label: 'DB health state changes',
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
      {
        height: 8,
        width: 24,
        type: 'metric',
        properties: {
          metrics: getDbSyncRequestedMetricsForChain(chainId),
          view: 'timeSeries',
          stacked: false,
          region,
          stat: 'Sum',
          period: 300,
          title: `DB sync requested for ${ID_TO_NETWORK_NAME(chainId)}`,
          setPeriodToTimeRange: true,
          yAxis: {
            left: {
              showUnits: false,
              label: 'Occurrences',
            },
          },
        },
      },
      {
        height: 8,
        width: 24,
        type: 'metric',
        properties: {
          metrics: getDbSyncSampledMetricsForChain(chainId),
          view: 'timeSeries',
          stacked: false,
          region,
          stat: 'Sum',
          period: 300,
          title: `DB sync sampled for ${ID_TO_NETWORK_NAME(chainId)}`,
          setPeriodToTimeRange: true,
          yAxis: {
            left: {
              showUnits: false,
              label: 'Occurrences',
            },
          },
        },
      },
      {
        height: 8,
        width: 24,
        type: 'metric',
        properties: {
          metrics: getDbSyncSuccessMetricsForChain(chainId),
          view: 'timeSeries',
          stacked: false,
          region,
          stat: 'Sum',
          period: 300,
          title: `DB sync success for ${ID_TO_NETWORK_NAME(chainId)}`,
          setPeriodToTimeRange: true,
          yAxis: {
            left: {
              showUnits: false,
              label: 'Occurrences',
            },
          },
        },
      },
      {
        height: 8,
        width: 24,
        type: 'metric',
        properties: {
          metrics: getDbSyncFailMetricsForChain(chainId),
          view: 'timeSeries',
          stacked: false,
          region,
          stat: 'Sum',
          period: 300,
          title: `DB sync fail for ${ID_TO_NETWORK_NAME(chainId)}`,
          setPeriodToTimeRange: true,
          yAxis: {
            left: {
              showUnits: false,
              label: 'Occurrences',
            },
          },
        },
      },
      {
        height: 8,
        width: 24,
        type: 'metric',
        properties: {
          metrics: getCheckHealthMetricsForChain(chainId),
          view: 'timeSeries',
          stacked: false,
          region,
          stat: 'Sum',
          period: 300,
          title: `(Shadow) Check health call for ${ID_TO_NETWORK_NAME(chainId)}`,
          setPeriodToTimeRange: true,
          yAxis: {
            left: {
              showUnits: false,
              label: 'Occurrences',
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
