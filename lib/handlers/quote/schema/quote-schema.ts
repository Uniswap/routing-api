import BaseJoi from '@hapi/joi'
import { SUPPORTED_CHAINS } from '../../injector-sor'

// Constants for amount validation
export const MAX_UINT256 = BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935');
const MAX_SAFE_AMOUNT_LENGTH = MAX_UINT256.toString().length;

// Joi extension for handling BigInt validation
const createBigIntExtension = (joi: any) => ({
  type: 'bigInt',
  base: joi.string(),
  messages: {
    'amount.required': '{{#label}} is required',
    'amount.numeric': '{{#label}} must contain only numeric characters',
    'amount.positive': '{{#label}} must be greater than 0',
    'amount.exceedsMaxUint256': '{{#label}} exceeds maximum uint256 value',
    'amount.invalid': '{{#label}} is not a valid number'
  },
  validate(value: string, helpers: any) {
    if (!value) {
      return helpers.error('amount.required');
    }

    // Optimized numeric and length validation
    if (!new RegExp(`^[0-9]{1,${MAX_SAFE_AMOUNT_LENGTH}}$`).test(value)) {
      return helpers.error('amount.numeric');
    }

    // BigInt validation
    try {
      const amountBN = BigInt(value);
      if (amountBN <= 0n) {
        return helpers.error('amount.positive');
      }
      if (amountBN > MAX_UINT256) {
        return helpers.error('amount.exceedsMaxUint256');
      }
      return value;
    } catch (error) {
      return helpers.error('amount.invalid');
    }
  }
});

const Joi = BaseJoi
  .extend((joi) => ({
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
  .extend(createBigIntExtension);

export const QuoteQueryParamsJoi = Joi.object({
  tokenInAddress: Joi.string().alphanum().max(42).required(),
  tokenInChainId: Joi.number()
    .valid(...SUPPORTED_CHAINS.values())
    .required(),
  tokenOutAddress: Joi.string().alphanum().max(42).required(),
  tokenOutChainId: Joi.number()
    .valid(...SUPPORTED_CHAINS.values())
    .required(),
  amount: Joi.bigInt().required(),
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
  protocols: Joi.stringArray().items(Joi.string().valid('v2', 'v3', 'v4', 'mixed')).optional(),
  simulateFromAddress: Joi.string().alphanum().max(42).optional(),
  permitSignature: Joi.string().optional(),
  permitNonce: Joi.string().optional(),
  permitExpiration: Joi.number().optional(),
  permitAmount: Joi.bigInt().optional(),
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
  source: Joi.string().max(20).optional(),
  gasToken: Joi.string().alphanum().max(42).optional(),
})

// Future work: this TradeTypeParam can be converted into an enum and used in the
// schema above and in the route QuoteHandler.
export type TradeTypeParam = 'exactIn' | 'exactOut'

export type QuoteQueryParams = {
  tokenInAddress: string
  tokenInChainId: number
  tokenOutAddress: string
  tokenOutChainId: number
  amount: string
  type: TradeTypeParam
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
  gasToken?: string
}
