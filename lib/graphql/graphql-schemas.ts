export interface GraphQLResponse<T> {
  data: T
  errors?: Array<{ message: string }>
}

export interface TokenInfoResponse {
  token: TokenInfo
}

export interface TokensInfoResponse {
  tokens: TokenInfo[]
}

export interface TokenInfo {
  name: string
  chain: string
  address: string
  decimals: number
  symbol: string
  standard: string
  feeData?: {
    buyFeeBps?: string
    sellFeeBps?: string
    feeTakenOnTransfer?: boolean
    externalTransferFailed?: boolean
    sellReverted?: boolean
  }
}

export interface TokenPriceResponse {
  token: TokenPrice
}

export interface TokensPriceResponse {
  tokens: TokenPrice[]
}

export interface TokenPrice {
  name: string
  chain: string
  address: string
  decimals: number
  symbol: string
  standard: string
  market: {
    price: {
      value: number
    }
  }
}
