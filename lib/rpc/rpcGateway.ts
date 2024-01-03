import { ChainId } from '@uniswap/sdk-core'
import UniJsonRpcProvider from './uniJsonRpcProvider'
import { PROVIDER_RPC_URL_WEIGHTS, PROVIDER_RPC_URLS } from './providerConfig'

export const UNI_RPC_PROVIDERS: {[key in ChainId]?: UniJsonRpcProvider} = {
  [ChainId.MAINNET]: new UniJsonRpcProvider(ChainId.MAINNET, PROVIDER_RPC_URLS[ChainId.MAINNET], PROVIDER_RPC_URL_WEIGHTS[ChainId.MAINNET]),
}
