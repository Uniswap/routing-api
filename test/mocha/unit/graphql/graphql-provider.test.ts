import { ChainId } from '@uniswap/sdk-core'
import { IUniGraphQLProvider, UniGraphQLProvider } from '../../../../lib/graphql/graphql-provider'
import sinon from 'sinon'
import { TokensInfoResponse } from '../../../../lib/graphql/graphql-schemas'
import { expect } from 'chai'

describe('UniGraphQLProvider', () => {
  let mockUniGraphQLProvider: sinon.SinonStubbedInstance<IUniGraphQLProvider>

  beforeEach(() => {
    mockUniGraphQLProvider = sinon.createStubInstance(UniGraphQLProvider)

    mockUniGraphQLProvider.getTokenInfo.callsFake(async (_: ChainId, address: string) => {
      return {
        token: {
          address: address,
          decimals: 18,
          name: `Wick Finance`,
          symbol: 'WICK',
          standard: 'ERC20',
          chain: 'ETHEREUM',
          feeData: {
            buyFeeBps: '213',
            sellFeeBps: '800',
          },
        },
      }
    })

    mockUniGraphQLProvider.getTokensInfo.callsFake(async (_: ChainId, addresses: string[]) => {
      const tokensInfoResponse: TokensInfoResponse = {
        tokens: [
          {
            address: addresses[0],
            decimals: 18,
            name: 'Wick Finance',
            symbol: 'WICK',
            standard: 'ERC20',
            chain: 'ETHEREUM',
            feeData: {
              buyFeeBps: '213',
              sellFeeBps: '800',
            },
          },
          {
            address: addresses[1],
            decimals: 18,
            name: 'Uniswap',
            symbol: 'UNI',
            standard: 'ERC20',
            chain: 'ETHEREUM',
            feeData: {
              buyFeeBps: '213',
              sellFeeBps: '800',
            },
          },
        ],
      }
      return tokensInfoResponse
    })
  })

  it('should fetch Ethereum token info', async () => {
    const address = '0xBbE460dC4ac73f7C13A2A2feEcF9aCF6D5083F9b'
    const chainId = ChainId.MAINNET

    const tokenInfoResponse = await mockUniGraphQLProvider.getTokenInfo(chainId, address)

    expect(tokenInfoResponse?.token).to.not.be.undefined
    expect(tokenInfoResponse.token.address).equals(address)
    expect(tokenInfoResponse.token.name).equals('Wick Finance')
    expect(tokenInfoResponse.token.symbol).equals('WICK')
  })

  it('should fetch multiple Ethereum token info', async () => {
    const chainId = ChainId.MAINNET
    const addresses = ['0xBbE460dC4ac73f7C13A2A2feEcF9aCF6D5083F9b', '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984']

    const tokensInfoResponse = await mockUniGraphQLProvider.getTokensInfo(chainId, addresses)

    expect(tokensInfoResponse?.tokens).to.not.be.undefined
    expect(tokensInfoResponse.tokens.length == 2)
    const token1 = tokensInfoResponse.tokens.find((tokenInfo) => tokenInfo.address === addresses[0])
    const token2 = tokensInfoResponse.tokens.find((tokenInfo) => tokenInfo.address === addresses[1])
    expect(token1).to.not.be.undefined
    expect(token2).to.not.be.undefined

    expect(token1?.symbol).equals('WICK')
    expect(token1?.feeData?.buyFeeBps).to.not.be.undefined
    expect(token2?.symbol).equals('UNI')
  })
})
