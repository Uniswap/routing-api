import Joi from '@hapi/joi'
import { ChainId } from '@uniswap/sdk-core'
import PROD_CONFIG from '../config/rpcProviderProdConfig.json'

export interface ChainConfig {
  chainId: number
  useMultiProviderProb: number
  sessionAllowProviderFallbackWhenUnhealthy?: boolean
  providerInitialWeights?: number[]
  providerUrls?: string[]
  dbSyncSampleProb?: number
  latencyEvaluationSampleProb?: number
  healthCheckSampleProb?: number
  enableDbSync?: boolean
}

export type ProdConfig = ChainConfig[]

export const ProdConfigJoi = Joi.array().items(
  Joi.object({
    chainId: Joi.number().required(),
    useMultiProviderProb: Joi.number().required(),
    sessionAllowProviderFallbackWhenUnhealthy: Joi.boolean().optional(),
    providerInitialWeights: Joi.array().items(Joi.number()).optional(),
    providerUrls: Joi.array().items(Joi.string()).optional(),
    dbSyncSampleProb: Joi.number().min(0.0).max(1.0).optional().default(1.0),
    latencyEvaluationSampleProb: Joi.number().min(0.0).max(1.0).optional().default(1.0),
    healthCheckSampleProb: Joi.number().min(0.0).max(1.0).optional().default(1.0),
    enableDbSync: Joi.boolean().optional().default(false),
  })
)

// Return a map of chain id and its provider names
export function getRpcGatewayEnabledChains(config?: object): Map<ChainId, string[]> {
  const prodConfigInput = config ?? PROD_CONFIG
  const validation = ProdConfigJoi.validate(prodConfigInput)
  if (validation.error) {
    throw new Error(`ProdConfig failed data validation: Value: ${prodConfigInput}, Error: ${validation.error.message}`)
  }
  const prodConfig: ProdConfig = validation.value as ProdConfig
  let result = new Map<ChainId, string[]>()
  for (const chainConfig of prodConfig) {
    if (chainConfig.providerUrls) {
      result.set(
        chainConfig.chainId,
        // Extract the provider name. For example, from "INFURA_8453" to "INFURA"
        chainConfig.providerUrls.map((url: string) => url.substring(0, url.indexOf('_')))
      )
    }
  }
  return result
}
