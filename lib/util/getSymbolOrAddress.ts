import { ChainId } from '@juiceswapxyz/sdk-core'
import { ADDRESS_ZERO } from '@juiceswapxyz/router-sdk'
import { nativeOnChain } from '@juiceswapxyz/smart-order-router/build/main/util/chains'
export function getSymbolOrAddress(address: string, chainId: ChainId): string {
  if (address === ADDRESS_ZERO) {
    return nativeOnChain(chainId)?.symbol ?? 'ETH'
  } else {
    return address
  }
}
