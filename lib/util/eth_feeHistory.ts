export type EthFeeHistory = {
  oldestBlock: number
  reward: string[]
  baseFeePerGas: string[]
  gasUsedRatio: number[]
  baseFeePerBlobGas: string[]
  blobGasUsedRatio: number[]
}
