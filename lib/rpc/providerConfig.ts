// chain id to provider ids
// no actual RpcProvider object here

import { ChainId } from '@uniswap/sdk-core'
import UniJsonRpcProvider from './uniJsonRpcProvider'

const INFURA_KEY = 'TODO(jie)'
const QUICKNODE_MAINNET_RPC_URL = 'TODO(jie)'

const PROVIDER_RPC_URLS = {
  [ChainId.MAINNET]: [
    `https://mainnet.infura.io/v3/${INFURA_KEY}`,
    QUICKNODE_MAINNET_RPC_URL,
  ],
  [ChainId.OPTIMISM]: [
    `https://optimism-mainnet.infura.io/v3/${INFURA_KEY}`
  ],
}

export const RPC_PROVIDERS = {
  [ChainId.MAINNET]: new UniJsonRpcProvider(ChainId.MAINNET, PROVIDER_RPC_URLS[ChainId.MAINNET]),
  [ChainId.OPTIMISM]: new UniJsonRpcProvider(ChainId.MAINNET, PROVIDER_RPC_URLS[ChainId.OPTIMISM]),
}