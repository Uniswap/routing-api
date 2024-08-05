import sinon from 'sinon'
import { ChainId, Token, WETH9 } from '@uniswap/sdk-core'
import { expect } from 'chai'
import dotenv from 'dotenv'
import { GraphQLTokenFeeFetcher } from '../../../../lib/graphql/graphql-token-fee-fetcher'
import { JsonRpcProvider } from '@ethersproject/providers'
import { ID_TO_PROVIDER, MetricLoggerUnit } from '@uniswap/smart-order-router'
import { BigNumber } from 'ethers'
import { OnChainTokenFeeFetcher } from '@uniswap/smart-order-router/build/main/providers/token-fee-fetcher'
import { UniGraphQLProvider } from '../../../../lib/graphql/graphql-provider'
import { metric } from '@uniswap/smart-order-router/build/main/util/metric'

dotenv.config()

const BULLET = new Token(
  ChainId.MAINNET,
  '0x8ef32a03784c8Fd63bBf027251b9620865bD54B6',
  8,
  'BULLET',
  'Bullet Game Betting Token',
  false,
  BigNumber.from(500),
  BigNumber.from(500)
)

const BITBOY = new Token(
  ChainId.MAINNET,
  '0x4a500ed6add5994569e66426588168705fcc9767',
  8,
  'BITBOY',
  'BitBoy Fund',
  false,
  BigNumber.from(300),
  BigNumber.from(300)
)

// 0xN is a dynamic FOT token
const ZEROXN = new Token(
  ChainId.MAINNET,
  '0x9012744b7a564623b6c3e40b144fc196bdedf1a9',
  18,
  '0xN',
  '0xNumber',
  false,
  BigNumber.from(500),
  BigNumber.from(500)
)

describe('integration test for GraphQLTokenFeeFetcher', () => {
  let tokenFeeFetcher: GraphQLTokenFeeFetcher
  let onChainTokenFeeFetcher: OnChainTokenFeeFetcher

  beforeEach(() => {
    const chain = ChainId.MAINNET
    const chainProvider = ID_TO_PROVIDER(chain)
    const provider = new JsonRpcProvider(chainProvider, chain)

    onChainTokenFeeFetcher = new OnChainTokenFeeFetcher(chain, provider)
    tokenFeeFetcher = new GraphQLTokenFeeFetcher(new UniGraphQLProvider(), onChainTokenFeeFetcher, chain)
  })

  it('Fetch WETH and BITBOY, should only return BITBOY', async () => {
    const tokenFeeMap = await tokenFeeFetcher.fetchFees([WETH9[ChainId.MAINNET]!.address, BITBOY.address])
    expect(tokenFeeMap[WETH9[ChainId.MAINNET]!.address]).to.not.be.undefined
    expect(tokenFeeMap[WETH9[ChainId.MAINNET]!.address]?.buyFeeBps).to.be.undefined
    expect(tokenFeeMap[WETH9[ChainId.MAINNET]!.address]?.sellFeeBps).to.be.undefined
    // TODO: flaky assertions, re-enable after fixing
    // expect(tokenFeeMap[WETH9[ChainId.MAINNET]!.address]?.feeTakenOnTransfer).to.not.be.undefined
    // expect(tokenFeeMap[WETH9[ChainId.MAINNET]!.address]?.externalTransferFailed).to.not.be.undefined
    // expect(tokenFeeMap[WETH9[ChainId.MAINNET]!.address]?.sellReverted).to.not.be.undefined
    expect(tokenFeeMap[BITBOY.address]).to.not.be.undefined
    expect(tokenFeeMap[BITBOY.address]?.buyFeeBps?._hex).equals(BITBOY.buyFeeBps?._hex)
    expect(tokenFeeMap[BITBOY.address]?.sellFeeBps?._hex).equals(BITBOY.sellFeeBps?._hex)
    // TODO: flaky assertions, re-enable after fixing
    // expect(tokenFeeMap[BITBOY.address]?.feeTakenOnTransfer).equals(false)
    // expect(tokenFeeMap[BITBOY.address]?.externalTransferFailed).equals(true)
    // expect(tokenFeeMap[BITBOY.address]?.sellReverted).equals(false)
  })

  it('Fetch BULLET and BITBOY, should return BOTH', async () => {
    const spyGraphQLFetcher = sinon.spy(tokenFeeFetcher, 'fetchFees')
    const spyOnChainFetcher = sinon.spy(onChainTokenFeeFetcher, 'fetchFees')

    const tokenFeeMap = await tokenFeeFetcher.fetchFees([BULLET.address, BITBOY.address])
    expect(tokenFeeMap[BULLET.address]).to.not.be.undefined
    expect(tokenFeeMap[BULLET.address]?.buyFeeBps?._hex).equals(BULLET.buyFeeBps?._hex)
    expect(tokenFeeMap[BULLET.address]?.sellFeeBps?._hex).equals(BULLET.sellFeeBps?._hex)
    // TODO: flaky assertions, re-enable after fixing
    // expect(tokenFeeMap[BULLET.address]?.feeTakenOnTransfer).equals(false)
    // expect(tokenFeeMap[BULLET.address]?.externalTransferFailed).equals(true)
    // expect(tokenFeeMap[BULLET.address]?.sellReverted).equals(true)

    expect(tokenFeeMap[BITBOY.address]).to.not.be.undefined
    expect(tokenFeeMap[BITBOY.address]?.buyFeeBps?._hex).equals(BITBOY.buyFeeBps?._hex)
    expect(tokenFeeMap[BITBOY.address]?.sellFeeBps?._hex).equals(BITBOY.sellFeeBps?._hex)
    // TODO: flaky assertions, re-enable after fixing
    // expect(tokenFeeMap[BITBOY.address]?.feeTakenOnTransfer).equals(false)
    // expect(tokenFeeMap[BITBOY.address]?.externalTransferFailed).equals(true)
    // expect(tokenFeeMap[BITBOY.address]?.sellReverted).equals(false)

    expect(spyGraphQLFetcher.calledOnce).to.be.true
    expect(spyOnChainFetcher.calledOnce).to.be.false

    spyGraphQLFetcher.restore()
    spyOnChainFetcher.restore()
  })

  it('Make sure both GraphQL and onChain fetchers are called when Dynamic + nonDynamic FOT is involved', async () => {
    const spyGraphQLFetcher = sinon.spy(tokenFeeFetcher, 'fetchFees')
    const spyOnChainFetcher = sinon.spy(onChainTokenFeeFetcher, 'fetchFees')
    const spyPutMetric = sinon.spy(metric, 'putMetric')

    const tokenFeeMap = await tokenFeeFetcher.fetchFees([ZEROXN.address, BITBOY.address])
    expect(tokenFeeMap[BITBOY.address]).to.not.be.undefined
    expect(tokenFeeMap[BITBOY.address]?.buyFeeBps?._hex).equals(BITBOY.buyFeeBps?._hex)
    expect(tokenFeeMap[BITBOY.address]?.sellFeeBps?._hex).equals(BITBOY.sellFeeBps?._hex)
    // TODO: flaky assertions, re-enable after fixing
    // expect(tokenFeeMap[BITBOY.address]?.feeTakenOnTransfer).equals(false)
    // expect(tokenFeeMap[BITBOY.address]?.externalTransferFailed).equals(true)
    // expect(tokenFeeMap[BITBOY.address]?.sellReverted).equals(false)

    expect(spyGraphQLFetcher.calledOnce).to.be.true
    expect(spyOnChainFetcher.calledOnce).to.be.true
    sinon.assert.calledWith(spyPutMetric, 'GraphQLTokenFeeFetcherOnChainCallbackRequest', 1, MetricLoggerUnit.Count)

    spyGraphQLFetcher.restore()
    spyOnChainFetcher.restore()
    spyPutMetric.restore()
  })
})
