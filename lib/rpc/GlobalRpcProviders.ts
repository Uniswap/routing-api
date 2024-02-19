import { ChainId } from '@uniswap/sdk-core'
import { SingleJsonRpcProvider } from './SingleJsonRpcProvider'
import { UniJsonRpcProvider } from './UniJsonRpcProvider'
import Logger from 'bunyan'
import {
  DEFAULT_SINGLE_PROVIDER_CONFIG,
  DEFAULT_UNI_PROVIDER_CONFIG,
  SingleJsonRpcProviderConfig,
  UniJsonRpcProviderConfig,
} from './config'
import { ProdConfig, ProdConfigCodec } from './ProdConfig'
import { chainIdToNetworkName } from './utils'
import { isLeft } from 'fp-ts/lib/These'

export class GlobalRpcProviders {
  private static SINGLE_RPC_PROVIDERS: Map<ChainId, SingleJsonRpcProvider[]> | null = null

  private static UNI_RPC_PROVIDERS: Map<ChainId, UniJsonRpcProvider> | null = null

  private static getProdConfig(): ProdConfig {
    const prodConfigStr = process.env['UNI_RPC_PROVIDER_PROD_CONFIG']!
    if (prodConfigStr === undefined) {
      throw new Error('Environment variable UNI_RPC_PROVIDER_PROD_CONFIG is missing!')
    }
    // return new Map<ChainId, ChainConfig>(JSON.parse(prodConfigStr))
    const decodeResult = ProdConfigCodec.decode(JSON.parse(prodConfigStr))
    if (isLeft(decodeResult)) {
      throw new Error('Environment variable UNI_RPC_PROVIDER_PROD_CONFIG failed data validation!')
    }
    return decodeResult.right
  }

  private static initGlobalSingleRpcProviders(
    log: Logger,
    prodConfig: ProdConfig,
    singleConfig: SingleJsonRpcProviderConfig
  ) {
    GlobalRpcProviders.SINGLE_RPC_PROVIDERS = new Map()
    for (const chainConfig of prodConfig) {
      if (!chainConfig.useMultiProvider) {
        continue
      }
      const chainId = chainConfig.chainId as ChainId
      let providers: SingleJsonRpcProvider[] = []
      for (const providerUrl of chainConfig.providerUrls!) {
        providers.push(
          new SingleJsonRpcProvider({ name: chainIdToNetworkName(chainId), chainId }, providerUrl, log, singleConfig)
        )
      }
      GlobalRpcProviders.SINGLE_RPC_PROVIDERS.set(chainId, providers)
    }
  }

  private static initGlobalUniRpcProviders(
    log: Logger,
    prodConfig: ProdConfig,
    uniConfig: UniJsonRpcProviderConfig,
    singleConfig: SingleJsonRpcProviderConfig
  ) {
    if (GlobalRpcProviders.SINGLE_RPC_PROVIDERS === null) {
      GlobalRpcProviders.initGlobalSingleRpcProviders(log, prodConfig, singleConfig)
    }

    GlobalRpcProviders.UNI_RPC_PROVIDERS = new Map()
    for (const chainConfig of prodConfig) {
      if (!chainConfig.useMultiProvider) {
        continue
      }
      const chainId = chainConfig.chainId as ChainId
      if (!GlobalRpcProviders.SINGLE_RPC_PROVIDERS!.has(chainId)) {
        throw new Error(`No RPC providers configured for chain ${chainId.toString()}`)
      }
      GlobalRpcProviders.UNI_RPC_PROVIDERS.set(
        chainId,
        new UniJsonRpcProvider(
          chainId,
          GlobalRpcProviders.SINGLE_RPC_PROVIDERS!.get(chainId)!,
          log,
          chainConfig.providerInitialWeights,
          true,
          uniConfig
        )
      )
    }
    return GlobalRpcProviders.UNI_RPC_PROVIDERS
  }

  static getGlobalSingleRpcProviders(
    log: Logger,
    singleConfig: SingleJsonRpcProviderConfig = DEFAULT_SINGLE_PROVIDER_CONFIG
  ): Map<ChainId, SingleJsonRpcProvider[]> {
    const prodConfig = GlobalRpcProviders.getProdConfig()
    if (GlobalRpcProviders.SINGLE_RPC_PROVIDERS === null) {
      GlobalRpcProviders.initGlobalSingleRpcProviders(log, prodConfig, singleConfig)
    }
    return GlobalRpcProviders.SINGLE_RPC_PROVIDERS!
  }

  static getGlobalUniRpcProviders(
    log: Logger,
    uniConfig: UniJsonRpcProviderConfig = DEFAULT_UNI_PROVIDER_CONFIG,
    singleConfig: SingleJsonRpcProviderConfig = DEFAULT_SINGLE_PROVIDER_CONFIG
  ): Map<ChainId, UniJsonRpcProvider> {
    const prodConfig = GlobalRpcProviders.getProdConfig()
    if (GlobalRpcProviders.UNI_RPC_PROVIDERS === null) {
      GlobalRpcProviders.initGlobalUniRpcProviders(log, prodConfig, uniConfig, singleConfig)
    }
    return GlobalRpcProviders.UNI_RPC_PROVIDERS!
  }
}
