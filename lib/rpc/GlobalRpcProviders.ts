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
import { ProdConfig, ProdConfigJoi } from './ProdConfig'
import { chainIdToNetworkName, generateProviderUrl } from './utils'
import PROD_CONFIG from '../config/rpcProviderProdConfig.json'

export class GlobalRpcProviders {
  private static SINGLE_RPC_PROVIDERS: Map<ChainId, SingleJsonRpcProvider[]> | null = null

  private static UNI_RPC_PROVIDERS: Map<ChainId, UniJsonRpcProvider> | null = null

  private static validateProdConfig(config?: object): ProdConfig {
    const prodConfigInput = config !== undefined ? config : PROD_CONFIG
    const validation = ProdConfigJoi.validate(prodConfigInput)
    if (validation.error) {
      throw new Error(
        `ProdConfig failed data validation: Value: ${prodConfigInput}, Error: ${validation.error.message}`
      )
    }
    const prodConfig: ProdConfig = validation.value as ProdConfig
    for (let chainConfig of prodConfig) {
      if (!chainConfig.providerUrls) {
        continue
      }
      for (let i = 0; i < chainConfig.providerUrls!.length; i++) {
        const urlEnvVar = chainConfig.providerUrls[i]
        if (process.env[urlEnvVar] === undefined) {
          throw new Error(`Environmental variable ${urlEnvVar} isn't defined!`)
        }
        chainConfig.providerUrls[i] = generateProviderUrl(urlEnvVar, process.env[urlEnvVar]!, chainConfig.chainId)
      }
    }
    return prodConfig
  }

  private static initGlobalSingleRpcProviders(
    log: Logger,
    prodConfig: ProdConfig,
    singleConfig: SingleJsonRpcProviderConfig
  ) {
    GlobalRpcProviders.SINGLE_RPC_PROVIDERS = new Map()
    for (const chainConfig of prodConfig) {
      const chainId = chainConfig.chainId as ChainId
      if (Math.random() < chainConfig.useMultiProviderProb) {
        let providers: SingleJsonRpcProvider[] = []

        for (let i = 0; i < chainConfig.providerUrls!.length; i++) {
          // For unirpc provider, pass the service id in the header.
          const providerUrl = chainConfig.providerUrls![i]
          const headers =
            chainConfig.providerNames![i] === 'UNIRPC'
              ? {
                  'x-uni-service-id': 'routing_api',
                }
              : undefined

          providers.push(
            new SingleJsonRpcProvider(
              { name: chainIdToNetworkName(chainId), chainId },
              providerUrl,
              headers,
              log,
              singleConfig,
              chainConfig.enableDbSync!,
              chainConfig.dbSyncSampleProb!
            )
          )
        }
        GlobalRpcProviders.SINGLE_RPC_PROVIDERS.set(chainId, providers)
      }
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
      const chainId = chainConfig.chainId as ChainId
      if (!GlobalRpcProviders.SINGLE_RPC_PROVIDERS!.has(chainId)) {
        continue
      }
      GlobalRpcProviders.UNI_RPC_PROVIDERS.set(
        chainId,
        new UniJsonRpcProvider(
          chainId,
          GlobalRpcProviders.SINGLE_RPC_PROVIDERS!.get(chainId)!,
          log,
          uniConfig,
          chainConfig.latencyEvaluationSampleProb!,
          chainConfig.healthCheckSampleProb!,
          chainConfig.providerInitialWeights,
          true
        )
      )
    }
    return GlobalRpcProviders.UNI_RPC_PROVIDERS
  }

  static getGlobalSingleRpcProviders(
    log: Logger,
    singleConfig: SingleJsonRpcProviderConfig = DEFAULT_SINGLE_PROVIDER_CONFIG
  ): Map<ChainId, SingleJsonRpcProvider[]> {
    const prodConfig = GlobalRpcProviders.validateProdConfig()
    if (GlobalRpcProviders.SINGLE_RPC_PROVIDERS === null) {
      GlobalRpcProviders.initGlobalSingleRpcProviders(log, prodConfig, singleConfig)
    }
    return GlobalRpcProviders.SINGLE_RPC_PROVIDERS!
  }

  static getGlobalUniRpcProviders(
    log: Logger,
    uniConfig: UniJsonRpcProviderConfig = DEFAULT_UNI_PROVIDER_CONFIG,
    singleConfig: SingleJsonRpcProviderConfig = DEFAULT_SINGLE_PROVIDER_CONFIG,
    prodConfigJson?: any
  ): Map<ChainId, UniJsonRpcProvider> {
    const prodConfig = GlobalRpcProviders.validateProdConfig(prodConfigJson)
    if (GlobalRpcProviders.UNI_RPC_PROVIDERS === null) {
      GlobalRpcProviders.initGlobalUniRpcProviders(log, prodConfig, uniConfig, singleConfig)
    }
    return GlobalRpcProviders.UNI_RPC_PROVIDERS!
  }
}
