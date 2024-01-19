import { ChainId } from '@uniswap/sdk-core'
import { SingleJsonRpcProvider } from './SingleJsonRpcProvider'
import { UniJsonRpcProvider } from './UniJsonRpcProvider'
import Logger from 'bunyan'

export class GlobalRpcProviders {
  private static readonly PROVIDER_RPC_URL_RANKING: Map<ChainId, number[] | undefined> = new Map([
    [ChainId.MAINNET, undefined],
  ])

  private static readonly PROVIDER_RPC_URL_WEIGHTS: Map<ChainId, number[] | undefined> = new Map([
    [ChainId.MAINNET, undefined],
  ])

  private static SINGLE_RPC_PROVIDERS: Map<ChainId, SingleJsonRpcProvider[]> | null = null

  private static UNI_RPC_PROVIDERS: Map<ChainId, UniJsonRpcProvider> | null = null

  private static initGlobalSingleRpcProviders(log: Logger) {
    const INFURA_KEY = process.env.UNI_RPC_PROVIDER_INFURA_KEY
    if (INFURA_KEY === undefined) {
      throw new Error(`UNI_RPC_PROVIDER_INFURA_KEY must be a defined environment variable`)
    }
    const QUICKNODE_MAINNET_RPC_URL = process.env.UNI_RPC_PROVIDER_QUICKNODE_MAINNET_RPC_URL
    if (QUICKNODE_MAINNET_RPC_URL === undefined) {
      throw new Error(`UNI_RPC_PROVIDER_QUICKNODE_MAINNET_RPC_URL must be a defined environment variable`)
    }
    console.log(`jiejie: in initGlobalSingleRpcProviders()`)
    GlobalRpcProviders.SINGLE_RPC_PROVIDERS = new Map([
      [
        ChainId.MAINNET,
        [
          new SingleJsonRpcProvider(ChainId.MAINNET, `https://mainnet.infura.io/v3/${INFURA_KEY}`, log),
          new SingleJsonRpcProvider(ChainId.MAINNET, 'https://eth-mainnet.g.alchemy.com/v2/PC1uzrHueA8AdsD8jdQPcXFt4IUKSm-g', log),
          // new SingleJsonRpcProvider(ChainId.MAINNET, QUICKNODE_MAINNET_RPC_URL!, log),
        ],
      ],
    ])
    return GlobalRpcProviders.SINGLE_RPC_PROVIDERS
  }

  private static initGlobalUniRpcProviders(log: Logger) {
    if (GlobalRpcProviders.SINGLE_RPC_PROVIDERS === null) {
      GlobalRpcProviders.initGlobalSingleRpcProviders(log)
    }
    if (!GlobalRpcProviders.SINGLE_RPC_PROVIDERS!.has(ChainId.MAINNET)) {
      throw new Error(`No RPC providers configured for chain ${ChainId.MAINNET}`)
    }
    GlobalRpcProviders.UNI_RPC_PROVIDERS = new Map([
      [
        ChainId.MAINNET,
        new UniJsonRpcProvider(
          ChainId.MAINNET,
          GlobalRpcProviders.SINGLE_RPC_PROVIDERS!.get(ChainId.MAINNET)!,
          log,
          GlobalRpcProviders.PROVIDER_RPC_URL_RANKING.get(ChainId.MAINNET),
          GlobalRpcProviders.PROVIDER_RPC_URL_WEIGHTS.get(ChainId.MAINNET)
        ),
      ],
    ])
    return GlobalRpcProviders.UNI_RPC_PROVIDERS
  }

  static getGlobalSingleRpcProviders(log: Logger): Map<ChainId, SingleJsonRpcProvider[]> {
    if (GlobalRpcProviders.SINGLE_RPC_PROVIDERS === null) {
      console.log("jiejie: will now create new single instance")
      GlobalRpcProviders.initGlobalSingleRpcProviders(log)
    }
    return GlobalRpcProviders.SINGLE_RPC_PROVIDERS!
  }

  static getGlobalUniRpcProviders(log: Logger): Map<ChainId, UniJsonRpcProvider> {
    if (GlobalRpcProviders.UNI_RPC_PROVIDERS === null) {
      console.log("jiejie: will now create new uni instance")
      GlobalRpcProviders.initGlobalUniRpcProviders(log)
    }
    return GlobalRpcProviders.UNI_RPC_PROVIDERS!
  }
}
