import {
  ITokenPriceFetcher,
  TokenPricesMap,
} from '@uniswap/smart-order-router/build/main/providers/token-price-provider'
import { IUniGraphQLProvider } from './graphql-provider'
import { ProviderConfig } from '@uniswap/smart-order-router/build/main/providers/provider'
import { TokensPriceResponse } from './graphql-schemas'
import { ChainId } from '@uniswap/sdk-core'
import { metric } from '@uniswap/smart-order-router/build/main/util/metric'
import { log, MetricLoggerUnit } from '@uniswap/smart-order-router'

// Implementation of the ITokenFeeFetcher interface to give access to Uniswap GraphQL API token price data.
export class GraphQLTokenPriceFetcher implements ITokenPriceFetcher {
  private readonly graphQLProvider: IUniGraphQLProvider
  private readonly chainId: ChainId

  constructor(graphQLProvider: IUniGraphQLProvider, chainId: ChainId) {
    this.graphQLProvider = graphQLProvider
    this.chainId = chainId
  }

  async fetchPrices(addresses: string[], _providerConfig?: ProviderConfig): Promise<TokenPricesMap> {
    let tokenPricesMap: TokenPricesMap = {}

    try {
      if (addresses.length > 0) {
        const tokensPriceResponse: TokensPriceResponse = await this.graphQLProvider.getTokensPrice(
          this.chainId,
          addresses
        )
        tokensPriceResponse.tokens.forEach((token) => {
          if (token && token.market && token.market.price && token.market.price.value) {
            tokenPricesMap[token.address] = {
              price: token.market.price.value,
            }
          } else {
            tokenPricesMap[token.address] = {
              price: undefined,
            }
          }
        })
        metric.putMetric('GraphQLTokenPriceFetcherFetchFeesSuccess', 1, MetricLoggerUnit.Count)
      }
    } catch (err) {
      log.error({ err }, `Error calling GraphQLTokenPriceFetcher for tokens: ${addresses}`)

      metric.putMetric('GraphQLTokenPriceFetcherFetchFeesFailure', 1, MetricLoggerUnit.Count)
    }

    return tokenPricesMap
  }
}
