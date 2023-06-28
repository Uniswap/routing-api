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
      tokenInAddress: '0x4200000000000000000000000000000000000006',
      tokenInChainId: 57000,
      tokenOutAddress: '0xcca991e1bdca2846640d366116d60bc25c2815db',
      tokenOutChainId: 57000,
      amount: '10000',
      type: 'exactIn',
    }

    const response: AxiosResponse<QuoteResponse> = await axios.post<QuoteResponse>(
      process.env.UNISWAP_ROUTING_API! + 'quote',
      quotePost
    )

    console.log({ response })
  })()
