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
    default:
      return 'ethereum'
  }
}

export function generateProviderUrl(key: string, value: string): string {
  const tokens = value.split(',')
  switch (key) {
    // Infura
    case 'INFURA_43114': {
      return `https://avalanche-mainnet.infura.io/v3/${tokens[0]}`
    }
    case 'INFURA_10': {
      return `https://optimism-mainnet.infura.io/v3/${tokens[0]}`
    }
    case 'INFURA_42220': {
      return `https://celo-mainnet.infura.io/v3/${tokens[0]}`
    }
    case 'INFURA_137': {
      return `https://polygon-mainnet.infura.io/v3/${tokens[0]}`
    }
    case 'INFURA_8453': {
      return `https://base-mainnet.infura.io/v3/${tokens[0]}`
    }
    case 'INFURA_11155111': {
      return `https://sepolia.infura.io/v3/${tokens[0]}`
    }
    case 'INFURA_42161': {
      return `https://arbitrum-mainnet.infura.io/v3/${tokens[0]}`
    }
    case 'INFURA_1': {
      return `https://mainnet.infura.io/v3/${tokens[0]}`
    }
    case 'INFURA_81457': {
      return `https://blast-mainnet.infura.io/v3/${tokens[0]}`
    }
    // Nirvana
    case 'NIRVANA_43114': {
      return `https://avax.nirvanalabs.xyz/${tokens[0]}/ext/bc/C/rpc?apikey=${tokens[1]}`
    }
    case 'NIRVANA_10': {
      return `https://optimism.nirvanalabs.xyz/${tokens[0]}?apikey=${tokens[1]}`
    }
    case 'NIRVANA_8453': {
      return `https://base.nirvanalabs.xyz/${tokens[0]}?apikey=${tokens[1]}`
    }
    case 'NIRVANA_42161': {
      return `https://arb.nirvanalabs.xyz/${tokens[0]}?apikey=${tokens[1]}`
    }
    case 'NIRVANA_1': {
      return `https://ethereum.nirvanalabs.xyz/${tokens[0]}?apikey=${tokens[1]}`
    }
    // Quicknode
    case 'QUICKNODE_43114': {
      return `https://${tokens[0]}.avalanche-mainnet.quiknode.pro/${tokens[1]}/ext/bc/C/rpc/`
    }
    case 'QUICKNODE_10': {
      return `https://${tokens[0]}.optimism.quiknode.pro/${tokens[1]}`
    }
    case 'QUICKNODE_42220': {
      return `https://${tokens[0]}.celo-mainnet.quiknode.pro/${tokens[1]}`
    }
    case 'QUICKNODE_56': {
      return `https://${tokens[0]}.bsc.quiknode.pro/${tokens[1]}`
    }
    case 'QUICKNODE_137': {
      return `https://${tokens[0]}.matic.quiknode.pro/${tokens[1]}`
    }
    case 'QUICKNODE_8453': {
      return `https://${tokens[0]}.base-mainnet.quiknode.pro/${tokens[1]}`
    }
    case 'QUICKNODE_42161': {
      return `https://${tokens[0]}.arbitrum-mainnet.quiknode.pro/${tokens[1]}`
    }
    case 'QUICKNODE_1': {
      return `https://${tokens[0]}.quiknode.pro/${tokens[1]}`
    }
    case 'QUICKNODE_81457': {
      return `https://${tokens[0]}.blast-mainnet.quiknode.pro/${tokens[1]}`
    }
    // Alchemy
    case 'ALCHEMY_10': {
      return `https://opt-mainnet-fast.g.alchemy.com/v2/${tokens[0]}`
    }
    case 'ALCHEMY_137': {
      return `https://polygon-mainnet-fast.g.alchemy.com/v2/${tokens[0]}`
    }
    case 'ALCHEMY_8453': {
      return `https://base-mainnet-fast.g.alchemy.com/v2/${tokens[0]}`
    }
    case 'ALCHEMY_11155111': {
      return `https://eth-sepolia.g.alchemy.com/v2/${tokens[0]}`
    }
    case 'ALCHEMY_42161': {
      return `https://arb-mainnet-fast.g.alchemy.com/v2/${tokens[0]}`
    }
    case 'ALCHEMY_1': {
      return `https://eth-mainnet-fast.g.alchemy.com/v2/${tokens[0]}`
    }
  }
  throw new Error(`Unknown provider-chainId pair: ${key}`)
}

export function getProviderId(chainId: ChainId, providerName: string): string {
  return `${chainId.toString()}_${providerName}`
}
