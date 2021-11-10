import Joi from '@hapi/joi'

export const QuoteQueryParamsJoi = Joi.object({
  tokenInAddress: Joi.string().alphanum().max(42).required(),
  tokenInChainId: Joi.number().valid(1, 4).required(),
  tokenOutAddress: Joi.string().alphanum().max(42).required(),
  tokenOutChainId: Joi.number().valid(1, 4).required(),
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
}).and('recipient', 'slippageTolerance', 'deadline')

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
}
