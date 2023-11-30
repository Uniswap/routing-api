import BaseJoi from '@hapi/joi'
import { SUPPORTED_CHAINS } from '../../injector-sor'

const Joi = BaseJoi.extend((joi) => ({
  base: joi.array(),
  type: 'stringArray',
  messages: {
    'stringArray.type': '{{#label}} is not a valid string array',
  },
  coerce: (value, helpers) => {
    if (typeof value !== 'string') {
      return { value: value, errors: [helpers.error('stringArray.type')] }
    }
    value = value.replace(/^\[|\]$/g, '').split(',')
    const ar = (value as string[]).map((val) => {
      return val.trim()
    })
    return { value: ar }
  },
}))

export const QuoteQueryParamsJoi = Joi.object({
  tokenInAddress: Joi.string().alphanum().max(42).required(),
  tokenInChainId: Joi.number()
    .valid(...SUPPORTED_CHAINS.values())
    .required(),
  tokenOutAddress: Joi.string().alphanum().max(42).required(),
  tokenOutChainId: Joi.number()
    .valid(...SUPPORTED_CHAINS.values())
    .required(),
  amount: Joi.string()
    .pattern(/^[0-9]+$/)
    .max(77) // TODO: validate < 2**256
    .required(),
  type: Joi.string().valid('exactIn', 'exactOut').required(),
  recipient: Joi.string()
    .pattern(new RegExp(/^0x[a-fA-F0-9]{40}$/))
    .optional(),
  slippageTolerance: Joi.number().min(0).max(20).precision(2).optional(),
  deadline: Joi.number().max(10800).optional(), // 180 mins, same as interface max
  algorithm: Joi.string().valid('alpha', 'legacy').optional(),
  gasPriceWei: Joi.string()
    .pattern(/^[0-9]+$/)
    .max(30)
    .optional(),
  minSplits: Joi.number().max(7).optional(),
  forceCrossProtocol: Joi.boolean().optional(),
  forceMixedRoutes: Joi.boolean().optional(),
  protocols: Joi.stringArray().items(Joi.string().valid('v2', 'v3', 'mixed')).optional(),
  simulateFromAddress: Joi.string().alphanum().max(42).optional(),
  permitSignature: Joi.string().optional(),
  permitNonce: Joi.string().optional(),
  permitExpiration: Joi.number().optional(),
  permitAmount: Joi.string()
    .pattern(/^[0-9]+$/)
    .max(77),
  permitSigDeadline: Joi.number().optional(),
  // TODO: Remove once universal router is no longer behind a feature flag.
  enableUniversalRouter: Joi.boolean().optional().default(false),
  quoteSpeed: Joi.string().valid('fast', 'standard').optional().default('standard'),
  debugRoutingConfig: Joi.string().optional(),
  unicornSecret: Joi.string().optional(),
  intent: Joi.string().valid('quote', 'swap', 'caching', 'pricing').optional().default('quote'),
  enableFeeOnTransferFeeFetching: Joi.boolean().optional().default(false),
  portionBips: Joi.string()
    .pattern(/^[0-9]+$/)
    .max(5) // portionBips is a string type with the expectation of being parsable to integer between 0 and 10000
    .optional(),
  portionAmount: Joi.string()
    .pattern(/^[0-9]+$/)
    .optional(),
  portionRecipient: Joi.string().alphanum().max(42).optional(),
  source: Joi.string().max(20).required(),
})

export type QuoteQueryParams = {
  tokenInAddress: string
  tokenInChainId: number
  tokenOutAddress: string
  tokenOutChainId: number
  amount: string
  type: string
  recipient?: string
  slippageTolerance?: string
  deadline?: string
  algorithm?: string
  gasPriceWei?: string
  minSplits?: number
  forceCrossProtocol?: boolean
  forceMixedRoutes?: boolean
  protocols?: string[] | string
  simulateFromAddress?: string
  permitSignature?: string
  permitNonce?: string
  permitExpiration?: string
  permitAmount?: string
  permitSigDeadline?: string
  enableUniversalRouter?: boolean
  quoteSpeed?: string
  debugRoutingConfig?: string
  unicornSecret?: string
  intent?: string
  enableFeeOnTransferFeeFetching?: boolean
  portionBips?: number
  portionAmount?: string
  portionRecipient?: string
  source?: string
}
