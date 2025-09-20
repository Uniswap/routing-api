import type { APIGatewayProxyEvent, Context, APIGatewayProxyResult } from 'aws-lambda'
import type { Request, Response } from 'express'
import { randomUUID } from 'crypto'

// Hardcoded constants to avoid SDK import issues
const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'

// Hardcoded WETH9 addresses for known chains
const WETH9: { [chainId: number]: { address: string } } = {
  1: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' }, // Mainnet WETH
  5115: { address: '0x4370e27F7d91D9341bFf232d7Ee8bdfE3a9933a0' }, // Citrea WcBTC
  11155111: { address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14' }, // Sepolia WETH
}

// Citrea Testnet Wrapped Token (hardcoded to avoid SDK issues)
const CITREA_WRAPPED_TOKEN = {
  chainId: 5115,
  address: '0x4370e27F7d91D9341bFf232d7Ee8bdfE3a9933a0',
  symbol: 'WcBTC'
}

// Helper to detect if an address is native currency
function isNativeCurrency(address: string): boolean {
  if (!address) return false
  const addr = address.toLowerCase()
  return addr === '0x0000000000000000000000000000000000000000' ||
         addr === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
}

function transformTradingApiRequest(body: any, query: any): any {
  let queryParams = { ...query }

  if (body) {
    const SUPPORTED_PROTOCOLS = ['v3']
    const tokenIn = body.tokenIn || body.tokenInAddress
    const tokenOut = body.tokenOut || body.tokenOutAddress

    queryParams.tokenInAddress = tokenIn === ADDRESS_ZERO ? WETH9[body.tokenInChainId]?.address || tokenIn : tokenIn
    queryParams.tokenOutAddress = tokenOut === ADDRESS_ZERO ? WETH9[body.tokenOutChainId]?.address || tokenOut : tokenOut
    queryParams.tokenInChainId = body.tokenInChainId
    queryParams.tokenOutChainId = body.tokenOutChainId
    queryParams.amount = body.amount
    queryParams.type = body.type === 'EXACT_OUTPUT' ? 'exactOut' : body.type === 'EXACT_INPUT' ? 'exactIn' : body.type
    if (body.swapper) queryParams.swapper = body.swapper
    if (body.protocols) {
      // Filter to only supported routing API protocols
      const supportedProtocols = body.protocols
        .map((p: string) => p.toLowerCase())
        .filter((p: string) => SUPPORTED_PROTOCOLS.includes(p))
      queryParams.protocols = supportedProtocols.join(',')
    }
  }

  return queryParams
}

// Generate a minimal wrap/unwrap quote response
function generateWrapUnwrapResponse(body: any, isWrap: boolean): any {
  const amount = body.amount || '0'
  const recipient = body.swapper || body.recipient || '0x0000000000000000000000000000000000000000'

  // Simple calldata for wrap (deposit) or unwrap (withdraw)
  // This is a simplified version - real implementation would encode properly
  const methodId = isWrap ? '0xd0e30db0' : '0x2e1a7d4d' // deposit() or withdraw(uint256)
  const calldata = isWrap
    ? methodId // deposit() has no parameters
    : methodId + amount.toString(16).padStart(64, '0') // withdraw(amount)

  // Create fake tokens for the route
  const cBTCToken = {
    address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    chainId: 5115,
    symbol: 'cBTC',
    decimals: 18,
    name: 'Citrea BTC'
  }

  const WcBTCToken = {
    address: CITREA_WRAPPED_TOKEN.address,
    chainId: 5115,
    symbol: 'WcBTC',
    decimals: 18,
    name: 'Wrapped Citrea BTC'
  }

  // Create a fake pool that the frontend can parse
  // This mimics a V3 pool structure with proper amountIn/amountOut
  const fakePool = {
    type: 'v3-pool',
    address: CITREA_WRAPPED_TOKEN.address,
    amountIn: amount,
    amountOut: amount, // 1:1 conversion
    fee: '0',
    sqrtRatioX96: '79228162514264337593543950336', // 1:1 price
    liquidity: '1000000000000000000',
    tickCurrent: '0',
    tokenIn: isWrap ? cBTCToken : WcBTCToken,
    tokenOut: isWrap ? WcBTCToken : cBTCToken
  }

  return {
    routing: isWrap ? 'WRAP' : 'UNWRAP',
    quote: {
      input: {
        token: isWrap ? cBTCToken : WcBTCToken,
        amount: amount
      },
      output: {
        token: isWrap ? WcBTCToken : cBTCToken,
        amount: amount // 1:1 conversion
      },
      chainId: 5115,
      tradeType: body.type === 'EXACT_OUTPUT' ? 'EXACT_OUTPUT' : 'EXACT_INPUT',
      methodParameters: {
        calldata: calldata,
        value: isWrap ? '0x' + BigInt(amount).toString(16) : '0x0',
        to: CITREA_WRAPPED_TOKEN.address
      },
      gasUseEstimate: '50000',
      gasPrice: '1000000000',
      swapper: recipient
    },
    allQuotes: []
  }
}

export function lambdaToExpress(
  handler: (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>
) {
  return async (req: Request, res: Response) => {
    try {
      // Check for Citrea wrap/unwrap operations FIRST
      if (req.body && req.body.tokenInChainId === 5115) {
        const tokenIn = req.body.tokenIn || req.body.tokenInAddress || ''
        const tokenOut = req.body.tokenOut || req.body.tokenOutAddress || ''

        const isNativeIn = isNativeCurrency(tokenIn)
        const isNativeOut = isNativeCurrency(tokenOut)
        const wrappedAddr = CITREA_WRAPPED_TOKEN.address.toLowerCase()

        // Check for WRAP (native cBTC -> WcBTC)
        if (isNativeIn && tokenOut.toLowerCase() === wrappedAddr) {
          const response = generateWrapUnwrapResponse(req.body, true)
          res.status(200).json(response)
          return
        }

        // Check for UNWRAP (WcBTC -> native cBTC)
        if (tokenIn.toLowerCase() === wrappedAddr && isNativeOut) {
          const response = generateWrapUnwrapResponse(req.body, false)
          res.status(200).json(response)
          return
        }
      }

      // Normal flow for non-wrap/unwrap operations
      const queryParams = transformTradingApiRequest(req.body, req.query)

      // Minimal event object with only the fields actually used by handlers
      const event: APIGatewayProxyEvent = {
        body: null,
        queryStringParameters: queryParams,
        headers: req.headers as any,
        // Unused by handlers but required by type
        httpMethod: req.method,
        path: req.path,
        resource: req.path,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        isBase64Encoded: false,
      }

      const context: Context = {
        awsRequestId: req.headers['x-request-id']?.toString() || randomUUID(),
        callbackWaitsForEmptyEventLoop: false,
        functionName: 'routing-api-local',
        functionVersion: '1',
        invokedFunctionArn: 'arn:aws:lambda:local:0:function:routing-api',
        memoryLimitInMB: '512',
        logGroupName: '/aws/lambda/routing-api-local',
        logStreamName: 'local',
        getRemainingTimeInMillis: () => 30000,
        done: () => undefined,
        fail: () => undefined,
        succeed: () => undefined,
      }

      const result = await handler(event, context)

      // Apply URA (Unified Routing API) wrapper format if this is a quote response
      let responseBody = result.body || ''
      if (result.statusCode === 200 && responseBody) {
        try {
          const routingApiResponse = JSON.parse(responseBody)
          if(req.body.swapper) routingApiResponse.swapper = req.body.swapper
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
          }
          responseBody = JSON.stringify(uraResponse)
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
}
