import { ChainId } from '@uniswap/sdk-core'
import SingleJsonRpcProvider from './singleJsonRpcProvider'
import UniJsonRpcProvider from './uniJsonRpcProvider'

export default class GlobalRpcProviders {
  private static readonly PROVIDER_RPC_URL_RANKING: Map<ChainId, number[] | undefined> = new Map(
    [
      [ChainId.MAINNET, undefined]
    ]
  )

  private static readonly PROVIDER_RPC_URL_WEIGHTS: Map<ChainId, number[] | undefined> = new Map(
    [
      [ChainId.MAINNET, undefined]
    ]
  )

  private static SINGLE_RPC_PROVIDERS: Map<ChainId, SingleJsonRpcProvider[]> | null = null

  private static UNI_RPC_PROVIDERS: Map<ChainId, UniJsonRpcProvider> | null = null

  private static initGlobalSingleRpcProviders() {
    const INFURA_KEY = process.env.UNI_RPC_PROVIDER_INFURA_KEY
    if (INFURA_KEY === undefined) {
      throw new Error(`UNI_RPC_PROVIDER_INFURA_KEY must be a defined environment variable`)
    }
    const QUICKNODE_MAINNET_RPC_URL = process.env.UNI_RPC_PROVIDER_QUICKNODE_MAINNET_RPC_URL
    if (QUICKNODE_MAINNET_RPC_URL === 'undefined') {
      throw new Error(`REACT_APP_QUICKNODE_MAINNET_RPC_URL must be a defined environment variable`)
    }
    this.SINGLE_RPC_PROVIDERS = new Map(
      [
        [ChainId.MAINNET, [
          new SingleJsonRpcProvider(ChainId.MAINNET, `https://mainnet.infura.io/v3/${INFURA_KEY}`),
          new SingleJsonRpcProvider(ChainId.MAINNET, QUICKNODE_MAINNET_RPC_URL!)
        ]]
      ]
    )
  }

  private static initGlobalUniRpcProviders() {
    if (this.SINGLE_RPC_PROVIDERS === null) {
      this.initGlobalSingleRpcProviders()
    }
    this.UNI_RPC_PROVIDERS = new Map([
      [ChainId.MAINNET, new UniJsonRpcProvider(
        ChainId.MAINNET,
        this.SINGLE_RPC_PROVIDERS!.get(ChainId.MAINNET)!,
        GlobalRpcProviders.PROVIDER_RPC_URL_RANKING.get(ChainId.MAINNET),
        GlobalRpcProviders.PROVIDER_RPC_URL_WEIGHTS.get(ChainId.MAINNET),
      )],
      ]
    )
  }

  static getGlobalSingleRpcProviders(): Map<ChainId, SingleJsonRpcProvider[]> {
    if (this.SINGLE_RPC_PROVIDERS === null) {
      this.initGlobalSingleRpcProviders()
    }
    return this.SINGLE_RPC_PROVIDERS!
  }

  static getGlobalUniRpcProviders(): Map<ChainId, UniJsonRpcProvider> {
    if (this.UNI_RPC_PROVIDERS === null) {
      this.initGlobalUniRpcProviders()
    }
    return this.UNI_RPC_PROVIDERS!
  }
}
