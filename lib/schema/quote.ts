import Joi from '@hapi/joi';

export const QuoteBodySchemaJoi = Joi.object({
  tokenIn: Joi.string().alphanum().required(),
  tokenOut: Joi.string().alphanum().required(),
  amount: Joi.string().required(),
  chainId: Joi.number().required(),
  type: Joi.string().valid('exactIn', 'exactOut').required(),
  recipient: Joi.string().required(),
  slippageTolerance: Joi.string().required(),
  deadline: Joi.string().required(),
  algorithm: Joi.string().optional(),
  config: Joi.object({
    topN: Joi.number().required(),
    maxSwapsPerPath: Joi.number().required(),
    maxSplits: Joi.number().required(),
    distributionPercent: Joi.number().required(),
    multicallChunkSize: Joi.number().required(),
  }).optional(),
});

export type QuoteBody = {
  tokenIn: string;
  tokenOut: string;
  type: 'exactIn' | 'exactOut';
  amount: string;
  chainId: number;
  recipient: string;
  slippageTolerance: string;
  deadline: string;
  algorithm?: string;
  config?: {
    topN: number;
    topNSecondHop: number;
    topNTokenInOut: number;
    maxSwapsPerPath: number;
    maxSplits: number;
    distributionPercent: number;
    multicallChunkSize: number;
  };
};
