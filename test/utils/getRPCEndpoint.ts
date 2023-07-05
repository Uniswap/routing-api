import { ChainId } from '@uniswap/sdk-core'

export function getRPCEndpoint(chainId: ChainId): string {
  return process.env[`WEB3_RPC_${chainId.toString()}`]!
}
