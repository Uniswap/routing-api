import { ChainId } from '@uniswap/sdk-core'
import { expect } from 'chai'
import { UniGraphQLProvider } from '../../../../lib/graphql/graphql-provider'
import dotenv from 'dotenv'

dotenv.config()

describe('integration test for UniGraphQLProvider', () => {
  let provider: UniGraphQLProvider

  beforeEach(() => {
    provider = new UniGraphQLProvider()
  })

  it('should fetch Ethereum token info', async () => {
    const address = '0xBbE460dC4ac73f7C13A2A2feEcF9aCF6D5083F9b'
    const chainId = ChainId.MAINNET
    const tokenInfoResponse = await provider.getTokenInfo(chainId, address)

    expect(tokenInfoResponse?.token).to.not.be.undefined
    expect(tokenInfoResponse.token.address).equals(address)
    expect(tokenInfoResponse.token.name).equals('Wick Finance')
    expect(tokenInfoResponse.token.symbol).equals('WICK')
    expect(tokenInfoResponse.token.feeData?.buyFeeBps).to.not.be.undefined
  })

  it('should fetch Ethereum low traffic token info', async () => {
    const address = '0x4a500ed6add5994569e66426588168705fcc9767'
    const chainId = ChainId.MAINNET
    const tokenInfoResponse = await provider.getTokenInfo(chainId, address)

    expect(tokenInfoResponse?.token).to.not.be.undefined
    expect(tokenInfoResponse.token.address).equals(address)
    expect(tokenInfoResponse.token.symbol).equals('BITBOY')
    expect(tokenInfoResponse.token.feeData?.buyFeeBps).to.not.be.undefined
    expect(tokenInfoResponse.token.feeData?.sellFeeBps).to.not.be.undefined
  })

  it('should fetch multiple Ethereum token info', async () => {
    const chainId = ChainId.MAINNET
    const addresses = ['0xBbE460dC4ac73f7C13A2A2feEcF9aCF6D5083F9b', '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984']
    const tokensInfoResponse = await provider.getTokensInfo(chainId, addresses)

    expect(tokensInfoResponse?.tokens).to.not.be.undefined
    expect(tokensInfoResponse.tokens.length == 2)
    const token1 = tokensInfoResponse.tokens.find((tokenInfo) => tokenInfo.address === addresses[0])
    const token2 = tokensInfoResponse.tokens.find((tokenInfo) => tokenInfo.address === addresses[1])
    expect(token1).to.not.be.undefined
    expect(token2).to.not.be.undefined

    expect(token1?.symbol).equals('WICK')
    expect(token1?.feeData?.buyFeeBps).to.not.be.undefined
    expect(token1?.feeData?.sellFeeBps).to.not.be.undefined
    expect(token2?.symbol).equals('UNI')
    expect(token2?.feeData?.buyFeeBps).to.be.null
    expect(token2?.feeData?.sellFeeBps).to.be.null
  })
})
