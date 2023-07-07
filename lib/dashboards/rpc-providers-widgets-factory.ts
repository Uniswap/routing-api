import { WidgetsFactory } from './core/widgets-factory'
import { Widget } from './core/model/widget'
import { ChainId } from '@uniswap/sdk-core'
import _ from 'lodash'
import { ID_TO_NETWORK_NAME } from '@uniswap/smart-order-router/build/main/util/chains'
import { ProviderName } from '../handlers/evm/provider/ProviderName'

const ID_TO_PROVIDER = (id: ChainId): string => {
  switch (id) {
    case ChainId.MAINNET:
    case ChainId.OPTIMISM:
    case ChainId.SEPOLIA:
    case ChainId.POLYGON:
    case ChainId.POLYGON_MUMBAI:
    case ChainId.ARBITRUM_ONE:
    case ChainId.ARBITRUM_GOERLI:
    case ChainId.AVALANCHE:
    case ChainId.GOERLI:
      return ProviderName.INFURA
    case ChainId.CELO:
    case ChainId.BNB:
      return ProviderName.QUIKNODE
    case ChainId.CELO_ALFAJORES:
      return ProviderName.FORNO
    default:
      return ProviderName.UNKNOWN
  }
}

export class RpcProvidersWidgetsFactory implements WidgetsFactory {
  region: string
  namespace: string
  chains: Array<ChainId>

  constructor(namespace: string, region: string, chains: Array<ChainId>) {
    this.namespace = namespace
    this.region = region
    this.chains = chains
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
      const providerName = ID_TO_PROVIDER(chainId)

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
