import { ChainId } from '@uniswap/sdk-core'

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
    case ChainId.BNB:
      return 'smartchain'
    case ChainId.CELO:
      return 'celo'
    case ChainId.AVALANCHE:
      return 'avalanchec'
    case ChainId.BASE:
      return 'base'
    case ChainId.WORLDCHAIN:
      return 'worldchain'
    case ChainId.UNICHAIN_SEPOLIA:
      return 'unichain-sepolia'
    case ChainId.MONAD_TESTNET:
      return 'monad-testnet'
    case ChainId.BASE_SEPOLIA:
      return 'base-sepolia'
    case ChainId.UNICHAIN:
      return 'unichain'
    case ChainId.SONEIUM:
      return 'soneium'
    default:
      return 'ethereum'
  }
}

export function generateProviderUrl(key: string, value: string, chainId: number): string {
  switch (key) {
  
    // Alchemy
    case 'ALCHEMY_10': {
      return `https://opt-mainnet-fast.g.alchemy.com/v2/${value}`
    }
    case 'ALCHEMY_137': {
      return `https://polygon-mainnet-fast.g.alchemy.com/v2/${value}`
    }
    case 'ALCHEMY_8453': {
      return `https://base-mainnet-fast.g.alchemy.com/v2/${value}`
    }
    case 'ALCHEMY_11155111': {
      return `https://eth-sepolia.g.alchemy.com/v2/${value}`
    }
    case 'ALCHEMY_42161': {
      return `https://arb-mainnet.g.alchemy.com/v2/${value}`
    }
    case 'ALCHEMY_1': {
      return `https://eth-mainnet.g.alchemy.com/v2/${value}`
    }
    case 'ALCHEMY_324': {
      return `https://zksync-mainnet.g.alchemy.com/v2/${value}`
    }
    case 'ALCHEMY_1301': {
      return `https://unichain-sepolia.g.alchemy.com/v2/${value}`
    }
  }
  throw new Error(`Unknown provider-chainId pair: ${key}`)
}

export function getProviderId(chainId: ChainId, providerName: string): string {
  return `${chainId.toString()}_${providerName}`
}
