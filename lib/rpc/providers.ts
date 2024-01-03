import { ChainId } from '@uniswap/sdk-core'
import { SingleJsonRpcProvider } from './singleJsonRpcProvider'
import UniJsonRpcProvider from './uniJsonRpcProvider'

const INFURA_KEY = process.env.UNI_RPC_PROVIDER_INFURA_KEY
if (INFURA_KEY === undefined) {
  throw new Error(`UNI_RPC_PROVIDER_INFURA_KEY must be a defined environment variable`)
}
const QUICKNODE_MAINNET_RPC_URL = process.env.UNI_RPC_PROVIDER_QUICKNODE_MAINNET_RPC_URL
if (typeof QUICKNODE_MAINNET_RPC_URL === 'undefined') {
  throw new Error(`REACT_APP_QUICKNODE_MAINNET_RPC_URL must be a defined environment variable`)
}

export const PROVIDER_RPC_URL_RANKING: Partial<Record<ChainId, number[] | undefined>> = {
  [ChainId.MAINNET]: undefined,
}

export const PROVIDER_RPC_URL_WEIGHTS: Partial<Record<ChainId, number[] | undefined>> = {
  [ChainId.MAINNET]: undefined,
}

export const SINGLE_RPC_PROVIDERS: Partial<Record<ChainId, SingleJsonRpcProvider[]>> = {
  [ChainId.MAINNET]: [
    new SingleJsonRpcProvider(ChainId.MAINNET, `https://mainnet.infura.io/v3/${INFURA_KEY}`),
    new SingleJsonRpcProvider(ChainId.MAINNET, QUICKNODE_MAINNET_RPC_URL),
  ]
}

export const UNI_RPC_PROVIDERS: Partial<Record<ChainId, UniJsonRpcProvider>> = {
  [ChainId.MAINNET]: new UniJsonRpcProvider(
    ChainId.MAINNET,
    SINGLE_RPC_PROVIDERS[ChainId.MAINNET]!,
    PROVIDER_RPC_URL_RANKING[ChainId.MAINNET],
    PROVIDER_RPC_URL_WEIGHTS[ChainId.MAINNET])
}
