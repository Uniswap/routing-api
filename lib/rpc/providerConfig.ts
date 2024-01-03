import { ChainId } from '@uniswap/sdk-core'

const INFURA_KEY = process.env.UNI_RPC_PROVIDER_INFURA_KEY
if (INFURA_KEY === undefined) {
  throw new Error(`UNI_RPC_PROVIDER_INFURA_KEY must be a defined environment variable`)
}
const QUICKNODE_MAINNET_RPC_URL = process.env.UNI_RPC_PROVIDER_QUICKNODE_MAINNET_RPC_URL
if (typeof QUICKNODE_MAINNET_RPC_URL === 'undefined') {
  throw new Error(`REACT_APP_QUICKNODE_MAINNET_RPC_URL must be a defined environment variable`)
}

export const PROVIDER_RPC_URLS = {
  [ChainId.MAINNET]: [
    `https://mainnet.infura.io/v3/${INFURA_KEY}`,
    QUICKNODE_MAINNET_RPC_URL,
  ],
}

export const PROVIDER_RPC_URL_WEIGHTS = {
  [ChainId.MAINNET]: undefined,
}
