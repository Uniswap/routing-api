import { ChainId, Token, WETH9 } from '@uniswap/sdk-core'
import { expect } from 'chai'
import dotenv from 'dotenv'
import { GraphQLTokenFeeFetcher } from '../../../../lib/graphql/graphql-token-fee-fetcher'
import { JsonRpcProvider } from '@ethersproject/providers'
import { ID_TO_PROVIDER } from '@uniswap/smart-order-router'
import { BigNumber } from 'ethers'

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

describe('integration test for GraphQLTokenFeeFetcher', () => {
  let tokenFeeFetcher: GraphQLTokenFeeFetcher

  beforeEach(() => {
    const chain = ChainId.MAINNET
    const chainProvider = ID_TO_PROVIDER(chain)
    const provider = new JsonRpcProvider(chainProvider, chain)

    tokenFeeFetcher = new GraphQLTokenFeeFetcher(chain, provider)
  })

  it('Fetch WETH and BITBOY, should only return BITBOY', async () => {
    const tokenFeeMap = await tokenFeeFetcher.fetchFees([WETH9[ChainId.MAINNET]!.address, BITBOY.address])
    expect(tokenFeeMap[WETH9[ChainId.MAINNET]!.address]).to.be.undefined
    expect(tokenFeeMap[BITBOY.address]).to.not.be.undefined
    expect(tokenFeeMap[BITBOY.address]?.buyFeeBps?._hex).equals(BITBOY.buyFeeBps?._hex)
    expect(tokenFeeMap[BITBOY.address]?.sellFeeBps?._hex).equals(BITBOY.sellFeeBps?._hex)
  })

  it('Fetch BULLET and BITBOY, should return BOTH', async () => {
    const tokenFeeMap = await tokenFeeFetcher.fetchFees([BULLET.address, BITBOY.address])
    expect(tokenFeeMap[BULLET.address]).to.not.be.undefined
    expect(tokenFeeMap[BULLET.address]?.buyFeeBps?._hex).equals(BULLET.buyFeeBps?._hex)
    expect(tokenFeeMap[BULLET.address]?.sellFeeBps?._hex).equals(BULLET.sellFeeBps?._hex)
    expect(tokenFeeMap[BITBOY.address]).to.not.be.undefined
    expect(tokenFeeMap[BITBOY.address]?.buyFeeBps?._hex).equals(BITBOY.buyFeeBps?._hex)
    expect(tokenFeeMap[BITBOY.address]?.sellFeeBps?._hex).equals(BITBOY.sellFeeBps?._hex)
  })
})
