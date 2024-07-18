import { ITokenFeeFetcher } from '@uniswap/smart-order-router/build/main/providers/token-fee-fetcher'
import { IUniGraphQLProvider } from './graphql-provider'
import { TokenFeeMap } from '@uniswap/smart-order-router/build/main/providers/token-fee-fetcher'
import { ProviderConfig } from '@uniswap/smart-order-router/build/main/providers/provider'
import { TokensInfoResponse } from './graphql-schemas'
import { BigNumber } from 'ethers'
import { ChainId } from '@uniswap/sdk-core'
import { metric } from '@uniswap/smart-order-router/build/main/util/metric'
import { log, MetricLoggerUnit } from '@uniswap/smart-order-router'
import { TokenFeeUtils } from './token-fee-utils'

/* Implementation of the ITokenFeeFetcher interface to give access to Uniswap GraphQL API token fee data.
 * This fetcher is used to get token fees from GraphQL API and fallback to OnChainTokenFeeFetcher if GraphQL API fails
 * or not all addresses could be fetched.
 * Note: OnChainTokenFeeFetcher takes into account the provided blocknumber when retrieving token fees (through providerConfig),
 * but GraphQLTokenFeeFetcher always returns the latest token fee (GraphQl doesn't keep historical data).
 * FOT tax doesn't change often, hence ok to not use blocknumber here.
 * */
export class GraphQLTokenFeeFetcher implements ITokenFeeFetcher {
  private readonly graphQLProvider: IUniGraphQLProvider
  private readonly onChainFeeFetcherFallback: ITokenFeeFetcher
  private readonly chainId: ChainId

  constructor(
    graphQLProvider: IUniGraphQLProvider,
    onChainTokenFeeFetcherFallback: ITokenFeeFetcher,
    chainId: ChainId
  ) {
    this.graphQLProvider = graphQLProvider
    this.onChainFeeFetcherFallback = onChainTokenFeeFetcherFallback
    this.chainId = chainId
  }

  async fetchFees(addresses: string[], providerConfig?: ProviderConfig): Promise<TokenFeeMap> {
    let tokenFeeMap: TokenFeeMap = {}

    // Use GraphQL only for tokens that are not dynamic FOT. For dynamic FOT, use fallback (on chain) as we need latest data.
    const addressesToFetchFeesWithGraphQL = addresses.filter((address) => !TokenFeeUtils.isDynamicFOT(address))
    try {
      if (addressesToFetchFeesWithGraphQL.length > 0) {
        const tokenFeeResponse: TokensInfoResponse = await this.graphQLProvider.getTokensInfo(
          this.chainId,
          addressesToFetchFeesWithGraphQL
        )
        tokenFeeResponse.tokens.forEach((token) => {
          if (token.feeData?.buyFeeBps || token.feeData?.sellFeeBps) {
            const buyFeeBps = token.feeData.buyFeeBps ? BigNumber.from(token.feeData.buyFeeBps) : undefined
            const sellFeeBps = token.feeData.sellFeeBps ? BigNumber.from(token.feeData.sellFeeBps) : undefined
            const feeTakenOnTransfer = token.feeData.feeTakenOnTransfer
            const externalTransferFailed = token.feeData.externalTransferFailed
            const sellReverted = token.feeData.sellReverted
            tokenFeeMap[token.address] = {
              buyFeeBps,
              sellFeeBps,
              feeTakenOnTransfer,
              externalTransferFailed,
              sellReverted,
            }
          } else {
            tokenFeeMap[token.address] = {
              buyFeeBps: undefined,
              sellFeeBps: undefined,
              feeTakenOnTransfer: false,
              externalTransferFailed: false,
              sellReverted: false,
            }
          }
        })
        metric.putMetric('GraphQLTokenFeeFetcherFetchFeesSuccess', 1, MetricLoggerUnit.Count)
      }
    } catch (err) {
      log.error({ err }, `Error calling GraphQLTokenFeeFetcher for tokens: ${addressesToFetchFeesWithGraphQL}`)

      metric.putMetric('GraphQLTokenFeeFetcherFetchFeesFailure', 1, MetricLoggerUnit.Count)
    }

    // If we couldn't fetch all addresses from GraphQL then use fallback on chain fetcher for the rest.
    const addressesToFetchFeesWithFallbackFetcher = addresses.filter((address) => !tokenFeeMap[address])
    if (addressesToFetchFeesWithFallbackFetcher.length > 0) {
      metric.putMetric('GraphQLTokenFeeFetcherOnChainCallbackRequest', 1, MetricLoggerUnit.Count)
      try {
        const tokenFeeMapFromFallback = await this.onChainFeeFetcherFallback.fetchFees(
          addressesToFetchFeesWithFallbackFetcher,
          providerConfig
        )
        tokenFeeMap = {
          ...tokenFeeMap,
          ...tokenFeeMapFromFallback,
        }
      } catch (err) {
        log.error(
          { err },
          `Error fetching fees for tokens ${addressesToFetchFeesWithFallbackFetcher} using onChain fallback`
        )
      }
    }

    return tokenFeeMap
  }
}
