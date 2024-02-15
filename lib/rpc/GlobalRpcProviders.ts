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
import { ChainConfig, ProdConfig } from './ProdConfig'
import { chainIdToNetworkName } from './utils'

export class GlobalRpcProviders {
  private static SINGLE_RPC_PROVIDERS: Map<ChainId, SingleJsonRpcProvider[]> | null = null

  private static UNI_RPC_PROVIDERS: Map<ChainId, UniJsonRpcProvider> | null = null

  private static getProdConfig(): ProdConfig {
    const prodConfigStr = process.env['UNI_RPC_PROVIDER_PROD_CONFIG']!
    if (prodConfigStr === undefined) {
      throw new Error('Environment variable UNI_RPC_PROVIDER_PROD_CONFIG is missing!')
    }
    // Notice: No input validation! You need to be careful about the env var's format!
    return new Map<ChainId, ChainConfig>(JSON.parse(prodConfigStr))
  }

  private static initGlobalSingleRpcProviders(
    log: Logger,
    prodConfig: ProdConfig,
    singleConfig: SingleJsonRpcProviderConfig
  ) {
    // // Only Avalanche is supported for now.
    // const infuraAvalancheUrl = process.env[`WEB3_RPC_${ChainId.AVALANCHE.toString()}`]!
    // if (infuraAvalancheUrl === undefined) {
    //   throw new Error(
    //     `Infura Avalanche URL isn't provided by environment variable WEB3_RPC_${ChainId.AVALANCHE.toString()}`
    //   )
    // }
    // GlobalRpcProviders.SINGLE_RPC_PROVIDERS = new Map([
    //   [
    //     ChainId.AVALANCHE,
    //     [new SingleJsonRpcProvider({ name: 'avalanche', chainId: ChainId.AVALANCHE }, infuraAvalancheUrl, log, config)],
    //   ],
    // ])
    GlobalRpcProviders.SINGLE_RPC_PROVIDERS = new Map()
    for (const [chainId, chainConfig] of prodConfig) {
      if (!chainConfig.useMultiProvider) {
        continue
      }
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
    for (const [chainId, chainConfig] of prodConfig) {
      if (!chainConfig.useMultiProvider) {
        continue
      }
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
