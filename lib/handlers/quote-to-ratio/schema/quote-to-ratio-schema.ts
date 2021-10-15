import Joi from '@hapi/joi';
import { TickMath } from '@uniswap/v3-sdk';

export const QuoteToRatioQueryParamsJoi = Joi.object({
  token0Address: Joi.string().alphanum().max(42).required(),
  token0ChainId: Joi.number().valid(1, 4).required(),
  token1Address: Joi.string().alphanum().max(42).required(),
  token1ChainId: Joi.number().valid(1, 4).required(),
  token0Balance: Joi.number().min(0).required(),
  token1Balance: Joi.number().min(0).required(),
  tickLower: Joi.number().min(TickMath.MIN_TICK).max(TickMath.MAX_TICK).required(),
  tickUpper: Joi.number().min(TickMath.MIN_TICK).max(TickMath.MAX_TICK).required(),
  feeAmount: Joi.number().min(0).max(10_000).required(),
  recipient: Joi.string()
    .pattern(new RegExp(/^0x[a-fA-F0-9]{40}$/))
    .optional(),
  slippageTolerance: Joi.number().min(0).max(20).precision(2).optional(),
  deadline: Joi.number().max(10800).optional(), // 180 mins, same as interface max
  gasPriceWei: Joi.string()
  .pattern(/^[0-9]+$/)
  .max(30)
  .optional(),
  minSplits: Joi.number().max(7).optional(),
  errorTolerance: Joi.number().min(0).max(100).default(1).required(),
  maxIterations: Joi.number().min(1).max(10).default(5).required(),
}).and('recipient', 'slippageTolerance', 'deadline');

export type QuoteToRatioQueryParams = {
  token0Address: string;
  token0ChainId: number;
  token1Address: string;
  token1ChainId: number;
  token0Balance: number;
  token1Balance: number;
  tickLower: number;
  tickUpper: number;
  feeAmount: number;
  recipient?: string;
  slippageTolerance?: string;
  deadline?: string;
  gasPriceWei?: string;
  minSplits?: number;
  errorTolerance: number;
  maxIterations: number;
};
