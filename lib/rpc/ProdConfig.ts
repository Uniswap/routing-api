import Joi from '@hapi/joi'
import { ChainId } from '@uniswap/sdk-core'
import PROD_CONFIG from '../config/rpcProviderProdConfig.json'

export interface ChainConfig {
  chainId: number
  useMultiProviderProb: number
  sessionAllowProviderFallbackWhenUnhealthy?: boolean
  providerInitialWeights?: number[]
  providerUrls?: string[]
}

export type ProdConfig = ChainConfig[]

export const ProdConfigJoi = Joi.array().items(
  Joi.object({
    chainId: Joi.number().required(),
    useMultiProviderProb: Joi.number().required(),
    sessionAllowProviderFallbackWhenUnhealthy: Joi.boolean().optional(),
    providerInitialWeights: Joi.array().items(Joi.number()).optional(),
    providerUrls: Joi.array().items(Joi.string()).optional(),
  })
)

export function getRpcGatewayEnabledChainIds(): ChainId[] {
  const validation = ProdConfigJoi.validate(PROD_CONFIG)
  if (validation.error) {
    throw new Error(`ProdConfig failed data validation: Value: ${PROD_CONFIG}, Error: ${validation.error.message}`)
  }
  const prodConfig: ProdConfig = validation.value as ProdConfig
  return prodConfig.map((chainConfig) => chainConfig.chainId)
}
