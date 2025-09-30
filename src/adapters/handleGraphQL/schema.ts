export const typeDefs = `#graphql
  type Query {
    """
    Get swap transaction statuses by transaction hashes
    """
    swaps(txHashes: [String!]!, chainId: Int!): SwapsResponse!

    """
    Get a quote for swapping tokens
    """
    quote(input: QuoteInput!): QuoteResponse!

    """
    Health check
    """
    health: String!
  }

  type SwapsResponse {
    requestId: String!
    swaps: [Swap!]!
  }

  type Swap {
    swapType: String
    status: SwapStatus
    txHash: String
    swapId: String
  }

  enum SwapStatus {
    PENDING
    SUCCESS
    NOT_FOUND
    FAILED
    EXPIRED
  }

  input QuoteInput {
    tokenInAddress: String!
    tokenInChainId: Int!
    tokenOutAddress: String!
    tokenOutChainId: Int!
    amount: String!
    type: String!
    swapper: String
    slippageTolerance: String
    deadline: Int
  }

  type QuoteResponse {
    routing: String!
    quote: QuoteDetails!
    allQuotes: [QuoteOption!]!
  }

  type QuoteOption {
    routing: String!
    quote: QuoteDetails!
  }

  type QuoteDetails {
    blockNumber: String!
    amount: String!
    amountDecimals: String!
    quote: String!
    quoteDecimals: String!
    quoteGasAdjusted: String!
    quoteGasAdjustedDecimals: String!
    gasUseEstimateQuote: String!
    gasUseEstimateQuoteDecimals: String!
    gasUseEstimate: String!
    gasUseEstimateUSD: String!
    simulationStatus: String!
    simulationError: Boolean!
    gasPriceWei: String!
    route: [[RoutePool!]!]!
    routeString: String!
    quoteId: String!
    hitsCachedRoutes: Boolean
    priceImpact: String
    swapper: String
  }

  type RoutePool {
    type: String!
    address: String!
    tokenIn: Token!
    tokenOut: Token!
    fee: String
    liquidity: String
    sqrtRatioX96: String
    tickCurrent: String
    amountIn: String
    amountOut: String
  }

  type Token {
    chainId: Int!
    decimals: String!
    address: String!
    symbol: String!
  }
`;