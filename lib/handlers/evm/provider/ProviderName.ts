export enum ProviderName {
  INFURA = 'INFURA',
  QUIKNODE = 'QUIKNODE', // quicknode RPC doesn't have letter c
  FORNO = 'FORNO',
  UNKNOWN = 'UNKNOWN',
}

export function deriveProviderName(url: string): ProviderName {
  for (const name in ProviderName) {
    if (url.toUpperCase().includes(name)) {
      return ProviderName[name as keyof typeof ProviderName]
    }
  }

  return ProviderName.UNKNOWN
}
