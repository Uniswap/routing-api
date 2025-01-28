import { ChainId } from '@uniswap/sdk-core'
import { ADDRESS_ZERO } from '@uniswap/router-sdk'
import { nativeOnChain } from '@uniswap/smart-order-router/build/main/util/chains'
export function getSymbolOrAddress(address: string, chainId: ChainId): string {
  if (address === ADDRESS_ZERO) {
    return nativeOnChain(chainId)?.symbol ?? 'ETH'
  } else {
    return address
  }
}
