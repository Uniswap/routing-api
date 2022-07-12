import BaseJoi from '@hapi/joi'
import { SUPPORTED_CHAINS } from '../../injector-sor'
import { TransactionReceipt } from "@ethersproject/abstract-provider";

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

export const TenderlySimulationQueryParamsJoi = Joi.object({
  chainId: Joi.number()
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
  protocols: Joi.stringArray().items(Joi.string().valid('v2', 'v3')).optional(),
}).and('recipient', 'slippageTolerance', 'deadline')

export type TenderlySimulationQueryParams = {
  chainId: number
  hexData: string
  blockNumber: number
}

export type TenderlySimulationResponse = {
    simulationTxReceipt: TransactionReceipt
    chainId: number
    blockNumber: number
    requestId: string
  }