export type IndependentToken = "TOKEN_0" | "TOKEN_1"

export interface PoolInfo {
  tickSpacing: number
  token0: string
  token1: string
  fee: number
}

export interface Position {
  tickLower: number
  tickUpper: number
  pool: PoolInfo
}

export interface LpCreateRequestBody {
  simulateTransaction?: boolean
  protocol: "V3"
  walletAddress: string
  chainId: number
  independentAmount: string
  independentToken: IndependentToken
  initialDependentAmount: string
  initialPrice: string
  position: Position
}

export interface CreateTransactionData {
  data: string
  value: string
  to: string
  from: string
  maxFeePerGas: string
  maxPriorityFeePerGas: string
  gasLimit: string
  chainId: number
}

export interface LpCreateResponseBody {
  requestId: string
  create: CreateTransactionData
  dependentAmount: string
  gasFee: string
}
