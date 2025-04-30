/* Query to get the token info by address and chain */
export const GRAPHQL_QUERY_TOKEN_INFO_BY_ADDRESS_CHAIN = `
query Token($chain: Chain!, $address: String!) {
        token(chain: $chain, address: $address) {
            name
            chain
            address
            decimals
            symbol
            standard
            feeData {
                buyFeeBps
                sellFeeBps
                feeTakenOnTransfer
                externalTransferFailed
                sellReverted
            }
        }
    }
`

/* Query to get the token info by multiple addresses and chain */
export const GRAPHQL_QUERY_MULTIPLE_TOKEN_INFO_BY_CONTRACTS = `
query Tokens($contracts: [ContractInput!]!) {
      tokens(contracts: $contracts) {
          name
          chain
          address
          decimals
          symbol
          standard
          feeData {
              buyFeeBps
              sellFeeBps
              feeTakenOnTransfer
              externalTransferFailed
              sellReverted
          }
      }
    }
`
