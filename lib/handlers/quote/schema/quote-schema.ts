import Joi from '@hapi/joi';
import { MethodParameters } from '@uniswap/v3-sdk';

export const QuoteBodySchemaJoi = Joi.object({
  tokenIn: Joi.object({
    address: Joi.string().alphanum().max(42).required(),
    chainId: Joi.number().valid(1).required(),
  }).required(),
  tokenOut: Joi.object({
    address: Joi.string().alphanum().max(42).required(),
    chainId: Joi.number().valid(1).required(),
  }).required(),
  amount: Joi.string()
    .pattern(/^[0-9]+$/)
    .max(77) // TODO: validate < 2**256
    .required(),
  type: Joi.string().valid('exactIn', 'exactOut').required(),
  recipient: Joi.string()
    .pattern(new RegExp(/^0x[a-fA-F0-9]{40}$/))
    .required(),
  slippageTolerance: Joi.number().min(0).max(20).precision(2).required(),
  deadline: Joi.number().max(600).required(),
  algorithm: Joi.string().valid('alpha', 'legacy').optional(),
});

export type QuoteBody = {
  tokenIn: {
    address: string;
    chainId: number;
  };
  tokenOut: {
    address: string;
    chainId: number;
  };
  type: string;
  amount: string;
  recipient: string;
  slippageTolerance: string;
  deadline: string;
  algorithm?: string;
};

export type NodeInRoute = {
  type: 'token';
  id: string;
  chainId: number;
  symbol: string;
};

export type EdgeInRoute = {
  type: 'pool';
  id: string;
  inId: string;
  outId: string;
  fee: string;
  percent: number;
};

export const QuoteResponseSchemaJoi = Joi.object({
  quoteId: Joi.string().required(),
  quote: Joi.string().required(),
  quoteDecimals: Joi.string().required(),
  quoteGasAdjusted: Joi.string().required(),
  quoteGasAdjustedDecimals: Joi.string().required(),
  gasUseEstimateQuote: Joi.string().required(),
  gasUseEstimateQuoteDecimals: Joi.string().required(),
  gasUseEstimate: Joi.string().required(),
  gasUseEstimateUSD: Joi.string().required(),
  gasPriceWei: Joi.string().required(),
  blockNumber: Joi.string().required(),
  routeNodes: Joi.array().items(Joi.any()).required(),
  routeEdges: Joi.array().items(Joi.any()).required(),
  routeString: Joi.string().required(),
  methodParameters: Joi.object({
    calldata: Joi.string().required(),
    value: Joi.string().required(),
  }),
});

export type QuoteResponse = {
  quoteId: string;
  quote: string;
  quoteDecimals: string;
  quoteGasAdjusted: string;
  quoteGasAdjustedDecimals: string;
  gasUseEstimate: string;
  gasUseEstimateQuote: string;
  gasUseEstimateQuoteDecimals: string;
  gasUseEstimateUSD: string;
  gasPriceWei: string;
  blockNumber: string;
  routeNodes: NodeInRoute[];
  routeEdges: EdgeInRoute[];
  routeString: string;
  methodParameters: MethodParameters;
};
