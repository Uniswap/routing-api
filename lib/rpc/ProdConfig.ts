import Joi from '@hapi/joi'

export interface ChainConfig {
  chainId: number
  useMultiProvider: boolean
  sessionAllowProviderFallbackWhenUnhealthy?: boolean
  providerInitialWeights?: number[]
  providerUrls?: string[]
}

export type ProdConfig = ChainConfig[]

export const ProdConfigJoi = Joi.array().items(
  Joi.object({
    chainId: Joi.number().required(),
    useMultiProvider: Joi.boolean().required(),
    sessionAllowProviderFallbackWhenUnhealthy: Joi.boolean().optional(),
    providerInitialWeights: Joi.array().items(Joi.number()).optional(),
    providerUrls: Joi.array().items(Joi.string()).optional(),
  })
)
