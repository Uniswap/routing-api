import sinon from 'sinon'
import { ChainId, Token, WETH9 } from '@uniswap/sdk-core'
import { expect } from 'chai'
import dotenv from 'dotenv'
import { GraphQLTokenPriceFetcher } from '../../../../lib/graphql/graphql-token-price-fetcher'
import { MetricLoggerUnit } from '@uniswap/smart-order-router'
import { UniGraphQLProvider } from '../../../../lib/graphql/graphql-provider'
import { metric } from '@uniswap/smart-order-router/build/main/util/metric'

dotenv.config()

// Example tokens with known prices
const BULLET = new Token(
  ChainId.MAINNET,
  '0x8ef32a03784c8Fd63bBf027251b9620865bD54B6',
  8,
  'BULLET',
  'Bullet Game Betting Token'
)

const BITBOY = new Token(ChainId.MAINNET, '0x4a500ed6add5994569e66426588168705fcc9767', 8, 'BITBOY', 'BitBoy Fund')

describe('integration test for GraphQLTokenPriceFetcher', () => {
  let tokenPriceFetcher: GraphQLTokenPriceFetcher

  beforeEach(() => {
    const chain = ChainId.MAINNET
    tokenPriceFetcher = new GraphQLTokenPriceFetcher(new UniGraphQLProvider(), chain)
  })

  it('Fetch WETH and BITBOY prices', async () => {
    const tokenPriceMap = await tokenPriceFetcher.fetchPrices([WETH9[ChainId.MAINNET]!.address, BITBOY.address])

    expect(tokenPriceMap[WETH9[ChainId.MAINNET]!.address]).to.not.be.undefined
    expect(tokenPriceMap[WETH9[ChainId.MAINNET]!.address]?.price).to.not.be.undefined
    expect(tokenPriceMap[BITBOY.address]).to.not.be.undefined
    expect(tokenPriceMap[BITBOY.address]?.price).to.not.be.undefined
  })

  it('Fetch BULLET and BITBOY prices', async () => {
    const spyGraphQLFetcher = sinon.spy(tokenPriceFetcher, 'fetchPrices')
    const spyPutMetric = sinon.spy(metric, 'putMetric')

    const tokenPriceMap = await tokenPriceFetcher.fetchPrices([BULLET.address, BITBOY.address])

    expect(tokenPriceMap[BULLET.address]).to.not.be.undefined
    expect(tokenPriceMap[BULLET.address]?.price).to.not.be.undefined
    expect(tokenPriceMap[BITBOY.address]).to.not.be.undefined
    expect(tokenPriceMap[BITBOY.address]?.price).to.not.be.undefined

    expect(spyGraphQLFetcher.calledOnce).to.be.true
    sinon.assert.calledWith(spyPutMetric, 'GraphQLTokenPriceFetcherFetchFeesSuccess', 1, MetricLoggerUnit.Count)

    spyGraphQLFetcher.restore()
    spyPutMetric.restore()
  })

  it('Should handle empty address list', async () => {
    const tokenPriceMap = await tokenPriceFetcher.fetchPrices([])
    expect(Object.keys(tokenPriceMap).length).to.equal(0)
  })

  it('Should handle invalid addresses gracefully - return 0 results', async () => {
    const invalidAddress = '0x1234567890123456789012345678901234567890'
    const tokenPriceMap = await tokenPriceFetcher.fetchPrices([invalidAddress])

    expect(Object.keys(tokenPriceMap).length).to.equal(0)
  })

  it('Should emit failure metric on API error', async () => {
    const spyPutMetric = sinon.spy(metric, 'putMetric')
    const graphQLProvider = new UniGraphQLProvider()

    // Force an error by stubbing the getTokensPrice method
    sinon.stub(graphQLProvider, 'getTokensPrice').rejects(new Error('API Error'))

    const errorPriceFetcher = new GraphQLTokenPriceFetcher(graphQLProvider, ChainId.MAINNET)
    await errorPriceFetcher.fetchPrices([BULLET.address])

    sinon.assert.calledWith(spyPutMetric, 'GraphQLTokenPriceFetcherFetchFeesFailure', 1, MetricLoggerUnit.Count)

    spyPutMetric.restore()
  })
})
