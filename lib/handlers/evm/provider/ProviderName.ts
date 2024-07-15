export enum ProviderName {
  INFURA = 'INFURA',
  QUIKNODE = 'QUIKNODE', // quicknode doesn't have letter c in the RPC endpoint
  QUIKNODE_GETH = 'QUIKNODE_GETH',
  QUIKNODE_RETH = 'QUIKNODE_RETH',
  FORNO = 'FORNO',
  ALCHEMY = 'ALCHEMY',
  NIRVANA = 'NIRVANA',
  UNKNOWN = 'UNKNOWN',
}

export function deriveProviderName(url: string): ProviderName {
  for (const name in ProviderName) {
    if (url.toUpperCase().includes(name)) {
      if (url.toUpperCase().includes(ProviderName.QUIKNODE)) {
        if (url.toLowerCase().includes('solitary')) {
          return ProviderName.QUIKNODE_GETH
        } else if (url.toLowerCase().includes('ancient')) {
          return ProviderName.QUIKNODE_RETH
        } else {
          return ProviderName.QUIKNODE
        }
      } else {
        return ProviderName[name as keyof typeof ProviderName]
      }
    }
  }

  return ProviderName.UNKNOWN
}
