export enum ProviderName {
  INFURA = 'INFURA',
  QUICKNODE = 'QUICKNODE',
  FORNO = 'FORNO',
  UNKNOWN = 'UNKNOWN',
}

export function deriveProviderName(url: string): string {
  for (const name in ProviderName) {
    if (url.toLowerCase().includes(name.toLowerCase())) {
      return name
    }
  }

  return ProviderName.UNKNOWN
}
