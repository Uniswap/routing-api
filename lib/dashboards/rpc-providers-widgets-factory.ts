import { WidgetsFactory } from './core/widgets-factory'
import { Widget } from './core/model/widget'
import { ChainId } from '@uniswap/sdk-core'
import { deriveProviderName } from '../handlers/evm/provider/ProviderName'
import { getRPCEndpoint } from '../../test/utils/getRPCEndpoint'
import _ from 'lodash'

export class RpcProvidersWidgetsFactory implements WidgetsFactory {
  region: string
  namespace: string
  chains: Array<ChainId>

  constructor(namespace: string, region: string, chains: Array<ChainId>) {
    this.region = region
    this.namespace = namespace
    this.chains = chains
  }

  generateWidgets(): Widget[] {
    return _.flatMap(this.chains, chainId => {
      const url = getRPCEndpoint(chainId)
      const providerName = deriveProviderName(url)

      return {
        type: "metric",
        width: 24,
        height: 7,
        properties: {
          metrics: [
            [ { expression: "m1 / (m1 + m2) * 100", label: `RPC ${providerName} Chain ${chainId} Success Rate`, id: "e1" } ],
            [ this.namespace, `RPC_${providerName}_${chainId}_CALL_SUCCESS`, "Service", "RoutingAPI", { id: "m1", visible: false } ],
            [ this.namespace, `RPC_${providerName}_${chainId}_CALL_FAILURE`, "Service", "RoutingAPI", { id: "m2", visible: false } ]
          ],
          view: "timeSeries",
          stacked: false,
          region: this.region,
          "stat": "SampleCount",
          "period": 300,
          "title": "RPC Calls Success Rate"
        }
      }
    })
  }
}