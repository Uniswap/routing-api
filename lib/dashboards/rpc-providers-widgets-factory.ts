import { WidgetsFactory } from './core/widgets-factory'
import { Widget } from './core/model/widget'
import { ChainId } from '@uniswap/sdk-core'
import { deriveProviderName } from '../handlers/evm/provider/ProviderName'
import _ from 'lodash'
import { ID_TO_NETWORK_NAME } from '@uniswap/smart-order-router/build/main/util/chains'

export class RpcProvidersWidgetsFactory implements WidgetsFactory {
  region: string
  namespace: string
  chains: Array<ChainId>
  jsonRpcProviders: { [chainName: string]: string }

  constructor(
    namespace: string,
    region: string,
    chains: Array<ChainId>,
    jsonRpcProviders: { [chainName: string]: string }
  ) {
    this.namespace = namespace
    this.region = region
    this.chains = chains
    this.jsonRpcProviders = jsonRpcProviders
  }

  generateWidgets(): Widget[] {
    return this.generateSuccessRatePerMethod('CALL')
      .concat(this.generateSuccessRatePerMethod('GETBLOCKNUMBER'))
      .concat(this.generateSuccessRatePerMethod('GETGASPRICE'))
      .concat(this.generateSuccessRatePerMethod('GETNETWORK'))
      .concat(this.generateSuccessRatePerMethod('RESOLVENAME'))
  }

  private generateSuccessRatePerMethod(rpcMethod: string): Widget[] {
    const chainsWithIndices = this.chains.map((chainId, index) => {
      return { chainId: chainId, index: index }
    })
    const metrics = _.flatMap(chainsWithIndices, (chainIdAndIndex) => {
      const chainId = chainIdAndIndex.chainId
      const index = chainIdAndIndex.index
      const url = this.jsonRpcProviders[`WEB3_RPC_${chainId.toString()}`]!
      if (url === undefined) return []
      const providerName = deriveProviderName(url)

      const metric1 = `m${index * 2 + 1}`
      const metric2 = `m${index * 2 + 2}`
      const expression = `e${index}`

      return [
        [
          {
            expression: `${metric1} / (${metric1} + ${metric2}) * 100`,
            label: `RPC ${providerName} Chain ${ID_TO_NETWORK_NAME(chainId)} ${rpcMethod} Success Rate`,
            id: expression,
          },
        ],
        [
          this.namespace,
          `RPC_${providerName}_${chainId}_${rpcMethod}_SUCCESS`,
          'Service',
          'RoutingAPI',
          {
            id: metric1,
            visible: false,
          },
        ],
        [
          this.namespace,
          `RPC_${providerName}_${chainId}_${rpcMethod}_FAILURE`,
          'Service',
          'RoutingAPI',
          {
            id: metric2,
            visible: false,
          },
        ],
      ]
    })

    return [
      {
        height: 6,
        width: 12,
        type: 'metric',
        properties: {
          metrics: metrics,
          view: 'timeSeries',
          stacked: false,
          region: this.region,
          stat: 'SampleCount',
          period: 300,
          title: `RPC ${rpcMethod} Success Rate`,
        },
      },
    ]
  }
}
