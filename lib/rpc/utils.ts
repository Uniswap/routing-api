import { ChainId } from '@juiceswapxyz/sdk-core'

export function chainIdToNetworkName(networkId: ChainId): string {
  switch (networkId) {
    case ChainId.MAINNET:
      return 'ethereum'
    case ChainId.ARBITRUM_ONE:
      return 'arbitrum'
    case ChainId.OPTIMISM:
      return 'optimism'
    case ChainId.POLYGON:
      return 'polygon'
    case ChainId.BASE:
      return 'base'
    case ChainId.SEPOLIA:
      return 'sepolia'
    default:
      return 'ethereum'
  }
}

export function generateProviderUrl(key: string, value: string): string {
  const tokens = value.split(',')
  switch (key) {
    // Alchemy - Core EVM Networks Only
    case 'ALCHEMY_1': {
      return `https://eth-mainnet-fast.g.alchemy.com/v2/${tokens[0]}`
    }
    case 'ALCHEMY_10': {
      return `https://opt-mainnet-fast.g.alchemy.com/v2/${tokens[0]}`
    }
    case 'ALCHEMY_137': {
      return `https://polygon-mainnet-fast.g.alchemy.com/v2/${tokens[0]}`
    }
    case 'ALCHEMY_8453': {
      return `https://base-mainnet-fast.g.alchemy.com/v2/${tokens[0]}`
    }
    case 'ALCHEMY_42161': {
      return `https://arb-mainnet-fast.g.alchemy.com/v2/${tokens[0]}`
    }
    case 'ALCHEMY_11155111': {
      return `https://eth-sepolia-fast.g.alchemy.com/v2/${tokens[0]}`
    }
    case 'ALCHEMY_5115': {
      return `http://vm-dfx-node-prd.westeurope.cloudapp.azure.com:8085`
    }
  }
  throw new Error(`Unknown provider-chainId pair: ${key}`)
}

export function getProviderId(chainId: ChainId, providerName: string): string {
  return `${chainId.toString()}_${providerName}`
}
