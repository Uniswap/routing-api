import { ChainId } from '@uniswap/sdk-core'

import { GraphQLClient, IGraphQLClient } from './graphql-client'
import {
  GRAPHQL_QUERY_MULTIPLE_TOKEN_INFO_BY_CONTRACTS,
  GRAPHQL_QUERY_TOKEN_INFO_BY_ADDRESS_CHAIN,
} from './graphql-queries'
import { TokenInfoResponse, TokensInfoResponse } from './graphql-schemas'

/* Interface for accessing Uniswap GraphQL API */
export interface IUniGraphQLProvider {
  /* Fetch token info for a given chain and address */
  getTokenInfo(chainId: ChainId, address: string): Promise<TokenInfoResponse>
  /* Fetch token info for multiple tokens given a chain and addresses */
  getTokensInfo(chainId: ChainId, addresses: string[]): Promise<TokensInfoResponse>
  // Add more methods here as needed.
  // - more details: https://github.com/Uniswap/data-api-graphql/blob/main/graphql/schema.graphql
}

/* Implementation of the UniGraphQLProvider interface to give access to Uniswap GraphQL API */
export class UniGraphQLProvider implements IUniGraphQLProvider {
  private readonly endpoint = process.env.GQL_URL!
  private readonly headers = {
    Origin: process.env.GQL_H_ORGN!,
    'Content-Type': 'application/json',
  }
  private client: IGraphQLClient

  constructor() {
    this.client = new GraphQLClient(this.endpoint, this.headers)
  }

  /* Convert ChainId to a string recognized by data-graph-api graphql endpoint.
   *  GraphQL Chain Enum located here: https://github.com/Uniswap/data-api-graphql/blob/main/graphql/schema.graphql#L155
   *  */
  private _chainIdToGraphQLChainName(chainId: ChainId): string | undefined {
    switch (chainId) {
      case ChainId.MAINNET:
        return 'ETHEREUM'
      case ChainId.ARBITRUM_ONE:
        return 'ARBITRUM'
      case ChainId.AVALANCHE:
        return 'AVALANCHE'
      case ChainId.OPTIMISM:
        return 'OPTIMISM'
      case ChainId.POLYGON:
        return 'POLYGON'
      case ChainId.CELO:
        return 'CELO'
      case ChainId.BNB:
        return 'BNB'
      case ChainId.BASE:
        return 'BASE'
      case ChainId.BASE_SEPOLIA:
        return 'BASE_SEPOLIA'
      case ChainId.BLAST:
        return 'BLAST'
      case ChainId.ZORA:
        return 'ZORA'
      case ChainId.ZKSYNC:
        return 'ZKSYNC'
      case ChainId.WORLDCHAIN:
        return 'WORLDCHAIN'
      case ChainId.UNICHAIN_SEPOLIA:
        return 'UNICHAIN_SEPOLIA'
      case ChainId.MONAD_TESTNET:
        return 'MONAD_TESTNET'
      case ChainId.UNICHAIN:
        return 'UNICHAIN'
      case ChainId.SONEIUM:
        return 'SONEIUM'
      default:
        throw new Error(`UniGraphQLProvider._chainIdToGraphQLChainName unsupported ChainId: ${chainId}`)
    }
  }

  async getTokenInfo(chainId: ChainId, address: string): Promise<TokenInfoResponse> {
    const query = GRAPHQL_QUERY_TOKEN_INFO_BY_ADDRESS_CHAIN
    const variables = { chain: this._chainIdToGraphQLChainName(chainId), address: address }
    return this.client.fetchData<TokenInfoResponse>(query, variables)
  }

  async getTokensInfo(chainId: ChainId, addresses: string[]): Promise<TokensInfoResponse> {
    const query = GRAPHQL_QUERY_MULTIPLE_TOKEN_INFO_BY_CONTRACTS
    const contracts = addresses.map((address) => ({
      chain: this._chainIdToGraphQLChainName(chainId),
      address: address,
    }))
    const variables = { contracts: contracts }
    return this.client.fetchData<TokensInfoResponse>(query, variables)
  }
}
