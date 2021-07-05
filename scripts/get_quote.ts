/**
 * ts-node --project=tsconfig.cdk.json scripts/get_quote.ts
 */
import axios, { AxiosResponse } from 'axios';
import dotenv from 'dotenv';
import {
  QuoteBody,
  QuoteResponse,
} from '../lib/handlers/quote/schema/quote-schema';
dotenv.config();


(async function () {
  const quotePost: QuoteBody = {
    tokenIn: 'MKR',
    tokenOut: 'GRT',
    amount: '50',
    type: 'exactIn',
    chainId: 1,
    recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
    slippageTolerance: '5',
    deadline: '360',
    algorithm: 'alpha',
  };

  const response: AxiosResponse<QuoteResponse> =
    await axios.post<QuoteResponse>(
      process.env.UNISWAP_ROUTING_API! + 'quote',
      quotePost
    );

  console.log({ response });
})();
