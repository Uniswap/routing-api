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
  if (key === 'UNIRPC_0') {
    // UNIRPC_0 is a special case for the Uniswap RPC
    // - env value will contain the generic unirpc endpoint - no trailing '/'
    return `${value}/rpc/${chainId}`
  }

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
    case 'QUICKNODE_84532': {
      return `https://${tokens[0]}.base-sepolia.quiknode.pro/${tokens[1]}`
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
    case 'QUICKNODE_7777777': {
      return `https://${tokens[0]}.zora-mainnet.quiknode.pro/${tokens[1]}`
    }
    case 'QUICKNODE_324': {
      return `https://${tokens[0]}.zksync-mainnet.quiknode.pro/${tokens[1]}`
    }
    case 'QUICKNODE_1301': {
      // URL contains unichain-sepolia.quiknode.pro, we had to not disclose prior to the unichain annouce
      return `${tokens[0]}`
    }
    case 'QUICKNODE_130': {
      return `https://${tokens[0]}.unichain-mainnet.quiknode.pro/${tokens[1]}`
    }
    case 'QUICKNODE_480': {
      return `https://${tokens[0]}.worldchain-mainnet.quiknode.pro/${tokens[1]}`
    }
    // QuickNode RETH
    case 'QUICKNODERETH_1': {
      return `https://${tokens[0]}.quiknode.pro/${tokens[1]}`
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
      return `https://eth-sepolia-fast.g.alchemy.com/v2/${tokens[0]}`
    }
    case 'ALCHEMY_42161': {
      return `https://arb-mainnet-fast.g.alchemy.com/v2/${tokens[0]}`
    }
    case 'ALCHEMY_1': {
      return `https://eth-mainnet-fast.g.alchemy.com/v2/${tokens[0]}`
    }
    case 'ALCHEMY_324': {
      return `https://zksync-mainnet.g.alchemy.com/v2/${tokens[0]}`
    }
    case 'ALCHEMY_1301': {
      return `https://unichain-sepolia.g.alchemy.com/v2/${tokens[0]}`
    }
  }
  throw new Error(`Unknown provider-chainId pair: ${key}`)
}

export function getProviderId(chainId: ChainId, providerName: string): string {
  return `${chainId.toString()}_${providerName}`
}
