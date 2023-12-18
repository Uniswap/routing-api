import { LibSupportedChainsType } from './chains'
import { SingleJsonRpcProvider } from './single-json-rpc-provider'


export default class UniJsonRpcProvider {
  // TODO(jie): Add session manager
  private providers: SingleJsonRpcProvider[]

  constructor(chainId: LibSupportedChainsType, urls: string[]) {
    for (const url of urls) {
      this.providers.push(new SingleJsonRpcProvider(chainId, url))
    }
  }
}