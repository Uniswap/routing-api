/**
 * ts-node --project=tsconfig.cdk.json scripts/get_quote.ts
 */
import axios, { AxiosResponse } from 'axios'
import dotenv from 'dotenv'
import { QuoteQueryParams } from '../lib/handlers/quote/schema/quote-schema'
import { QuoteResponse } from '../lib/handlers/schema'
dotenv.config()
  ; (async function () {
    const quotePost: QuoteQueryParams = {
      tokenInAddress: 'PSYS',
      tokenInChainId: 57000,
      tokenOutAddress: 'WSYS',
      tokenOutChainId: 57000,
      amount: '50',
      type: 'exactIn',
      recipient: '0xc84633Af14e43F00D5aaa7A47B8d0864eE6a46FB',
      slippageTolerance: '5',
      deadline: '360',
      algorithm: 'alpha',
    }

    const response: AxiosResponse<QuoteResponse> = await axios.post<QuoteResponse>(
      process.env.UNISWAP_ROUTING_API! + 'quote',
      quotePost
    )

    console.log({ response })
  })()
