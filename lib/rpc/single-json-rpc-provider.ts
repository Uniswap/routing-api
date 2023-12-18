import { StaticJsonRpcProvider } from '@ethersproject/providers'
import { CHAIN_IDS_TO_NAMES, LibSupportedChainsType } from './chains'

export class SingleJsonRpcProvider extends StaticJsonRpcProvider {
  // TODO(jie): This class will implement block-aligned cache, as well as
  //   meta for provider selection and fallback
  constructor(chainId: LibSupportedChainsType, url: string) {
    super(url, { chainId, name: CHAIN_IDS_TO_NAMES[chainId] })
  }
}
