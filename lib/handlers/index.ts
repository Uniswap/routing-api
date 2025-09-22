import { lambdaToExpress } from './lambdaToHttp';
import { ADDRESS_ZERO } from '@juiceswapxyz/v3-sdk';
import { WETH9 } from '@juiceswapxyz/sdk-core';

const { quoteHandler } = require('./quoteHandler');


function transformTradingApiRequest(body: any, query: any): any {
  let queryParams = { ...query }

  if (body) {
    const SUPPORTED_PROTOCOLS = ['v3']
    const tokenIn = body.tokenIn || body.tokenInAddress
    const tokenOut = body.tokenOut || body.tokenOutAddress

    queryParams.tokenInAddress = tokenIn === ADDRESS_ZERO ? WETH9[body.tokenInChainId].address : tokenIn
    queryParams.tokenOutAddress = tokenOut === ADDRESS_ZERO ? WETH9[body.tokenOutChainId].address : tokenOut
    queryParams.tokenInChainId = body.tokenInChainId
    queryParams.tokenOutChainId = body.tokenOutChainId
    queryParams.amount = body.amount
    queryParams.type = body.type === 'EXACT_OUTPUT' ? 'exactOut' : body.type === 'EXACT_INPUT' ? 'exactIn' : body.type
    if (body.swapper) queryParams.swapper = body.swapper
    if (body.protocols) {
      const supportedProtocols = body.protocols
        .map((p: string) => p.toLowerCase())
        .filter((p: string) => SUPPORTED_PROTOCOLS.includes(p))
      queryParams.protocols = supportedProtocols.join(',')
    }
  }

  return queryParams
}

export async function handleQuoteRequest(req: any, res: any): Promise<any> {

  try {
    const queryParams = transformTradingApiRequest(req.body, req.query);
    const result = await lambdaToExpress(quoteHandler)(queryParams, req.headers);

    // Apply URA (Unified Routing API) wrapper format if this is a quote response
    let responseBody = result.body || '';
    if (result.statusCode === 200 && responseBody) {
      try {
        const routingApiResponse = JSON.parse(responseBody);
        if (req.body.swapper) routingApiResponse.swapper = req.body.swapper;
        // Wrap in URA format expected by frontend
        const uraResponse = {
          routing: 'CLASSIC',
          quote: routingApiResponse,
          allQuotes: [
            {
              routing: 'CLASSIC',
              quote: routingApiResponse
            }
          ]
        };
        responseBody = JSON.stringify(uraResponse);
      } catch (e) {
        // If parsing fails, send original response
      }
    }

    // Write result back
    if (result.headers) {
      for (const [k, v] of Object.entries(result.headers)) {
        if (v !== undefined) res.setHeader(k, v as string)
      }
    }

    res.status(result.statusCode || 200)
    res.send(responseBody)
  } catch (err: any) {
    res.status(502).json({ message: 'Internal server error', error: err?.message })
  }
}