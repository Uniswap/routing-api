export interface LpApproveRequestBody {
    simulateTransaction: boolean;
    walletAddress: string;
    chainId: number;
    protocol: string;
    token0: string;
    token1: string;
    amount0: string;
    amount1: string;
}

export interface TransactionData {
  to: string
  value: string
  from: string
  data: string
  maxFeePerGas: string
  maxPriorityFeePerGas: string
  gasLimit: string
  chainId: number
}

export interface LpApproveResponseBody {
  requestId: string
  token0Approval: TransactionData | null
  token1Approval: TransactionData | null
  token0Cancel: TransactionData | null
  token1Cancel: TransactionData | null
  positionTokenApproval: TransactionData | null
  permitData: any | null
  token0PermitTransaction: TransactionData | null
  token1PermitTransaction: TransactionData | null
  positionTokenPermitTransaction: TransactionData | null
  gasFeeToken0Approval: string
}