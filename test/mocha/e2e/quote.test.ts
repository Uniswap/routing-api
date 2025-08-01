import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { AllowanceTransfer, PERMIT2_ADDRESS, PermitSingle } from '@uniswap/permit2-sdk'
import { ChainId, Currency, CurrencyAmount, Ether, Fraction, Rounding, Token, WETH9 } from '@uniswap/sdk-core'
import {
  CEUR_CELO,
  CEUR_CELO_ALFAJORES,
  CUSD_CELO,
  CUSD_CELO_ALFAJORES,
  DAI_MAINNET,
  ID_TO_NETWORK_NAME,
  MethodParameters,
  NATIVE_CURRENCY,
  parseAmount,
  SWAP_ROUTER_02_ADDRESSES,
  USDB_BLAST,
  USDC_BNB,
  USDC_MAINNET,
  USDC_NATIVE_ARBITRUM,
  USDC_NATIVE_AVAX,
  USDC_NATIVE_BASE,
  USDC_NATIVE_OPTIMISM,
  USDC_NATIVE_POLYGON,
  USDC_NATIVE_SEPOLIA,
  USDC_SONEIUM,
  USDT_MAINNET,
  V4_SEPOLIA_TEST_A,
  V4_SEPOLIA_TEST_B,
  V4_SUPPORTED,
  WBTC_MAINNET,
  WLD_WORLDCHAIN,
} from '@uniswap/smart-order-router'
import {
  UNIVERSAL_ROUTER_ADDRESS as UNIVERSAL_ROUTER_ADDRESS_BY_CHAIN,
  UniversalRouterVersion,
} from '@uniswap/universal-router-sdk'
import { fail } from 'assert'
import axiosStatic, { AxiosResponse } from 'axios'
import axiosRetry from 'axios-retry'
import chai, { expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiSubset from 'chai-subset'
import { BigNumber, providers, Wallet } from 'ethers'
import hre from 'hardhat'
import _ from 'lodash'
import qs from 'qs'
import { SUPPORTED_CHAINS } from '../../../lib/handlers/injector-sor'
import { QuoteQueryParams, TradeTypeParam } from '../../../lib/handlers/quote/schema/quote-schema'
import { QuoteResponse } from '../../../lib/handlers/schema'
import { Permit2__factory } from '../../../lib/types/ext'
import { resetAndFundAtBlock } from '../../utils/forkAndFund'
import { getBalance, getBalanceAndApprove } from '../../utils/getBalanceAndApprove'
import { DAI_ON, getAmount, getAmountFromToken, UNI_MAINNET, USDC_ON, USDT_ON, WNATIVE_ON } from '../../utils/tokens'
import { FLAT_PORTION, GREENLIST_TOKEN_PAIRS, Portion } from '../../test-utils/mocked-data'
import { WRAPPED_NATIVE_CURRENCY } from '@uniswap/smart-order-router/build/main/index'
import { getFirstNonDelegatedSigner } from '../../utils/getFirstNonDelegatedSigner'

const { ethers } = hre

chai.use(chaiAsPromised)
chai.use(chaiSubset)

const UNIVERSAL_ROUTER_ADDRESS = UNIVERSAL_ROUTER_ADDRESS_BY_CHAIN(UniversalRouterVersion.V2_0, 1)

if (!process.env.UNISWAP_ROUTING_API || !process.env.ARCHIVE_NODE_RPC || !process.env.UNICORN_SECRET) {
  throw new Error(
    'Must set UNISWAP_ROUTING_API and ARCHIVE_NODE_RPC and UNICORN_SECRET env variables for integ tests. See README'
  )
}

const API = `${process.env.UNISWAP_ROUTING_API!}quote`
const unicornSecret = `${process.env.UNICORN_SECRET}`

const SLIPPAGE = '5'
const LARGE_SLIPPAGE = '20'

const ALL_PROTOCOLS = 'v2,v3,v4,mixed'

const HEADERS_1_2 = {
  'x-universal-router-version': '1.2',
}

const HEADERS_2_0 = {
  'x-universal-router-version': '2.0',
}

const BULLET = new Token(
  ChainId.MAINNET,
  '0x8ef32a03784c8Fd63bBf027251b9620865bD54B6',
  8,
  'BULLET',
  'Bullet Game Betting Token'
)
const BULLET_WHT_TAX = new Token(
  ChainId.MAINNET,
  '0x8ef32a03784c8Fd63bBf027251b9620865bD54B6',
  8,
  'BULLET',
  'Bullet Game Betting Token',
  false,
  BigNumber.from(500),
  BigNumber.from(500)
)
export const DFNDR = new Token(
  ChainId.MAINNET,
  '0x3f57c35633cb29834bb7577ba8052eab90f52a02',
  18,
  'DFNDR',
  'Defender Bot',
  false
)
export const DFNDR_WITH_TAX = new Token(
  ChainId.MAINNET,
  '0x3f57c35633cb29834bb7577ba8052eab90f52a02',
  18,
  'DFNDR',
  'Defender Bot',
  false,
  BigNumber.from(500),
  BigNumber.from(500)
)

const V2_SUPPORTED_PAIRS = [
  [WETH9[ChainId.ARBITRUM_ONE], USDC_NATIVE_ARBITRUM],
  [WETH9[ChainId.OPTIMISM], USDC_NATIVE_OPTIMISM],
  [WRAPPED_NATIVE_CURRENCY[ChainId.POLYGON], USDC_NATIVE_POLYGON],
  [WETH9[ChainId.BASE], USDC_NATIVE_BASE],
  [WRAPPED_NATIVE_CURRENCY[ChainId.BNB], USDC_BNB],
  [WRAPPED_NATIVE_CURRENCY[ChainId.AVALANCHE], USDC_NATIVE_AVAX],
  [WRAPPED_NATIVE_CURRENCY[ChainId.SONEIUM], USDC_SONEIUM],
]

const axios = axiosStatic.create()
axiosRetry(axios, {
  retries: 10,
  retryCondition: (err) => err.response?.status == 429,
  retryDelay: axiosRetry.exponentialDelay,
})

const callAndExpectFail = async (quoteReq: Partial<QuoteQueryParams>, resp: { status: number; data: any }) => {
  const queryParams = qs.stringify(quoteReq)
  try {
    await axios.get<QuoteResponse>(`${API}?${queryParams}`, { headers: HEADERS_2_0 })
    fail()
  } catch (err: any) {
    expect(err.response).to.containSubset(resp)
  }
}

const checkQuoteToken = (
  before: CurrencyAmount<Currency>,
  after: CurrencyAmount<Currency>,
  tokensQuoted: CurrencyAmount<Currency>,
  slippage: string = SLIPPAGE
) => {
  // Check which is bigger to support exactIn and exactOut
  const tokensSwapped = after.greaterThan(before) ? after.subtract(before) : before.subtract(after)

  const tokensDiff = tokensQuoted.greaterThan(tokensSwapped)
    ? tokensQuoted.subtract(tokensSwapped)
    : tokensSwapped.subtract(tokensQuoted)
  const percentDiff = tokensDiff.asFraction.divide(tokensQuoted.asFraction)
  expect(percentDiff.lessThan(new Fraction(parseInt(slippage), 100))).to.be.true
}

const checkPortionRecipientToken = (
  before: CurrencyAmount<Currency>,
  after: CurrencyAmount<Currency>,
  expectedPortionAmountReceived: CurrencyAmount<Currency>
) => {
  const actualPortionAmountReceived = after.subtract(before)

  const tokensDiff = expectedPortionAmountReceived.greaterThan(actualPortionAmountReceived)
    ? expectedPortionAmountReceived.subtract(actualPortionAmountReceived)
    : actualPortionAmountReceived.subtract(expectedPortionAmountReceived)
  // There will be a slight difference between expected and actual due to slippage during the hardhat fork swap.
  const percentDiff = tokensDiff.asFraction.divide(expectedPortionAmountReceived.asFraction)
  expect(percentDiff.lessThan(new Fraction(parseInt(SLIPPAGE), 100))).to.be.true
}

let warnedTesterPK = false
const isTesterPKEnvironmentSet = (): boolean => {
  const isSet = !!process.env.TESTER_PK
  if (!isSet && !warnedTesterPK) {
    console.log('Skipping tests requiring real PK since env variables for TESTER_PK is not set.')
    warnedTesterPK = true
  }
  return isSet
}

const MAX_UINT160 = '0xffffffffffffffffffffffffffffffffffffffff'

const TRADE_TYPES: TradeTypeParam[] = ['exactIn', 'exactOut']

export const agEUR_MAINNET = new Token(
  ChainId.MAINNET,
  '0x1a7e4e63778B4f12a199C062f3eFdD288afCBce8',
  18,
  'agEUR',
  'agEur'
)

export const XSGD_MAINNET = new Token(ChainId.MAINNET, '0x70e8dE73cE538DA2bEEd35d14187F6959a8ecA96', 6, 'XSGD', 'XSGD')

// reasonably sized token amounts for integ tests
export function getTestAmount(currency: Currency): string {
  switch (currency) {
    case agEUR_MAINNET:
      return '1000'
    case XSGD_MAINNET:
      return '1000'
    case DAI_ON(ChainId.MAINNET):
      return '1000'
    case WBTC_MAINNET:
      return '1'
    default:
      return '10'
  }
}

const checkAbsoluteDifference = (actual: string, expected: string, threshold: number = 0.001) => {
  const actualNum = parseFloat(actual)
  const expectedNum = parseFloat(expected)
  const percentDiff = Math.abs((actualNum - expectedNum) / expectedNum)
  expect(
    percentDiff <= threshold,
    `Expected ${actual} to be within ${threshold * 100}% of ${expected}, but difference was ${percentDiff * 100}%`
  ).to.be.true
}

describe('quote', function () {
  // Help with test flakiness by retrying.
  this.retries(3)

  this.timeout('500s')

  let alice: SignerWithAddress
  let block: number
  let curNonce: number = 0
  let nextPermitNonce: () => string = () => {
    const nonce = curNonce.toString()
    curNonce = curNonce + 1
    return nonce
  }

  const executeSwap = async (
    methodParameters: MethodParameters,
    currencyIn: Currency,
    currencyOut: Currency,
    permit?: boolean,
    chainId = ChainId.MAINNET,
    portion?: Portion,
    universalRouterAddress: string = UNIVERSAL_ROUTER_ADDRESS
  ): Promise<{
    tokenInAfter: CurrencyAmount<Currency>
    tokenInBefore: CurrencyAmount<Currency>
    tokenOutAfter: CurrencyAmount<Currency>
    tokenOutBefore: CurrencyAmount<Currency>
    tokenOutPortionRecipientBefore?: CurrencyAmount<Currency>
    tokenOutPortionRecipientAfter?: CurrencyAmount<Currency>
  }> => {
    const permit2 = Permit2__factory.connect(PERMIT2_ADDRESS, alice)
    const portionRecipientSigner = portion?.recipient ? await ethers.getSigner(portion?.recipient) : undefined

    // Approve Permit2
    const tokenInBefore = await getBalanceAndApprove(alice, PERMIT2_ADDRESS, currencyIn)
    const tokenOutBefore = await getBalance(alice, currencyOut)
    const tokenOutPortionRecipientBefore = portionRecipientSigner
      ? await getBalance(portionRecipientSigner, currencyOut)
      : undefined

    // Approve SwapRouter02 in case we request calldata for it instead of Universal Router
    await getBalanceAndApprove(alice, SWAP_ROUTER_02_ADDRESSES(chainId), currencyIn)

    // If not using permit do a regular approval allowing narwhal max balance.
    if (!permit) {
      const approveNarwhal = await permit2.approve(
        currencyIn.wrapped.address,
        universalRouterAddress,
        MAX_UINT160,
        100000000000000
      )
      await approveNarwhal.wait()
    }

    const transaction = {
      data: methodParameters.calldata,
      to: methodParameters.to,
      value: BigNumber.from(methodParameters.value),
      from: alice.address,
      gasPrice: BigNumber.from(2000000000000),
      type: 1,
    }

    const transactionResponse: providers.TransactionResponse = await alice.sendTransaction(transaction)
    await transactionResponse.wait()

    const tokenInAfter = await getBalance(alice, currencyIn)
    const tokenOutAfter = await getBalance(alice, currencyOut)
    const tokenOutPortionRecipientAfter = portionRecipientSigner
      ? await getBalance(portionRecipientSigner, currencyOut)
      : undefined

    return {
      tokenInAfter,
      tokenInBefore,
      tokenOutAfter,
      tokenOutBefore,
      tokenOutPortionRecipientBefore,
      tokenOutPortionRecipientAfter,
    }
  }

  before(async function () {
    this.timeout(40000)
    alice = await getFirstNonDelegatedSigner(await ethers.getSigners())

    // Make a dummy call to the API to get a block number to fork from.
    const quoteReq: QuoteQueryParams = {
      tokenInAddress: 'USDC',
      tokenInChainId: 1,
      tokenOutAddress: 'USDT',
      tokenOutChainId: 1,
      amount: await getAmount(1, 'exactIn', 'USDC', 'USDT', '100'),
      type: 'exactIn',
      protocols: ALL_PROTOCOLS,
    }

    const {
      data: { blockNumber },
    } = await axios.get<QuoteResponse>(`${API}?${qs.stringify(quoteReq)}`, { headers: HEADERS_2_0 })

    block = parseInt(blockNumber) - 10

    alice = await resetAndFundAtBlock(alice, block, [
      parseAmount('8000000', USDC_MAINNET),
      parseAmount('5000000', USDT_MAINNET),
      parseAmount('10', WBTC_MAINNET),
      parseAmount('1000', UNI_MAINNET),
      parseAmount('4000', WETH9[1]),
      parseAmount('5000000', DAI_MAINNET),
      parseAmount('735871', BULLET),
    ])

    // alice should always have 10000 ETH
    const aliceEthBalance = await getBalance(alice, Ether.onChain(1))
    /// Since alice is deploying the QuoterV3 contract, expect to have slightly less than 10_000 ETH but not too little
    expect(!aliceEthBalance.lessThan(CurrencyAmount.fromRawAmount(Ether.onChain(1), '9995'))).to.be.true

    // for all other balance checks, we ensure they are at least X amount. There's a possibility for more than X token amount,
    // due to a single whale address being whale for more than one token.
    const aliceUSDCBalance = await getBalance(alice, USDC_MAINNET)
    expect(!aliceUSDCBalance.lessThan(parseAmount('8000000', USDC_MAINNET))).to.be.true
    const aliceUSDTBalance = await getBalance(alice, USDT_MAINNET)
    expect(!aliceUSDTBalance.lessThan(parseAmount('5000000', USDT_MAINNET))).to.be.true
    const aliceWETH9Balance = await getBalance(alice, WETH9[1])
    expect(!aliceWETH9Balance.lessThan(parseAmount('4000', WETH9[1]))).to.be.true
    const aliceWBTCBalance = await getBalance(alice, WBTC_MAINNET)
    expect(!aliceWBTCBalance.lessThan(parseAmount('10', WBTC_MAINNET))).to.be.true
    const aliceDAIBalance = await getBalance(alice, DAI_MAINNET)
    expect(!aliceDAIBalance.lessThan(parseAmount('5000000', DAI_MAINNET))).to.be.true
    const aliceUNIBalance = await getBalance(alice, UNI_MAINNET)
    expect(!aliceUNIBalance.lessThan(parseAmount('1000', UNI_MAINNET))).to.be.true
    const aliceBULLETBalance = await getBalance(alice, BULLET)
    expect(!aliceBULLETBalance.lessThan(parseAmount('735871', BULLET))).to.be.true
  })

  for (const algorithm of ['alpha']) {
    for (const type of TRADE_TYPES) {
      describe(`${ID_TO_NETWORK_NAME(1)} ${algorithm} ${type} 2xx`, () => {
        describe(`+ Execute Swap`, () => {
          for (const uraVersion of [UniversalRouterVersion.V1_2, UniversalRouterVersion.V2_0]) {
            describe(`erc20 -> erc20 (uraVersion:${uraVersion})`, async () => {
              const hitsCachedRoutes = [true, false]
              hitsCachedRoutes.forEach((hitsCachedRoutes) => {
                it(`should hit cached routes ${hitsCachedRoutes}`, async () => {
                  if (uraVersion === UniversalRouterVersion.V2_0 && !hitsCachedRoutes) {
                    // v2.0 and hits cached routes false will hit v4
                    return
                  }

                  const useCachedRoutes = { useCachedRoutes: hitsCachedRoutes }

                  const quoteReq: QuoteQueryParams = {
                    tokenInAddress: 'USDC',
                    tokenInChainId: 1,
                    tokenOutAddress: 'USDT',
                    tokenOutChainId: 1,
                    amount: await getAmount(1, type, 'USDC', 'USDT', '100'),
                    type,
                    recipient: alice.address,
                    slippageTolerance: SLIPPAGE,
                    deadline: '360',
                    algorithm,
                    enableUniversalRouter: true,
                    protocols: protocols,
                    debugRoutingConfig: JSON.stringify(useCachedRoutes),
                    unicornSecret: unicornSecret,
                  }

                  const queryParams = qs.stringify(quoteReq)

                  const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(
                    `${API}?${queryParams}`,
                    {
                      headers: headers,
                    }
                  )
                  const {
                    data: { quote, quoteDecimals, quoteGasAdjustedDecimals, methodParameters, priceImpact },
                    status,
                  } = response

                  expect(status).to.equal(200)
                  expect(parseFloat(quoteDecimals)).to.be.greaterThan(90)
                  expect(parseFloat(quoteDecimals)).to.be.lessThan(110)

                  expect(Number(priceImpact)).to.be.greaterThanOrEqual(0)

                  if (type == 'exactIn') {
                    expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals))
                  } else {
                    expect(parseFloat(quoteGasAdjustedDecimals)).to.be.greaterThanOrEqual(parseFloat(quoteDecimals))
                  }

                  expect(methodParameters).to.not.be.undefined
                  expect(methodParameters?.to).to.equal(UNIVERSAL_ROUTER_ADDRESS_BY_CHAIN(uraVersion, ChainId.MAINNET))

                  const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(
                    methodParameters!,
                    USDC_MAINNET,
                    USDT_MAINNET,
                    undefined,
                    ChainId.MAINNET,
                    undefined,
                    UNIVERSAL_ROUTER_ADDRESS_BY_CHAIN(uraVersion, ChainId.MAINNET)
                  )

                  if (type == 'exactIn') {
                    expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('100')
                    checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(USDT_MAINNET, quote))
                  } else {
                    expect(tokenOutAfter.subtract(tokenOutBefore).toExact()).to.equal('100')
                    checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(USDC_MAINNET, quote))
                  }

                  // if it's exactIn quote, there's a slight chance the first quote request might be cache miss.
                  // but this is okay because each test case retries 3 times, so 2nd exactIn quote is def expected to hit cached routes.
                  // if it's exactOut quote, we should always hit the cached routes.
                  // this is regardless of protocol version.
                  // the reason is because exact in quote always runs before exact out
                  // along with the native or wrapped native pool token address assertions previously
                  // it ensures the cached routes will always cache wrapped native for v2,v3 pool routes
                  // and native for v4 pool routes
                  expect(response.data.hitsCachedRoutes).to.equal(hitsCachedRoutes)
                })
              })

              let protocols = ALL_PROTOCOLS
              let headers = HEADERS_2_0
              if (uraVersion === UniversalRouterVersion.V1_2) {
                protocols = ALL_PROTOCOLS
                headers = HEADERS_1_2
              }

              const quoteReq: QuoteQueryParams = {
                tokenInAddress: 'USDC',
                tokenInChainId: 1,
                tokenOutAddress: 'USDT',
                tokenOutChainId: 1,
                amount: await getAmount(1, type, 'USDC', 'USDT', '100'),
                type,
                recipient: alice.address,
                slippageTolerance: SLIPPAGE,
                deadline: '360',
                algorithm,
                enableUniversalRouter: true,
                protocols: protocols,
              }

              const queryParams = qs.stringify(quoteReq)

              const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(`${API}?${queryParams}`, {
                headers: headers,
              })
              const {
                data: { quote, quoteDecimals, quoteGasAdjustedDecimals, methodParameters, priceImpact },
                status,
              } = response

              expect(status).to.equal(200)
              expect(parseFloat(quoteDecimals)).to.be.greaterThan(90)
              expect(parseFloat(quoteDecimals)).to.be.lessThan(110)

              expect(Number(priceImpact)).to.be.greaterThan(0)

              if (type == 'exactIn') {
                expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals))
              } else {
                expect(parseFloat(quoteGasAdjustedDecimals)).to.be.greaterThanOrEqual(parseFloat(quoteDecimals))
              }

              expect(methodParameters).to.not.be.undefined
              expect(methodParameters?.to).to.equal(UNIVERSAL_ROUTER_ADDRESS_BY_CHAIN(uraVersion, ChainId.MAINNET))

              const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(
                methodParameters!,
                USDC_MAINNET,
                USDT_MAINNET,
                undefined,
                ChainId.MAINNET,
                undefined,
                UNIVERSAL_ROUTER_ADDRESS_BY_CHAIN(uraVersion, ChainId.MAINNET)
              )

              if (type == 'exactIn') {
                expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('100')
                checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(USDT_MAINNET, quote))
              } else {
                expect(tokenOutAfter.subtract(tokenOutBefore).toExact()).to.equal('100')
                checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(USDC_MAINNET, quote))
              }

              // if it's exactIn quote, there's a slight chance the first quote request might be cache miss.
              // but this is okay because each test case retries 3 times, so 2nd exactIn quote is def expected to hit cached routes.
              // if it's exactOut quote, we should always hit the cached routes.
              // this is regardless of protocol version.
              // the reason is because exact in quote always runs before exact out
              // along with the native or wrapped native pool token address assertions previously
              // it ensures the cached routes will always cache wrapped native for v2,v3 pool routes
              // and native for v4 pool routes
              expect(response.data.hitsCachedRoutes).to.be.true
            })
          }

          it(`erc20 -> erc20 swaprouter02`, async () => {
            const quoteReq: QuoteQueryParams = {
              tokenInAddress: 'USDC',
              tokenInChainId: 1,
              tokenOutAddress: 'USDT',
              tokenOutChainId: 1,
              amount: await getAmount(1, type, 'USDC', 'USDT', '100'),
              type,
              recipient: alice.address,
              slippageTolerance: SLIPPAGE,
              deadline: '360',
              algorithm,
              protocols: 'v2,v3,mixed',
            }

            const queryParams = qs.stringify(quoteReq)

            const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(`${API}?${queryParams}`, {
              headers: HEADERS_1_2,
            })
            const {
              data: { quote, quoteDecimals, quoteGasAdjustedDecimals, methodParameters },
              status,
            } = response

            expect(status).to.equal(200)
            expect(parseFloat(quoteDecimals)).to.be.greaterThan(90)
            expect(parseFloat(quoteDecimals)).to.be.lessThan(110)

            if (type == 'exactIn') {
              expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals))
            } else {
              expect(parseFloat(quoteGasAdjustedDecimals)).to.be.greaterThanOrEqual(parseFloat(quoteDecimals))
            }

            expect(methodParameters).to.not.be.undefined
            expect(methodParameters?.to).to.equal(SWAP_ROUTER_02_ADDRESSES(ChainId.MAINNET))

            const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(
              methodParameters!,
              USDC_MAINNET,
              USDT_MAINNET
            )

            if (type == 'exactIn') {
              expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('100')
              checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(USDT_MAINNET, quote))
            } else {
              expect(tokenOutAfter.subtract(tokenOutBefore).toExact()).to.equal('100')
              checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(USDC_MAINNET, quote))
            }

            // if it's exactIn quote, there's a slight chance the first quote request might be cache miss.
            // but this is okay because each test case retries 3 times, so 2nd exactIn quote is def expected to hit cached routes.
            // if it's exactOut quote, we should always hit the cached routes.
            // this is regardless of protocol version.
            // the reason is because exact in quote always runs before exact out
            // along with the native or wrapped native pool token address assertions previously
            // it ensures the cached routes will always cache wrapped native for v2,v3 pool routes
            // and native for v4 pool routes
            expect(response.data.hitsCachedRoutes).to.be.true
          })

          it(`erc20 -> erc20 with permit`, async () => {
            const amount = await getAmount(1, type, 'USDC', 'USDT', '10')

            const nonce = nextPermitNonce()

            const permit: PermitSingle = {
              details: {
                token: USDC_MAINNET.address,
                amount: '15000000', // For exact out we don't know the exact amount needed to permit, so just specify a large amount.
                expiration: Math.floor(new Date().getTime() / 1000 + 10000000).toString(),
                nonce,
              },
              spender: UNIVERSAL_ROUTER_ADDRESS,
              sigDeadline: Math.floor(new Date().getTime() / 1000 + 10000000).toString(),
            }

            const { domain, types, values } = AllowanceTransfer.getPermitData(permit, PERMIT2_ADDRESS, 1)

            const signature = await alice._signTypedData(domain, types, values)

            const quoteReq: QuoteQueryParams = {
              tokenInAddress: 'USDC',
              tokenInChainId: 1,
              tokenOutAddress: 'USDT',
              tokenOutChainId: 1,
              amount,
              type,
              recipient: alice.address,
              slippageTolerance: SLIPPAGE,
              deadline: '360',
              algorithm,
              permitSignature: signature,
              permitAmount: permit.details.amount.toString(),
              permitExpiration: permit.details.expiration.toString(),
              permitSigDeadline: permit.sigDeadline.toString(),
              permitNonce: permit.details.nonce.toString(),
              enableUniversalRouter: true,
              protocols: ALL_PROTOCOLS,
            }

            const queryParams = qs.stringify(quoteReq)

            const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(`${API}?${queryParams}`, {
              headers: HEADERS_2_0,
            })
            const {
              data: { quote, quoteDecimals, quoteGasAdjustedDecimals, methodParameters },
              status,
            } = response

            expect(status).to.equal(200)
            expect(parseFloat(quoteDecimals)).to.be.greaterThan(9)
            expect(parseFloat(quoteDecimals)).to.be.lessThan(11)

            if (type == 'exactIn') {
              expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals))
            } else {
              expect(parseFloat(quoteGasAdjustedDecimals)).to.be.greaterThanOrEqual(parseFloat(quoteDecimals))
            }

            expect(methodParameters).to.not.be.undefined
            expect(methodParameters?.to).to.equal(UNIVERSAL_ROUTER_ADDRESS)

            const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(
              methodParameters!,
              USDC_MAINNET,
              USDT_MAINNET,
              true
            )

            if (type == 'exactIn') {
              expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('10')
              checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(USDT_MAINNET, quote))
            } else {
              expect(tokenOutAfter.subtract(tokenOutBefore).toExact()).to.equal('10')
              checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(USDC_MAINNET, quote))
            }

            // if it's exactIn quote, there's a slight chance the first quote request might be cache miss.
            // but this is okay because each test case retries 3 times, so 2nd exactIn quote is def expected to hit cached routes.
            // if it's exactOut quote, we should always hit the cached routes.
            // this is regardless of protocol version.
            // the reason is because exact in quote always runs before exact out
            // along with the native or wrapped native pool token address assertions previously
            // it ensures the cached routes will always cache wrapped native for v2,v3 pool routes
            // and native for v4 pool routes
            expect(response.data.hitsCachedRoutes).to.be.true
          })

          it(`erc20 -> eth`, async () => {
            const quoteReq: QuoteQueryParams = {
              tokenInAddress: 'USDC',
              tokenInChainId: 1,
              tokenOutAddress: 'ETH',
              tokenOutChainId: 1,
              amount: await getAmount(1, type, 'USDC', 'ETH', type == 'exactIn' ? '1000000' : '10'),
              type,
              recipient: alice.address,
              slippageTolerance: SLIPPAGE,
              deadline: '360',
              algorithm,
              enableUniversalRouter: true,
              protocols: ALL_PROTOCOLS,
            }

            const queryParams = qs.stringify(quoteReq)

            const response = await axios.get<QuoteResponse>(`${API}?${queryParams}`, { headers: HEADERS_2_0 })
            const {
              data: { quote, methodParameters },
              status,
            } = response

            expect(status).to.equal(200)
            expect(methodParameters).to.not.be.undefined

            const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(
              methodParameters!,
              USDC_MAINNET,
              Ether.onChain(1)
            )

            if (type == 'exactIn') {
              expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('1000000')
              checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(Ether.onChain(1), quote))
            } else {
              // Hard to test ETH balance due to gas costs for approval and swap. Just check tokenIn changes
              checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(USDC_MAINNET, quote))
            }

            // if it's exactIn quote, there's a slight chance the first quote request might be cache miss.
            // but this is okay because each test case retries 3 times, so 2nd exactIn quote is def expected to hit cached routes.
            // if it's exactOut quote, we should always hit the cached routes.
            // this is regardless of protocol version.
            // the reason is because exact in quote always runs before exact out
            // along with the native or wrapped native pool token address assertions previously
            // it ensures the cached routes will always cache wrapped native for v2,v3 pool routes
            // and native for v4 pool routes
            expect(response.data.hitsCachedRoutes).to.be.true
          })

          it(`erc20 -> eth large trade`, async () => {
            // Trade of this size almost always results in splits.
            const quoteReq: QuoteQueryParams = {
              tokenInAddress: 'USDC',
              tokenInChainId: 1,
              tokenOutAddress: 'ETH',
              tokenOutChainId: 1,
              amount:
                type == 'exactIn'
                  ? await getAmount(1, type, 'USDC', 'ETH', '1000000')
                  : await getAmount(1, type, 'USDC', 'ETH', '100'),
              type,
              recipient: alice.address,
              slippageTolerance: LARGE_SLIPPAGE,
              deadline: '360',
              algorithm,
              enableUniversalRouter: true,
              protocols: ALL_PROTOCOLS,
            }

            const queryParams = qs.stringify(quoteReq)

            const response = await axios.get<QuoteResponse>(`${API}?${queryParams}`, { headers: HEADERS_2_0 })
            const { data, status } = response

            expect(status).to.equal(200)
            expect(data.methodParameters).to.not.be.undefined

            expect(data.route).to.not.be.undefined

            const amountInEdgesTotal = _(data.route)
              .flatMap((route) => route[0]!)
              .filter((pool) => !!pool.amountIn)
              .map((pool) => BigNumber.from(pool.amountIn))
              .reduce((cur, total) => total.add(cur), BigNumber.from(0))
            const amountIn = BigNumber.from(data.quote)
            expect(amountIn.eq(amountInEdgesTotal))

            const amountOutEdgesTotal = _(data.route)
              .flatMap((route) => route[0]!)
              .filter((pool) => !!pool.amountOut)
              .map((pool) => BigNumber.from(pool.amountOut))
              .reduce((cur, total) => total.add(cur), BigNumber.from(0))
            const amountOut = BigNumber.from(data.quote)
            expect(amountOut.eq(amountOutEdgesTotal))

            const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(
              data.methodParameters!,
              USDC_MAINNET,
              Ether.onChain(1)
            )

            if (type == 'exactIn') {
              expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('1000000')
              checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(Ether.onChain(1), data.quote))
            } else {
              // Hard to test ETH balance due to gas costs for approval and swap. Just check tokenIn changes
              checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(USDC_MAINNET, data.quote))
            }

            // if it's exactIn quote, there's a slight chance the first quote request might be cache miss.
            // but this is okay because each test case retries 3 times, so 2nd exactIn quote is def expected to hit cached routes.
            // if it's exactOut quote, we should always hit the cached routes.
            // this is regardless of protocol version.
            // the reason is because exact in quote always runs before exact out
            // along with the native or wrapped native pool token address assertions previously
            // it ensures the cached routes will always cache wrapped native for v2,v3 pool routes
            // and native for v4 pool routes
            expect(response.data.hitsCachedRoutes).to.be.true
          })

          it(`erc20 -> eth large trade with permit`, async () => {
            const nonce = nextPermitNonce()

            const amount =
              type == 'exactIn'
                ? await getAmount(1, type, 'USDC', 'ETH', '1000000')
                : await getAmount(1, type, 'USDC', 'ETH', '100')

            const permit: PermitSingle = {
              details: {
                token: USDC_MAINNET.address,
                amount: '1500000000000', // For exact out we don't know the exact amount needed to permit, so just specify a large amount.
                expiration: Math.floor(new Date().getTime() / 1000 + 10000000).toString(),
                nonce,
              },
              spender: UNIVERSAL_ROUTER_ADDRESS,
              sigDeadline: Math.floor(new Date().getTime() / 1000 + 10000000).toString(),
            }

            const { domain, types, values } = AllowanceTransfer.getPermitData(permit, PERMIT2_ADDRESS, 1)

            const signature = await alice._signTypedData(domain, types, values)

            // Trade of this size almost always results in splits.
            const quoteReq: QuoteQueryParams = {
              tokenInAddress: 'USDC',
              tokenInChainId: 1,
              tokenOutAddress: 'ETH',
              tokenOutChainId: 1,
              amount,
              type,
              recipient: alice.address,
              slippageTolerance: LARGE_SLIPPAGE,
              deadline: '360',
              algorithm,
              permitSignature: signature,
              permitAmount: permit.details.amount.toString(),
              permitExpiration: permit.details.expiration.toString(),
              permitSigDeadline: permit.sigDeadline.toString(),
              permitNonce: permit.details.nonce.toString(),
              enableUniversalRouter: true,
              protocols: ALL_PROTOCOLS,
            }

            const queryParams = qs.stringify(quoteReq)

            const response = await axios.get<QuoteResponse>(`${API}?${queryParams}`, { headers: HEADERS_2_0 })
            const { data, status } = response

            expect(status).to.equal(200)
            expect(data.methodParameters).to.not.be.undefined
            expect(data.route).to.not.be.undefined

            const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(
              data.methodParameters!,
              USDC_MAINNET,
              Ether.onChain(1),
              true
            )

            if (type == 'exactIn') {
              expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('1000000')
              checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(Ether.onChain(1), data.quote))
            } else {
              // Hard to test ETH balance due to gas costs for approval and swap. Just check tokenIn changes
              checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(USDC_MAINNET, data.quote))
            }

            // if it's exactIn quote, there's a slight chance the first quote request might be cache miss.
            // but this is okay because each test case retries 3 times, so 2nd exactIn quote is def expected to hit cached routes.
            // if it's exactOut quote, we should always hit the cached routes.
            // this is regardless of protocol version.
            // the reason is because exact in quote always runs before exact out
            // along with the native or wrapped native pool token address assertions previously
            // it ensures the cached routes will always cache wrapped native for v2,v3 pool routes
            // and native for v4 pool routes
            expect(response.data.hitsCachedRoutes).to.be.true
          })

          it(`eth -> erc20`, async () => {
            const quoteReq: QuoteQueryParams = {
              tokenInAddress: 'ETH',
              tokenInChainId: 1,
              tokenOutAddress: 'UNI',
              tokenOutChainId: 1,
              amount:
                type == 'exactIn'
                  ? await getAmount(1, type, 'ETH', 'UNI', '10')
                  : await getAmount(1, type, 'ETH', 'UNI', '10000'),
              type,
              recipient: alice.address,
              slippageTolerance: SLIPPAGE,
              deadline: '360',
              algorithm,
              enableUniversalRouter: true,
              protocols: ALL_PROTOCOLS,
            }

            const queryParams = qs.stringify(quoteReq)

            const response = await axios.get<QuoteResponse>(`${API}?${queryParams}`, { headers: HEADERS_2_0 })
            const { data, status } = response

            expect(status).to.equal(200)
            expect(data.methodParameters).to.not.be.undefined

            const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(
              data.methodParameters!,
              Ether.onChain(1),
              UNI_MAINNET
            )

            if (type == 'exactIn') {
              // We've swapped 10 ETH + gas costs
              expect(tokenInBefore.subtract(tokenInAfter).greaterThan(parseAmount('10', Ether.onChain(1)))).to.be.true
              checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(UNI_MAINNET, data.quote))
            } else {
              checkAbsoluteDifference(tokenOutAfter.subtract(tokenOutBefore).toExact(), '10000', 0.0001)
              // Can't easily check slippage for ETH due to gas costs effecting ETH balance.
            }

            // if it's exactIn quote, there's a slight chance the first quote request might be cache miss.
            // but this is okay because each test case retries 3 times, so 2nd exactIn quote is def expected to hit cached routes.
            // if it's exactOut quote, we should always hit the cached routes.
            // this is regardless of protocol version.
            // the reason is because exact in quote always runs before exact out
            // along with the native or wrapped native pool token address assertions previously
            // it ensures the cached routes will always cache wrapped native for v2,v3 pool routes
            // and native for v4 pool routes
            expect(response.data.hitsCachedRoutes).to.be.true
          })

          it(`eth -> erc20 swaprouter02`, async () => {
            const quoteReq: QuoteQueryParams = {
              tokenInAddress: 'ETH',
              tokenInChainId: 1,
              tokenOutAddress: 'UNI',
              tokenOutChainId: 1,
              amount:
                type == 'exactIn'
                  ? await getAmount(1, type, 'ETH', 'UNI', '10')
                  : await getAmount(1, type, 'ETH', 'UNI', '10000'),
              type,
              recipient: alice.address,
              slippageTolerance: type == 'exactOut' ? LARGE_SLIPPAGE : SLIPPAGE,
              deadline: '360',
              algorithm,
              enableUniversalRouter: false,
              protocols: ALL_PROTOCOLS,
            }

            const queryParams = qs.stringify(quoteReq)

            const response = await axios.get<QuoteResponse>(`${API}?${queryParams}`, { headers: HEADERS_1_2 })
            const { data, status } = response

            expect(status).to.equal(200)
            expect(data.methodParameters).to.not.be.undefined
            expect(data.methodParameters?.to).to.equal(SWAP_ROUTER_02_ADDRESSES(ChainId.MAINNET))

            const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(
              data.methodParameters!,
              Ether.onChain(1),
              UNI_MAINNET
            )

            if (type == 'exactIn') {
              // We've swapped 10 ETH + gas costs
              expect(tokenInBefore.subtract(tokenInAfter).greaterThan(parseAmount('10', Ether.onChain(1)))).to.be.true
              checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(UNI_MAINNET, data.quote))
            } else {
              checkAbsoluteDifference(tokenOutAfter.subtract(tokenOutBefore).toExact(), '10000', 0.0001)
              // Can't easily check slippage for ETH due to gas costs effecting ETH balance.
            }

            // if it's exactIn quote, there's a slight chance the first quote request might be cache miss.
            // but this is okay because each test case retries 3 times, so 2nd exactIn quote is def expected to hit cached routes.
            // if it's exactOut quote, we should always hit the cached routes.
            // this is regardless of protocol version.
            // the reason is because exact in quote always runs before exact out
            // along with the native or wrapped native pool token address assertions previously
            // it ensures the cached routes will always cache wrapped native for v2,v3 pool routes
            // and native for v4 pool routes
            expect(response.data.hitsCachedRoutes).to.be.true
          })

          it(`weth -> erc20`, async () => {
            const quoteReq: QuoteQueryParams = {
              tokenInAddress: 'WETH',
              tokenInChainId: 1,
              tokenOutAddress: 'DAI',
              tokenOutChainId: 1,
              amount: await getAmount(1, type, 'WETH', 'DAI', '100'),
              type,
              recipient: alice.address,
              slippageTolerance: SLIPPAGE,
              deadline: '360',
              algorithm,
              enableUniversalRouter: true,
              protocols: ALL_PROTOCOLS,
            }

            const queryParams = qs.stringify(quoteReq)

            const response = await axios.get<QuoteResponse>(`${API}?${queryParams}`, { headers: HEADERS_2_0 })
            const { data, status } = response

            expect(status).to.equal(200)
            expect(data.methodParameters).to.not.be.undefined

            const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(
              data.methodParameters!,
              WETH9[1]!,
              DAI_MAINNET
            )

            if (type == 'exactIn') {
              expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('100')
              checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(DAI_MAINNET, data.quote))
            } else {
              expect(tokenOutAfter.subtract(tokenOutBefore).toExact()).to.equal('100')
              checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(WETH9[1]!, data.quote))
            }

            // if it's exactIn quote, there's a slight chance the first quote request might be cache miss.
            // but this is okay because each test case retries 3 times, so 2nd exactIn quote is def expected to hit cached routes.
            // if it's exactOut quote, we should always hit the cached routes.
            // this is regardless of protocol version.
            // the reason is because exact in quote always runs before exact out
            // along with the native or wrapped native pool token address assertions previously
            // it ensures the cached routes will always cache wrapped native for v2,v3 pool routes
            // and native for v4 pool routes
            expect(response.data.hitsCachedRoutes).to.be.true
          })

          it(`erc20 -> weth`, async () => {
            const quoteReq: QuoteQueryParams = {
              tokenInAddress: 'USDC',
              tokenInChainId: 1,
              tokenOutAddress: 'WETH',
              tokenOutChainId: 1,
              amount: await getAmount(1, type, 'USDC', 'WETH', '100'),
              type,
              recipient: alice.address,
              slippageTolerance: SLIPPAGE,
              deadline: '360',
              algorithm,
              enableUniversalRouter: true,
              protocols: ALL_PROTOCOLS,
            }

            const queryParams = qs.stringify(quoteReq)

            const response = await axios.get<QuoteResponse>(`${API}?${queryParams}`, { headers: HEADERS_2_0 })
            const { data, status } = response

            expect(status).to.equal(200)
            expect(data.methodParameters).to.not.be.undefined

            const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(
              data.methodParameters!,
              USDC_MAINNET,
              WETH9[1]!
            )

            if (type == 'exactIn') {
              expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('100')
              checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(WETH9[1], data.quote))
            } else {
              expect(tokenOutAfter.subtract(tokenOutBefore).toExact()).to.equal('100')
              checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(USDC_MAINNET, data.quote))
            }

            // if it's exactIn quote, there's a slight chance the first quote request might be cache miss.
            // but this is okay because each test case retries 3 times, so 2nd exactIn quote is def expected to hit cached routes.
            // if it's exactOut quote, we should always hit the cached routes.
            // this is regardless of protocol version.
            // the reason is because exact in quote always runs before exact out
            // along with the native or wrapped native pool token address assertions previously
            // it ensures the cached routes will always cache wrapped native for v2,v3 pool routes
            // and native for v4 pool routes
            expect(response.data.hitsCachedRoutes).to.be.true
          })

          it(`eth -> usdc v4 only protocol`, async () => {
            const quoteReq: QuoteQueryParams = {
              tokenInAddress: 'ETH',
              tokenInChainId: 1,
              tokenOutAddress: 'USDC',
              tokenOutChainId: 1,
              amount: await getAmount(1, type, 'ETH', 'USDC', type == 'exactIn' ? '0.00001' : '0.1'),
              type,
              recipient: alice.address,
              slippageTolerance: LARGE_SLIPPAGE,
              deadline: '360',
              algorithm,
              protocols: 'v4',
              enableUniversalRouter: true,
            }

            const queryParams = qs.stringify(quoteReq)

            const response = await axios.get<QuoteResponse>(`${API}?${queryParams}`, { headers: HEADERS_2_0 })
            const { data, status } = response

            expect(status).to.equal(200)
            expect(data.methodParameters).to.not.be.undefined
            expect(data.route).to.not.be.undefined

            // Verify only v4 pools are used
            for (const r of data.route) {
              for (const pool of r) {
                expect(pool.type).to.equal('v4-pool')
              }
            }

            const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(
              data.methodParameters!,
              Ether.onChain(1),
              USDC_MAINNET
            )

            if (type == 'exactIn') {
              expect(tokenInBefore.subtract(tokenInAfter).greaterThan(parseAmount('0.00001', Ether.onChain(1)))).to.be
                .true
              checkQuoteToken(
                tokenOutBefore,
                tokenOutAfter,
                CurrencyAmount.fromRawAmount(USDC_MAINNET, data.quote),
                LARGE_SLIPPAGE
              )
            } else {
              expect(tokenOutAfter.subtract(tokenOutBefore).toExact()).to.equal('0.1')
            }

            expect(response.data.hitsCachedRoutes).to.be.false
          })

          it(`eth -> usdc v4 include (v2,v3,v4)`, async () => {
            const quoteReq: QuoteQueryParams = {
              tokenInAddress: 'ETH',
              tokenInChainId: 1,
              tokenOutAddress: 'USDC',
              tokenOutChainId: 1,
              // Reducing amount as v4 ETH/USDC pool with very low liquidity might be selected, and liquidity changes often
              amount: await getAmount(1, type, 'ETH', 'USDC', type == 'exactIn' ? '0.00001' : '0.1'),
              type,
              recipient: alice.address,
              slippageTolerance: LARGE_SLIPPAGE,
              deadline: '360',
              algorithm,
              protocols: ALL_PROTOCOLS,
              enableUniversalRouter: true,
            }

            const queryParams = qs.stringify(quoteReq)

            const response = await axios.get<QuoteResponse>(`${API}?${queryParams}`, { headers: HEADERS_2_0 })
            const { data, status } = response

            expect(status).to.equal(200)
            expect(data.methodParameters).to.not.be.undefined
            expect(data.route).to.not.be.undefined

            const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(
              data.methodParameters!,
              Ether.onChain(1),
              USDC_MAINNET
            )

            if (type == 'exactIn') {
              expect(tokenInBefore.subtract(tokenInAfter).greaterThan(parseAmount('0.00001', Ether.onChain(1)))).to.be
                .true
              checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(USDC_MAINNET, data.quote))
            } else {
              expect(tokenOutAfter.subtract(tokenOutBefore).toExact()).to.equal('0.1')
            }

            expect(response.data.hitsCachedRoutes).to.be.true
          })

          // v4 has low liquidity.
          it.skip(`weth -> usdc v4 only protocol`, async () => {
            const quoteReq: QuoteQueryParams = {
              tokenInAddress: 'WETH',
              tokenInChainId: 1,
              tokenOutAddress: 'USDC',
              tokenOutChainId: 1,
              amount: await getAmount(1, type, 'WETH', 'USDC', type == 'exactIn' ? '0.00001' : '0.01'),
              type,
              recipient: alice.address,
              slippageTolerance: LARGE_SLIPPAGE,
              deadline: '360',
              algorithm,
              protocols: 'v4',
              enableUniversalRouter: true,
            }

            const queryParams = qs.stringify(quoteReq)

            const response = await axios.get<QuoteResponse>(`${API}?${queryParams}`, { headers: HEADERS_2_0 })
            const { data, status } = response

            expect(status).to.equal(200)
            expect(data.methodParameters).to.not.be.undefined
            expect(data.route).to.not.be.undefined

            // Verify only v4 pools are used
            for (const r of data.route) {
              for (const pool of r) {
                expect(pool.type).to.equal('v4-pool')
              }
            }

            const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(
              data.methodParameters!,
              WETH9[1]!,
              USDC_MAINNET
            )

            if (type == 'exactIn') {
              expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('0.00001')
              checkQuoteToken(
                tokenOutBefore,
                tokenOutAfter,
                CurrencyAmount.fromRawAmount(USDC_MAINNET, data.quote),
                LARGE_SLIPPAGE
              )
            } else {
              expect(tokenOutAfter.subtract(tokenOutBefore).toExact()).to.equal('0.01')
              checkQuoteToken(
                tokenInBefore,
                tokenInAfter,
                CurrencyAmount.fromRawAmount(WETH9[1]!, data.quote),
                LARGE_SLIPPAGE
              )
            }

            expect(response.data.hitsCachedRoutes).to.be.false
          })

          it(`weth -> usdc v4 include (v2,v3,v4)`, async () => {
            const quoteReq: QuoteQueryParams = {
              tokenInAddress: 'WETH',
              tokenInChainId: 1,
              tokenOutAddress: 'USDC',
              tokenOutChainId: 1,
              amount: await getAmount(1, type, 'WETH', 'USDC', type == 'exactIn' ? '0.1' : '100'),
              type,
              recipient: alice.address,
              slippageTolerance: LARGE_SLIPPAGE,
              deadline: '360',
              algorithm,
              protocols: ALL_PROTOCOLS,
              enableUniversalRouter: true,
            }

            const queryParams = qs.stringify(quoteReq)

            const response = await axios.get<QuoteResponse>(`${API}?${queryParams}`, { headers: HEADERS_2_0 })
            const { data, status } = response

            expect(status).to.equal(200)
            expect(data.methodParameters).to.not.be.undefined
            expect(data.route).to.not.be.undefined

            const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(
              data.methodParameters!,
              WETH9[1]!,
              USDC_MAINNET
            )

            if (type == 'exactIn') {
              expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('0.1')
              checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(USDC_MAINNET, data.quote))
            } else {
              expect(tokenOutAfter.subtract(tokenOutBefore).toExact()).to.equal('100')
              checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(WETH9[1]!, data.quote))
            }

            expect(response.data.hitsCachedRoutes).to.be.true
          })

          if (algorithm == 'alpha') {
            it(`erc20 -> erc20 v3 only`, async () => {
              const quoteReq: QuoteQueryParams = {
                tokenInAddress: 'USDC',
                tokenInChainId: 1,
                tokenOutAddress: 'USDT',
                tokenOutChainId: 1,
                amount: await getAmount(1, type, 'USDC', 'USDT', '100'),
                type,
                recipient: alice.address,
                slippageTolerance: SLIPPAGE,
                deadline: '360',
                algorithm: 'alpha',
                protocols: 'v3',
                enableUniversalRouter: true,
              }

              const queryParams = qs.stringify(quoteReq)

              const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(`${API}?${queryParams}`, {
                headers: HEADERS_2_0,
              })
              const {
                data: { quote, quoteDecimals, quoteGasAdjustedDecimals, methodParameters, route },
                status,
              } = response

              expect(status).to.equal(200)
              expect(parseFloat(quoteDecimals)).to.be.greaterThan(90)
              expect(parseFloat(quoteDecimals)).to.be.lessThan(110)

              if (type == 'exactIn') {
                expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals))
              } else {
                expect(parseFloat(quoteGasAdjustedDecimals)).to.be.greaterThanOrEqual(parseFloat(quoteDecimals))
              }

              expect(methodParameters).to.not.be.undefined

              for (const r of route) {
                for (const pool of r) {
                  expect(pool.type).to.equal('v3-pool')
                }
              }

              const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(
                response.data.methodParameters!,
                USDC_MAINNET,
                USDT_MAINNET!
              )

              if (type == 'exactIn') {
                expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('100')
                checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(USDT_MAINNET, quote))
              } else {
                expect(tokenOutAfter.subtract(tokenOutBefore).toExact()).to.equal('100')
                checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(USDC_MAINNET, quote))
              }

              // if it's exactIn quote, there's a slight chance the first quote request might be cache miss.
              // but this is okay because each test case retries 3 times, so 2nd exactIn quote is def expected to hit cached routes.
              // if it's exactOut quote, we should always hit the cached routes.
              // this is regardless of protocol version.
              // the reason is because exact in quote always runs before exact out
              // along with the native or wrapped native pool token address assertions previously
              // it ensures the cached routes will always cache wrapped native for v2,v3 pool routes
              // and native for v4 pool routes
              expect(response.data.hitsCachedRoutes).to.be.false
            })

            it(`erc20 -> erc20 v2 only`, async () => {
              const quoteReq: QuoteQueryParams = {
                tokenInAddress: 'USDC',
                tokenInChainId: 1,
                tokenOutAddress: 'USDT',
                tokenOutChainId: 1,
                amount: await getAmount(1, type, 'USDC', 'USDT', '100'),
                type,
                recipient: alice.address,
                slippageTolerance: SLIPPAGE,
                deadline: '360',
                algorithm: 'alpha',
                protocols: 'v2',
                enableUniversalRouter: true,
              }

              const queryParams = qs.stringify(quoteReq)

              const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(`${API}?${queryParams}`, {
                headers: HEADERS_2_0,
              })
              const {
                data: { quote, quoteDecimals, quoteGasAdjustedDecimals, methodParameters, route },
                status,
              } = response

              expect(status).to.equal(200)
              expect(parseFloat(quoteDecimals)).to.be.greaterThan(90)
              expect(parseFloat(quoteDecimals)).to.be.lessThan(110)

              if (type == 'exactIn') {
                expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals))
              } else {
                expect(parseFloat(quoteGasAdjustedDecimals)).to.be.greaterThanOrEqual(parseFloat(quoteDecimals))
              }

              expect(methodParameters).to.not.be.undefined

              for (const r of route) {
                for (const pool of r) {
                  expect(pool.type).to.equal('v2-pool')
                }
              }

              const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(
                response.data.methodParameters!,
                USDC_MAINNET,
                USDT_MAINNET!
              )

              if (type == 'exactIn') {
                expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('100')
                checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(USDT_MAINNET, quote))
              } else {
                expect(tokenOutAfter.subtract(tokenOutBefore).toExact()).to.equal('100')
                checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(USDC_MAINNET, quote))
              }

              // if it's exactIn quote, there's a slight chance the first quote request might be cache miss.
              // but this is okay because each test case retries 3 times, so 2nd exactIn quote is def expected to hit cached routes.
              // if it's exactOut quote, we should always hit the cached routes.
              // this is regardless of protocol version.
              // the reason is because exact in quote always runs before exact out
              // along with the native or wrapped native pool token address assertions previously
              // it ensures the cached routes will always cache wrapped native for v2,v3 pool routes
              // and native for v4 pool routes
              expect(response.data.hitsCachedRoutes).to.be.false
            })

            it(`erc20 -> erc20 forceCrossProtocol`, async () => {
              const quoteReq: QuoteQueryParams = {
                tokenInAddress: 'USDC',
                tokenInChainId: 1,
                tokenOutAddress: 'USDT',
                tokenOutChainId: 1,
                amount: await getAmount(1, type, 'USDC', 'USDT', '100'),
                type,
                recipient: alice.address,
                slippageTolerance: SLIPPAGE,
                deadline: '360',
                algorithm: 'alpha',
                forceCrossProtocol: true,
                enableUniversalRouter: true,
                protocols: ALL_PROTOCOLS,
              }

              const queryParams = qs.stringify(quoteReq)

              const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(`${API}?${queryParams}`, {
                headers: HEADERS_2_0,
              })
              const {
                data: { quote, quoteDecimals, quoteGasAdjustedDecimals, methodParameters, route },
                status,
              } = response

              expect(status).to.equal(200)
              expect(parseFloat(quoteDecimals)).to.be.greaterThan(90)
              expect(parseFloat(quoteDecimals)).to.be.lessThan(110)

              if (type == 'exactIn') {
                expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals))
              } else {
                expect(parseFloat(quoteGasAdjustedDecimals)).to.be.greaterThanOrEqual(parseFloat(quoteDecimals))
              }

              expect(methodParameters).to.not.be.undefined

              let hasV4Pool = false
              let hasV3Pool = false
              let hasV2Pool = false
              for (const r of route) {
                for (const pool of r) {
                  if (pool.type == 'v4-pool') {
                    hasV4Pool = true
                  }
                  if (pool.type == 'v3-pool') {
                    hasV3Pool = true
                  }
                  if (pool.type == 'v2-pool') {
                    hasV2Pool = true
                  }
                }
              }

              expect((hasV3Pool && hasV2Pool) || (hasV4Pool && hasV2Pool) || (hasV4Pool && hasV3Pool)).to.be.true

              const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(
                response.data.methodParameters!,
                USDC_MAINNET,
                USDT_MAINNET!
              )

              if (type == 'exactIn') {
                expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('100')
                checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(USDT_MAINNET, quote))
              } else {
                expect(tokenOutAfter.subtract(tokenOutBefore).toExact()).to.equal('100')
                checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(USDC_MAINNET, quote))
              }
            })

            // Test that repros https://uniswapteam.slack.com/archives/C08JM8SKMV2/p1742424330903569?thread_ts=1742424322.824189&cid=C08JM8SKMV2
            // Where quote request contains v2,v3
            it(`erc20 -> erc20 cached routes should not return mixed route`, async () => {
              if (type !== 'exactIn') {
                return
              }

              const quoteReq: QuoteQueryParams = {
                tokenInAddress: 'ETH',
                tokenInChainId: 1,
                tokenOutAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
                tokenOutChainId: 1,
                amount: '1000000000000000000',
                type,
                recipient: alice.address,
                slippageTolerance: SLIPPAGE,
                deadline: '360',
                algorithm: 'alpha',
                protocols: 'v2,v3',
                enableUniversalRouter: true,
                enableDebug: true,
              }

              const queryParams = qs.stringify(quoteReq)

              const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(`${API}?${queryParams}`, {
                headers: HEADERS_1_2,
              })

              const {
                data: { route },
                status,
              } = response

              expect(status).to.equal(200)

              // Verify no mixed routes returned when using cached routes
              for (const r of route) {
                expect(r.every((pool) => pool.type === 'v3-pool' || pool.type === 'v2-pool')).to.equal(true)
                expect(r.every((pool) => pool.type !== 'v4-pool')).to.equal(true)
              }
            })

            /// Tests for routes likely to result in MixedRoutes being returned
            if (type === 'exactIn') {
              it.skip(`erc20 -> erc20 forceMixedRoutes not specified for v2,v3 does not return mixed route even when it is better`, async () => {
                const quoteReq: QuoteQueryParams = {
                  tokenInAddress: 'BOND',
                  tokenInChainId: 1,
                  tokenOutAddress: 'APE',
                  tokenOutChainId: 1,
                  amount: await getAmount(1, type, 'BOND', 'APE', '10000'),
                  type,
                  recipient: alice.address,
                  slippageTolerance: SLIPPAGE,
                  deadline: '360',
                  algorithm: 'alpha',
                  protocols: 'v2,v3',
                  enableUniversalRouter: true,
                }

                const queryParams = qs.stringify(quoteReq)

                const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(`${API}?${queryParams}`, {
                  headers: HEADERS_2_0,
                })
                const {
                  data: { quoteDecimals, quoteGasAdjustedDecimals, methodParameters, routeString },
                  status,
                } = response

                expect(status).to.equal(200)

                if (type == 'exactIn') {
                  expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals))
                } else {
                  expect(parseFloat(quoteGasAdjustedDecimals)).to.be.greaterThanOrEqual(parseFloat(quoteDecimals))
                }

                expect(methodParameters).to.not.be.undefined

                expect(!routeString.includes('[V2 + V3]'))
              })

              it(`erc20 -> erc20 only mixed is not allowed`, async () => {
                const quoteReq: QuoteQueryParams = {
                  tokenInAddress: 'BOND',
                  tokenInChainId: 1,
                  tokenOutAddress: 'APE',
                  tokenOutChainId: 1,
                  amount: await getAmount(1, type, 'BOND', 'APE', '10000'),
                  type,
                  recipient: alice.address,
                  slippageTolerance: SLIPPAGE,
                  deadline: '360',
                  algorithm: 'alpha',
                  protocols: 'mixed',
                  enableUniversalRouter: true,
                }

                await callAndExpectFail(quoteReq, {
                  status: 400,
                  data: {
                    detail: 'Mixed protocol cannot be specified explicitly',
                    errorCode: 'INVALID_PROTOCOL',
                  },
                })
              })

              it(`erc20 -> erc20 forceMixedRoutes true for v2,v3`, async () => {
                const quoteReq: QuoteQueryParams = {
                  tokenInAddress: 'BOND',
                  tokenInChainId: 1,
                  tokenOutAddress: 'APE',
                  tokenOutChainId: 1,
                  amount: await getAmount(1, type, 'BOND', 'APE', '10000'),
                  type,
                  recipient: alice.address,
                  slippageTolerance: SLIPPAGE,
                  deadline: '360',
                  algorithm: 'alpha',
                  forceMixedRoutes: true,
                  protocols: 'v2,v3',
                  enableUniversalRouter: true,
                }

                await callAndExpectFail(quoteReq, {
                  status: 404,
                  data: {
                    detail: 'No route found',
                    errorCode: 'NO_ROUTE',
                  },
                })
              })

              it.skip('USDC -> mockA forceMixedRoutes true for mixed protocol on Base with request source', async () => {
                if (type != 'exactIn') {
                  // mixed route only works for exactIn
                  return
                }

                const quoteReq: QuoteQueryParams = {
                  tokenInAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
                  tokenInChainId: 8453,
                  tokenOutAddress: '0x878784f7ebf6e57d17c81d82ddf53f117a5e2988',
                  tokenOutChainId: 8453,
                  amount: '1000000',
                  type,
                  recipient: alice.address,
                  slippageTolerance: SLIPPAGE,
                  deadline: '360',
                  algorithm: 'alpha',
                  forceMixedRoutes: true,
                  protocols: 'v3,v4,mixed',
                  enableUniversalRouter: true,
                }

                const queryParams = qs.stringify(quoteReq)

                const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(`${API}?${queryParams}`, {
                  headers: {
                    ...HEADERS_2_0,
                    'x-request-source': 'e2e-test',
                  },
                })
                const {
                  data: { quoteDecimals, quoteGasAdjustedDecimals, methodParameters, route, routeString },
                  status,
                } = response

                expect(status).to.equal(200)
                expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals))
                expect(methodParameters).to.not.be.undefined

                /// since we only get the routeString back, we can check if there's V3 + V2
                expect(routeString.includes('[V2 + V3 + V4]'))
                expect(route.length).to.equal(1)
                expect(route[0].length).to.equal(2)
                expect(route[0][0].type).to.equal('v3-pool')
                expect(route[0][0].tokenIn.address).to.equal('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')
                expect(route[0][0].tokenOut.address).to.equal(WETH9[ChainId.BASE].address)
                expect(route[0][1].type).to.equal('v4-pool')
                expect(route[0][1].tokenIn.address).to.equal('0x0000000000000000000000000000000000000000')
                expect(route[0][1].tokenOut.address).to.equal('0x878784F7eBF6e57d17C81D82DDF53F117a5E2988')
              })

              it.skip('USDC -> mockA forceMixedRoutes true for mixed protocol on Base no request source', async () => {
                if (type != 'exactIn') {
                  // mixed route only works for exactIn
                  return
                }

                const quoteReq: QuoteQueryParams = {
                  tokenInAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
                  tokenInChainId: 8453,
                  tokenOutAddress: '0x878784f7ebf6e57d17c81d82ddf53f117a5e2988',
                  tokenOutChainId: 8453,
                  amount: '1000000',
                  type,
                  recipient: alice.address,
                  slippageTolerance: SLIPPAGE,
                  deadline: '360',
                  algorithm: 'alpha',
                  forceMixedRoutes: true,
                  protocols: ALL_PROTOCOLS,
                  enableUniversalRouter: true,
                }

                const queryParams = qs.stringify(quoteReq)

                try {
                  await axios.get<QuoteResponse>(`${API}?${queryParams}`, {
                    headers: HEADERS_2_0,
                  })
                } catch (err) {
                  if (err instanceof Error) {
                    expect(err.message).to.contains('404')
                  }
                }
              })

              it.skip(`erc20 -> erc20 forceMixedRoutes true for all protocols specified`, async () => {
                const quoteReq: QuoteQueryParams = {
                  tokenInAddress: 'BOND',
                  tokenInChainId: 1,
                  tokenOutAddress: 'APE',
                  tokenOutChainId: 1,
                  amount: await getAmount(1, type, 'BOND', 'APE', '10000'),
                  type,
                  recipient: alice.address,
                  slippageTolerance: SLIPPAGE,
                  deadline: '360',
                  algorithm: 'alpha',
                  forceMixedRoutes: true,
                  protocols: 'v2,v3,mixed',
                  enableUniversalRouter: true,
                }

                const queryParams = qs.stringify(quoteReq)

                const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(`${API}?${queryParams}`, {
                  headers: HEADERS_2_0,
                })
                const {
                  data: { quoteDecimals, quoteGasAdjustedDecimals, methodParameters, routeString },
                  status,
                } = response

                expect(status).to.equal(200)

                if (type == 'exactIn') {
                  expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals))
                } else {
                  expect(parseFloat(quoteGasAdjustedDecimals)).to.be.greaterThanOrEqual(parseFloat(quoteDecimals))
                }

                expect(methodParameters).to.not.be.undefined

                /// since we only get the routeString back, we can check if there's V3 + V2
                expect(routeString.includes('[V2 + V3]'))
              })
            }

            // FOT swap only works for exact in
            if (type === 'exactIn') {
              const tokenInAndTokenOut = [
                [BULLET, WETH9[ChainId.MAINNET]!],
                [WETH9[ChainId.MAINNET]!, BULLET],
                // TODO: re-enable - DFNDR FOT test is flaky right now, disabling to unblock pipeline
                // [WETH9[ChainId.MAINNET]!, DFNDR],
              ]

              tokenInAndTokenOut.forEach(([tokenIn, tokenOut]) => {
                // If this test fails sporadically, dev needs to investigate further
                // There could be genuine regressions in the form of race condition, due to complex layers of caching
                // See https://github.com/Uniswap/smart-order-router/pull/415#issue-1914604864 as an example race condition
                it(`fee-on-transfer ${tokenIn.symbol} -> ${tokenOut.symbol}`, async () => {
                  const enableFeeOnTransferFeeFetching = [true, false, undefined]
                  // we want to swap the tokenIn/tokenOut order so that we can test both sellFeeBps and buyFeeBps for exactIn vs exactOut
                  const originalAmount = tokenIn.equals(WETH9[ChainId.MAINNET]!) ? '10' : '2924'
                  const amount = await getAmountFromToken(type, tokenIn, tokenOut, originalAmount)

                  // Parallelize the FOT quote requests, because we notice there might be tricky race condition that could cause quote to not include FOT tax
                  const responses = await Promise.all(
                    enableFeeOnTransferFeeFetching.map(async (enableFeeOnTransferFeeFetching) => {
                      if (enableFeeOnTransferFeeFetching) {
                        // if it's FOT flag enabled request, we delay it so that it's more likely to repro the race condition in
                        // https://github.com/Uniswap/smart-order-router/pull/415#issue-1914604864
                        await new Promise((f) => setTimeout(f, 1000))
                      }
                      const simulateFromAddress = tokenIn.equals(WETH9[ChainId.MAINNET]!)
                        ? '0x6B44ba0a126a2A1a8aa6cD1AdeeD002e141Bcd44'
                        : '0x171d311eAcd2206d21Cb462d661C33F0eddadC03'
                      const quoteReq: QuoteQueryParams = {
                        tokenInAddress: tokenIn.address,
                        tokenInChainId: tokenIn.chainId,
                        tokenOutAddress: tokenOut.address,
                        tokenOutChainId: tokenOut.chainId,
                        amount: amount,
                        type: type,
                        protocols: ALL_PROTOCOLS,
                        // TODO: ROUTE-86 remove enableFeeOnTransferFeeFetching once we are ready to enable this by default
                        enableFeeOnTransferFeeFetching: enableFeeOnTransferFeeFetching,
                        recipient: alice.address,
                        // we have to use large slippage for FOT swap, because routing-api always forks at the latest block,
                        // and the FOT swap can have large slippage, despite SOR already subtracted FOT tax
                        slippageTolerance: LARGE_SLIPPAGE,
                        deadline: '360',
                        algorithm,
                        enableUniversalRouter: true,
                        // if fee-on-transfer flag is not enabled, most likely the simulation will fail due to quote not subtracting the tax
                        simulateFromAddress: enableFeeOnTransferFeeFetching ? simulateFromAddress : undefined,
                        portionBips: FLAT_PORTION.bips,
                        portionRecipient: FLAT_PORTION.recipient,
                      }

                      const queryParams = qs.stringify(quoteReq)

                      const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(
                        `${API}?${queryParams}`,
                        { headers: HEADERS_2_0 }
                      )

                      // if it's exactIn quote, there's a slight chance the first quote request might be cache miss.
                      // but this is okay because each test case retries 3 times, so 2nd exactIn quote is def expected to hit cached routes.
                      // if it's exactOut quote, we should always hit the cached routes.
                      // this is regardless of protocol version.
                      // the reason is because exact in quote always runs before exact out
                      // along with the native or wrapped native pool token address assertions previously
                      // it ensures the cached routes will always cache wrapped native for v2,v3 pool routes
                      // and native for v4 pool routes
                      expect(response.data.hitsCachedRoutes).to.be.true

                      return { enableFeeOnTransferFeeFetching, ...response }
                    })
                  )

                  const quoteWithFlagOn = responses.find((r) => r.enableFeeOnTransferFeeFetching === true)
                  expect(quoteWithFlagOn).not.to.be.undefined

                  // TODO: flaky assertions, re-enable after fixing (probably real prod issue due to flaky GQL data)
                  // // in case of FOT token that should not take a portion/fee, we assert that all portion fields are undefined
                  // if (!tokenOut?.equals(WETH9[ChainId.MAINNET])) {
                  //   expect(quoteWithFlagOn!.data.portionAmount).to.be.undefined
                  //   expect(quoteWithFlagOn!.data.portionBips).to.be.undefined
                  //   expect(quoteWithFlagOn!.data.portionRecipient).to.be.undefined
                  // } else {
                  //   expect(quoteWithFlagOn!.data.portionAmount).to.be.not.undefined
                  //   expect(quoteWithFlagOn!.data.portionBips).to.be.not.undefined
                  //   expect(quoteWithFlagOn!.data.portionRecipient).to.be.not.undefined
                  // }

                  responses
                    .filter((r) => r.enableFeeOnTransferFeeFetching !== true)
                    .forEach((r) => {
                      if (type === 'exactIn') {
                        const quote = CurrencyAmount.fromRawAmount(tokenOut, r.data.quote)
                        const quoteWithFlagon = CurrencyAmount.fromRawAmount(tokenOut, quoteWithFlagOn!.data.quote)

                        // quote without fot flag must be greater than the quote with fot flag
                        // this is to catch https://github.com/Uniswap/smart-order-router/pull/421
                        expect(quote.greaterThan(quoteWithFlagon)).to.be.true

                        // below is additional assertion to ensure the quote without fot tax vs quote with tax should be very roughly equal to the fot sell/buy tax rate
                        const tokensDiff = quote.subtract(quoteWithFlagon)
                        const percentDiff = tokensDiff.asFraction.divide(quote.asFraction)
                        if (tokenIn?.equals(BULLET)) {
                          expect(percentDiff.toFixed(3, undefined, Rounding.ROUND_HALF_UP)).equal(
                            new Fraction(BigNumber.from(BULLET_WHT_TAX.sellFeeBps ?? 0).toString(), 10_000).toFixed(3)
                          )
                        } else if (tokenOut?.equals(BULLET)) {
                          expect(percentDiff.toFixed(3, undefined, Rounding.ROUND_HALF_UP)).equal(
                            new Fraction(BigNumber.from(BULLET_WHT_TAX.buyFeeBps ?? 0).toString(), 10_000).toFixed(3)
                          )
                        }
                      }
                    })

                  for (const response of responses) {
                    const {
                      enableFeeOnTransferFeeFetching,
                      data: {
                        quote,
                        quoteDecimals,
                        quoteGasAdjustedDecimals,
                        methodParameters,
                        route,
                        simulationStatus,
                        simulationError,
                      },
                      status,
                    } = response

                    expect(status).to.equal(200)

                    if (type == 'exactIn') {
                      expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals))
                    } else {
                      expect(parseFloat(quoteGasAdjustedDecimals)).to.be.greaterThanOrEqual(parseFloat(quoteDecimals))
                    }

                    let hasV3Pool = false
                    let hasV2Pool = false
                    for (const r of route) {
                      for (const pool of r) {
                        if (pool.type == 'v3-pool') {
                          hasV3Pool = true
                        }
                        if (pool.type == 'v2-pool') {
                          hasV2Pool = true
                          if (enableFeeOnTransferFeeFetching) {
                            if (pool.tokenIn.address === BULLET.address) {
                              expect(pool.tokenIn.sellFeeBps).to.be.not.undefined
                              expect(pool.tokenIn.sellFeeBps).to.be.equals(BULLET_WHT_TAX.sellFeeBps?.toString())
                              expect(pool.tokenIn.buyFeeBps).to.be.not.undefined
                              expect(pool.tokenIn.buyFeeBps).to.be.equals(BULLET_WHT_TAX.buyFeeBps?.toString())
                            }
                            if (pool.tokenOut.address === BULLET.address) {
                              expect(pool.tokenOut.sellFeeBps).to.be.not.undefined
                              expect(pool.tokenOut.sellFeeBps).to.be.equals(BULLET_WHT_TAX.sellFeeBps?.toString())
                              expect(pool.tokenOut.buyFeeBps).to.be.not.undefined
                              expect(pool.tokenOut.buyFeeBps).to.be.equals(BULLET_WHT_TAX.buyFeeBps?.toString())
                            }
                            if (pool.reserve0.token.address === BULLET.address) {
                              expect(pool.reserve0.token.sellFeeBps).to.be.not.undefined
                              expect(pool.reserve0.token.sellFeeBps).to.be.equals(BULLET_WHT_TAX.sellFeeBps?.toString())
                              expect(pool.reserve0.token.buyFeeBps).to.be.not.undefined
                              expect(pool.reserve0.token.buyFeeBps).to.be.equals(BULLET_WHT_TAX.buyFeeBps?.toString())
                            }
                            if (pool.reserve1.token.address === BULLET.address) {
                              expect(pool.reserve1.token.sellFeeBps).to.be.not.undefined
                              expect(pool.reserve1.token.sellFeeBps).to.be.equals(BULLET_WHT_TAX.sellFeeBps?.toString())
                              expect(pool.reserve1.token.buyFeeBps).to.be.not.undefined
                              expect(pool.reserve1.token.buyFeeBps).to.be.equals(BULLET_WHT_TAX.buyFeeBps?.toString())
                            }
                          } else {
                            expect(pool.tokenOut.sellFeeBps).to.be.undefined
                            expect(pool.tokenOut.buyFeeBps).to.be.undefined
                            expect(pool.reserve0.token.sellFeeBps).to.be.undefined
                            expect(pool.reserve0.token.buyFeeBps).to.be.undefined
                            expect(pool.reserve1.token.sellFeeBps).to.be.undefined
                            expect(pool.reserve1.token.buyFeeBps).to.be.undefined
                          }
                        }
                      }
                    }

                    expect(!hasV3Pool && hasV2Pool).to.be.true

                    if (enableFeeOnTransferFeeFetching) {
                      expect(simulationStatus).to.equal('SUCCESS')
                      expect(simulationError).to.equal(false)
                      expect(methodParameters).to.not.be.undefined

                      // We don't have a bullet proof way to assert the fot-involved quote is post tax
                      // so the best way is to execute the swap on hardhat mainnet fork,
                      // and make sure the executed quote doesn't differ from callstatic simulated quote by over slippage tolerance
                      const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(
                        response.data.methodParameters!,
                        tokenIn,
                        tokenOut
                      )

                      expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal(originalAmount)
                      checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(tokenOut, quote))
                    }
                  }
                })
              })
            }
          }
        })

        if (algorithm == 'alpha') {
          describe(`+ Simulate Swap + Execute Swap`, () => {
            it(`erc20 -> erc20`, async () => {
              const quoteReq: QuoteQueryParams = {
                tokenInAddress: 'USDC',
                tokenInChainId: 1,
                tokenOutAddress: 'USDT',
                tokenOutChainId: 1,
                amount: await getAmount(1, type, 'USDC', 'USDT', '100'),
                type,
                recipient: alice.address,
                slippageTolerance: SLIPPAGE,
                deadline: '360',
                algorithm,
                simulateFromAddress: '0xf584f8728b874a6a5c7a8d4d387c9aae9172d621',
                enableUniversalRouter: true,
                protocols: ALL_PROTOCOLS,
              }

              const queryParams = qs.stringify(quoteReq)

              const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(`${API}?${queryParams}`, {
                headers: HEADERS_2_0,
              })
              const {
                data: { quote, quoteDecimals, quoteGasAdjustedDecimals, methodParameters, simulationError },
                status,
              } = response

              expect(status).to.equal(200)
              expect(simulationError).to.equal(false)
              expect(parseFloat(quoteDecimals)).to.be.greaterThan(90)
              expect(parseFloat(quoteDecimals)).to.be.lessThan(110)

              if (type == 'exactIn') {
                expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals))
              } else {
                expect(parseFloat(quoteGasAdjustedDecimals)).to.be.greaterThanOrEqual(parseFloat(quoteDecimals))
              }

              expect(methodParameters).to.not.be.undefined

              const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(
                methodParameters!,
                USDC_MAINNET,
                USDT_MAINNET
              )

              if (type == 'exactIn') {
                expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('100')
                checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(USDT_MAINNET, quote))
              } else {
                expect(tokenOutAfter.subtract(tokenOutBefore).toExact()).to.equal('100')
                checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(USDC_MAINNET, quote))
              }

              // if it's exactIn quote, there's a slight chance the first quote request might be cache miss.
              // but this is okay because each test case retries 3 times, so 2nd exactIn quote is def expected to hit cached routes.
              // if it's exactOut quote, we should always hit the cached routes.
              // this is regardless of protocol version.
              // the reason is because exact in quote always runs before exact out
              // along with the native or wrapped native pool token address assertions previously
              // it ensures the cached routes will always cache wrapped native for v2,v3 pool routes
              // and native for v4 pool routes
              expect(response.data.hitsCachedRoutes).to.be.true
            })

            it(`erc20 -> erc20 swaprouter02`, async () => {
              const quoteReq: QuoteQueryParams = {
                tokenInAddress: 'USDC',
                tokenInChainId: 1,
                tokenOutAddress: 'USDT',
                tokenOutChainId: 1,
                amount: await getAmount(1, type, 'USDC', 'USDT', '100'),
                type,
                recipient: alice.address,
                slippageTolerance: SLIPPAGE,
                deadline: '360',
                algorithm,
                simulateFromAddress: '0xf584f8728b874a6a5c7a8d4d387c9aae9172d621',
                protocols: 'v2,v3,mixed',
              }

              const queryParams = qs.stringify(quoteReq)

              const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(`${API}?${queryParams}`, {
                headers: HEADERS_1_2,
              })
              const {
                data: { quote, quoteDecimals, quoteGasAdjustedDecimals, methodParameters, simulationError },
                status,
              } = response

              expect(status).to.equal(200)
              expect(simulationError).to.equal(false)
              expect(parseFloat(quoteDecimals)).to.be.greaterThan(90)
              expect(parseFloat(quoteDecimals)).to.be.lessThan(110)

              if (type == 'exactIn') {
                expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals))
              } else {
                expect(parseFloat(quoteGasAdjustedDecimals)).to.be.greaterThanOrEqual(parseFloat(quoteDecimals))
              }

              expect(methodParameters).to.not.be.undefined
              expect(methodParameters!.to).to.equal(SWAP_ROUTER_02_ADDRESSES(ChainId.MAINNET))

              const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(
                methodParameters!,
                USDC_MAINNET,
                USDT_MAINNET
              )

              if (type == 'exactIn') {
                expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('100')
                checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(USDT_MAINNET, quote))
              } else {
                expect(tokenOutAfter.subtract(tokenOutBefore).toExact()).to.equal('100')
                checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(USDC_MAINNET, quote))
              }

              // if it's exactIn quote, there's a slight chance the first quote request might be cache miss.
              // but this is okay because each test case retries 3 times, so 2nd exactIn quote is def expected to hit cached routes.
              // if it's exactOut quote, we should always hit the cached routes.
              // this is regardless of protocol version.
              // the reason is because exact in quote always runs before exact out
              // along with the native or wrapped native pool token address assertions previously
              // it ensures the cached routes will always cache wrapped native for v2,v3 pool routes
              // and native for v4 pool routes
              expect(response.data.hitsCachedRoutes).to.be.true
            })

            if (isTesterPKEnvironmentSet()) {
              it(`erc20 -> erc20 with permit with tester pk`, async () => {
                // This test requires a private key with at least 10 USDC
                // at FORK_BLOCK time.
                const amount = await getAmount(1, type, 'USDC', 'USDT', '10')

                const nonce = '0'

                const permit: PermitSingle = {
                  details: {
                    token: USDC_MAINNET.address,
                    amount: amount,
                    expiration: Math.floor(new Date().getTime() / 1000 + 10000000).toString(),
                    nonce,
                  },
                  spender: UNIVERSAL_ROUTER_ADDRESS,
                  sigDeadline: Math.floor(new Date().getTime() / 1000 + 10000000).toString(),
                }

                const wallet = new Wallet(process.env.TESTER_PK!)

                const { domain, types, values } = AllowanceTransfer.getPermitData(permit, PERMIT2_ADDRESS, 1)

                const signature = await wallet._signTypedData(domain, types, values)

                const quoteReq: QuoteQueryParams = {
                  tokenInAddress: 'USDC',
                  tokenInChainId: 1,
                  tokenOutAddress: 'USDT',
                  tokenOutChainId: 1,
                  amount,
                  type,
                  recipient: wallet.address,
                  slippageTolerance: SLIPPAGE,
                  deadline: '360',
                  algorithm,
                  simulateFromAddress: wallet.address,
                  permitSignature: signature,
                  permitAmount: permit.details.amount.toString(),
                  permitExpiration: permit.details.expiration.toString(),
                  permitSigDeadline: permit.sigDeadline.toString(),
                  permitNonce: permit.details.nonce.toString(),
                  enableUniversalRouter: true,
                  protocols: ALL_PROTOCOLS,
                }

                const queryParams = qs.stringify(quoteReq)

                const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(`${API}?${queryParams}`, {
                  headers: HEADERS_2_0,
                })
                const {
                  data: { quoteDecimals, quoteGasAdjustedDecimals, methodParameters, simulationError },
                  status,
                } = response
                expect(status).to.equal(200)

                expect(simulationError).to.equal(false)

                expect(parseFloat(quoteDecimals)).to.be.greaterThan(9)
                expect(parseFloat(quoteDecimals)).to.be.lessThan(11)

                if (type == 'exactIn') {
                  expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals))
                } else {
                  expect(parseFloat(quoteGasAdjustedDecimals)).to.be.greaterThanOrEqual(parseFloat(quoteDecimals))
                }

                expect(methodParameters).to.not.be.undefined

                // if it's exactIn quote, there's a slight chance the first quote request might be cache miss.
                // but this is okay because each test case retries 3 times, so 2nd exactIn quote is def expected to hit cached routes.
                // if it's exactOut quote, we should always hit the cached routes.
                // this is regardless of protocol version.
                // the reason is because exact in quote always runs before exact out
                // along with the native or wrapped native pool token address assertions previously
                // it ensures the cached routes will always cache wrapped native for v2,v3 pool routes
                // and native for v4 pool routes
                expect(response.data.hitsCachedRoutes).to.be.true
              })
            }

            it(`erc20 -> eth`, async () => {
              const quoteReq: QuoteQueryParams = {
                tokenInAddress: 'USDC',
                tokenInChainId: 1,
                tokenOutAddress: 'ETH',
                tokenOutChainId: 1,
                amount: await getAmount(1, type, 'USDC', 'ETH', type == 'exactIn' ? '1000000' : '10'),
                type,
                recipient: alice.address,
                slippageTolerance: SLIPPAGE,
                deadline: '360',
                algorithm,
                simulateFromAddress: '0xf584f8728b874a6a5c7a8d4d387c9aae9172d621',
                enableUniversalRouter: true,
                protocols: ALL_PROTOCOLS,
              }

              const queryParams = qs.stringify(quoteReq)

              const response = await axios.get<QuoteResponse>(`${API}?${queryParams}`, { headers: HEADERS_2_0 })
              const {
                data: { quote, methodParameters, simulationError },
                status,
              } = response

              expect(status).to.equal(200)
              expect(simulationError).to.equal(false)
              expect(methodParameters).to.not.be.undefined

              const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(
                methodParameters!,
                USDC_MAINNET,
                Ether.onChain(1)
              )

              if (type == 'exactIn') {
                expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('1000000')
                checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(Ether.onChain(1), quote))
              } else {
                // Hard to test ETH balance due to gas costs for approval and swap. Just check tokenIn changes
                checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(USDC_MAINNET, quote))
              }

              // if it's exactIn quote, there's a slight chance the first quote request might be cache miss.
              // but this is okay because each test case retries 3 times, so 2nd exactIn quote is def expected to hit cached routes.
              // if it's exactOut quote, we should always hit the cached routes.
              // this is regardless of protocol version.
              // the reason is because exact in quote always runs before exact out
              // along with the native or wrapped native pool token address assertions previously
              // it ensures the cached routes will always cache wrapped native for v2,v3 pool routes
              // and native for v4 pool routes
              expect(response.data.hitsCachedRoutes).to.be.true
            })

            it(`erc20 -> eth large trade`, async () => {
              // Trade of this size almost always results in splits.
              const quoteReq: QuoteQueryParams = {
                tokenInAddress: 'USDC',
                tokenInChainId: 1,
                tokenOutAddress: 'ETH',
                tokenOutChainId: 1,
                amount:
                  type == 'exactIn'
                    ? await getAmount(1, type, 'USDC', 'ETH', '1000000')
                    : await getAmount(1, type, 'USDC', 'ETH', '100'),
                type,
                recipient: alice.address,
                slippageTolerance: LARGE_SLIPPAGE,
                deadline: '360',
                algorithm,
                simulateFromAddress: '0xf584f8728b874a6a5c7a8d4d387c9aae9172d621',
                enableUniversalRouter: true,
                protocols: ALL_PROTOCOLS,
              }

              const queryParams = qs.stringify(quoteReq)

              const response = await axios.get<QuoteResponse>(`${API}?${queryParams}`, { headers: HEADERS_2_0 })
              const { data, status } = response

              expect(status).to.equal(200)
              expect(data.simulationError).to.equal(false)
              expect(data.methodParameters).to.not.be.undefined

              expect(data.route).to.not.be.undefined

              const amountInEdgesTotal = _(data.route)
                .flatMap((route) => route[0]!)
                .filter((pool) => !!pool.amountIn)
                .map((pool) => BigNumber.from(pool.amountIn))
                .reduce((cur, total) => total.add(cur), BigNumber.from(0))
              const amountIn = BigNumber.from(data.quote)
              expect(amountIn.eq(amountInEdgesTotal))

              const amountOutEdgesTotal = _(data.route)
                .flatMap((route) => route[0]!)
                .filter((pool) => !!pool.amountOut)
                .map((pool) => BigNumber.from(pool.amountOut))
                .reduce((cur, total) => total.add(cur), BigNumber.from(0))
              const amountOut = BigNumber.from(data.quote)
              expect(amountOut.eq(amountOutEdgesTotal))

              const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(
                data.methodParameters!,
                USDC_MAINNET,
                Ether.onChain(1)
              )

              if (type == 'exactIn') {
                expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('1000000')
                checkQuoteToken(
                  tokenOutBefore,
                  tokenOutAfter,
                  CurrencyAmount.fromRawAmount(Ether.onChain(1), data.quote)
                )
              } else {
                // Hard to test ETH balance due to gas costs for approval and swap. Just check tokenIn changes
                checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(USDC_MAINNET, data.quote))
              }

              // if it's exactIn quote, there's a slight chance the first quote request might be cache miss.
              // but this is okay because each test case retries 3 times, so 2nd exactIn quote is def expected to hit cached routes.
              // if it's exactOut quote, we should always hit the cached routes.
              // this is regardless of protocol version.
              // the reason is because exact in quote always runs before exact out
              // along with the native or wrapped native pool token address assertions previously
              // it ensures the cached routes will always cache wrapped native for v2,v3 pool routes
              // and native for v4 pool routes
              expect(response.data.hitsCachedRoutes).to.be.true
            })

            it(`eth -> erc20`, async () => {
              const quoteReq: QuoteQueryParams = {
                tokenInAddress: 'ETH',
                tokenInChainId: 1,
                tokenOutAddress: 'UNI',
                tokenOutChainId: 1,
                amount:
                  type == 'exactIn'
                    ? await getAmount(1, type, 'ETH', 'UNI', '10')
                    : await getAmount(1, type, 'ETH', 'UNI', '10000'),
                type,
                recipient: alice.address,
                slippageTolerance: type == 'exactOut' ? LARGE_SLIPPAGE : SLIPPAGE, // for exact out somehow the liquidation wasn't sufficient, hence higher slippage
                deadline: '360',
                algorithm,
                simulateFromAddress: '0x0716a17FBAeE714f1E6aB0f9d59edbC5f09815C0',
                enableUniversalRouter: true,
                protocols: ALL_PROTOCOLS,
              }

              const queryParams = qs.stringify(quoteReq)

              const response = await axios.get<QuoteResponse>(`${API}?${queryParams}`, { headers: HEADERS_2_0 })
              const { data, status } = response
              expect(status).to.equal(200)
              expect(data.simulationError).to.equal(false)
              expect(data.methodParameters).to.not.be.undefined

              const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(
                data.methodParameters!,
                Ether.onChain(1),
                UNI_MAINNET
              )

              if (type == 'exactIn') {
                // We've swapped 10 ETH + gas costs
                expect(tokenInBefore.subtract(tokenInAfter).greaterThan(parseAmount('10', Ether.onChain(1)))).to.be.true
                checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(UNI_MAINNET, data.quote))
              } else {
                checkAbsoluteDifference(tokenOutAfter.subtract(tokenOutBefore).toExact(), '10000', 0.0001)
                // Can't easily check slippage for ETH due to gas costs effecting ETH balance.
              }

              // if it's exactIn quote, there's a slight chance the first quote request might be cache miss.
              // but this is okay because each test case retries 3 times, so 2nd exactIn quote is def expected to hit cached routes.
              // if it's exactOut quote, we should always hit the cached routes.
              // this is regardless of protocol version.
              // the reason is because exact in quote always runs before exact out
              // along with the native or wrapped native pool token address assertions previously
              // it ensures the cached routes will always cache wrapped native for v2,v3 pool routes
              // and native for v4 pool routes
              expect(response.data.hitsCachedRoutes).to.be.true
            })

            it(`eth -> erc20 swaprouter02`, async () => {
              const quoteReq: QuoteQueryParams = {
                tokenInAddress: 'ETH',
                tokenInChainId: 1,
                tokenOutAddress: 'UNI',
                tokenOutChainId: 1,
                amount:
                  type == 'exactIn'
                    ? await getAmount(1, type, 'ETH', 'UNI', '10')
                    : await getAmount(1, type, 'ETH', 'UNI', '10000'),
                type,
                recipient: alice.address,
                slippageTolerance: type == 'exactOut' ? LARGE_SLIPPAGE : SLIPPAGE, // for exact out somehow the liquidation wasn't sufficient, hence higher slippage,
                deadline: '360',
                algorithm,
                simulateFromAddress: '0x00000000219ab540356cBB839Cbe05303d7705Fa',
                enableUniversalRouter: false,
                protocols: ALL_PROTOCOLS,
              }

              const queryParams = qs.stringify(quoteReq)

              const response = await axios.get<QuoteResponse>(`${API}?${queryParams}`, { headers: HEADERS_1_2 })
              const { data, status } = response
              expect(status).to.equal(200)
              expect(data.methodParameters).to.not.be.undefined

              const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(
                data.methodParameters!,
                Ether.onChain(1),
                UNI_MAINNET
              )

              if (type == 'exactIn') {
                // We've swapped 10 ETH + gas costs
                expect(tokenInBefore.subtract(tokenInAfter).greaterThan(parseAmount('10', Ether.onChain(1)))).to.be.true
                checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(UNI_MAINNET, data.quote))
                expect(data.simulationError).to.equal(false)
              } else {
                checkAbsoluteDifference(tokenOutAfter.subtract(tokenOutBefore).toExact(), '10000', 0.0001)
                // Can't easily check slippage for ETH due to gas costs effecting ETH balance.
              }

              // if it's exactIn quote, there's a slight chance the first quote request might be cache miss.
              // but this is okay because each test case retries 3 times, so 2nd exactIn quote is def expected to hit cached routes.
              // if it's exactOut quote, we should always hit the cached routes.
              // this is regardless of protocol version.
              // the reason is because exact in quote always runs before exact out
              // along with the native or wrapped native pool token address assertions previously
              // it ensures the cached routes will always cache wrapped native for v2,v3 pool routes
              // and native for v4 pool routes
              expect(response.data.hitsCachedRoutes).to.be.true
            })

            it(`weth -> erc20`, async () => {
              const quoteReq: QuoteQueryParams = {
                tokenInAddress: 'WETH',
                tokenInChainId: 1,
                tokenOutAddress: 'DAI',
                tokenOutChainId: 1,
                amount: await getAmount(1, type, 'WETH', 'DAI', '100'),
                type,
                recipient: alice.address,
                slippageTolerance: SLIPPAGE,
                deadline: '360',
                algorithm,
                simulateFromAddress: '0xf04a5cc80b1e94c69b48f5ee68a08cd2f09a7c3e',
                enableUniversalRouter: true,
                protocols: ALL_PROTOCOLS,
              }

              const queryParams = qs.stringify(quoteReq)

              const response = await axios.get<QuoteResponse>(`${API}?${queryParams}`, { headers: HEADERS_2_0 })
              const { data, status } = response
              expect(status).to.equal(200)
              expect(data.simulationError).to.equal(false)
              expect(data.methodParameters).to.not.be.undefined

              const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(
                data.methodParameters!,
                WETH9[1]!,
                DAI_MAINNET
              )

              if (type == 'exactIn') {
                expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('100')
                checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(DAI_MAINNET, data.quote))
              } else {
                expect(tokenOutAfter.subtract(tokenOutBefore).toExact()).to.equal('100')
                checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(WETH9[1]!, data.quote))
              }

              // if it's exactIn quote, there's a slight chance the first quote request might be cache miss.
              // but this is okay because each test case retries 3 times, so 2nd exactIn quote is def expected to hit cached routes.
              // if it's exactOut quote, we should always hit the cached routes.
              // this is regardless of protocol version.
              // the reason is because exact in quote always runs before exact out
              // along with the native or wrapped native pool token address assertions previously
              // it ensures the cached routes will always cache wrapped native for v2,v3 pool routes
              // and native for v4 pool routes
              expect(response.data.hitsCachedRoutes).to.be.true
            })

            it(`erc20 -> weth`, async () => {
              const quoteReq: QuoteQueryParams = {
                tokenInAddress: 'USDC',
                tokenInChainId: 1,
                tokenOutAddress: 'WETH',
                tokenOutChainId: 1,
                amount: await getAmount(1, type, 'USDC', 'WETH', '100'),
                type,
                recipient: alice.address,
                slippageTolerance: SLIPPAGE,
                deadline: '360',
                algorithm,
                simulateFromAddress: '0xf584f8728b874a6a5c7a8d4d387c9aae9172d621',
                enableUniversalRouter: true,
                protocols: ALL_PROTOCOLS,
              }

              const queryParams = qs.stringify(quoteReq)

              const response = await axios.get<QuoteResponse>(`${API}?${queryParams}`, { headers: HEADERS_2_0 })
              const { data, status } = response
              expect(status).to.equal(200)
              expect(data.simulationError).to.equal(false)
              expect(data.methodParameters).to.not.be.undefined

              const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(
                data.methodParameters!,
                USDC_MAINNET,
                WETH9[1]!
              )

              if (type == 'exactIn') {
                expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('100')
                checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(WETH9[1], data.quote))
              } else {
                expect(tokenOutAfter.subtract(tokenOutBefore).toExact()).to.equal('100')
                checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(USDC_MAINNET, data.quote))
              }

              // if it's exactIn quote, there's a slight chance the first quote request might be cache miss.
              // but this is okay because each test case retries 3 times, so 2nd exactIn quote is def expected to hit cached routes.
              // if it's exactOut quote, we should always hit the cached routes.
              // this is regardless of protocol version.
              // the reason is because exact in quote always runs before exact out
              // along with the native or wrapped native pool token address assertions previously
              // it ensures the cached routes will always cache wrapped native for v2,v3 pool routes
              // and native for v4 pool routes
              expect(response.data.hitsCachedRoutes).to.be.true
            })

            const uraRefactorInterimState = ['before', 'after']
            GREENLIST_TOKEN_PAIRS.forEach(([tokenIn, tokenOut]) => {
              uraRefactorInterimState.forEach((state) => {
                it.skip(`${tokenIn.symbol} -> ${tokenOut.symbol} with portion, state = ${state}`, async () => {
                  const originalAmount = getTestAmount(type === 'exactIn' ? tokenIn : tokenOut)
                  const tokenInSymbol = tokenIn.symbol!
                  const tokenOutSymbol = tokenOut.symbol!
                  const tokenInAddress = tokenIn.isNative ? tokenInSymbol : tokenIn.address
                  const tokenOutAddress = tokenOut.isNative ? tokenOutSymbol : tokenOut.address
                  const amount = await getAmountFromToken(type, tokenIn.wrapped, tokenOut.wrapped, originalAmount)

                  // we need to simulate URA before and after merging https://github.com/Uniswap/unified-routing-api/pull/282 interim states
                  // to ensure routing-api is backward compatible with URA
                  let portionBips = undefined
                  if (state === 'before' && type === 'exactIn') {
                    portionBips = FLAT_PORTION.bips
                  } else if (state === 'after') {
                    portionBips = FLAT_PORTION.bips
                  }
                  let portionAmount = undefined
                  if (state === 'before' && type === 'exactOut') {
                    portionAmount = CurrencyAmount.fromRawAmount(tokenOut, amount)
                      .multiply(new Fraction(FLAT_PORTION.bips, 10_000))
                      .quotient.toString()
                  } else if (state === 'after') {
                    // after URA merges https://github.com/Uniswap/unified-routing-api/pull/282,
                    // it no longer sends portionAmount
                    portionAmount = undefined
                  }

                  const quoteReq: QuoteQueryParams = {
                    tokenInAddress: tokenInAddress,
                    tokenInChainId: tokenIn.chainId,
                    tokenOutAddress: tokenOutAddress,
                    tokenOutChainId: tokenOut.chainId,
                    amount: amount,
                    type: type,
                    protocols: ALL_PROTOCOLS,
                    recipient: alice.address,
                    slippageTolerance: SLIPPAGE,
                    deadline: '360',
                    algorithm,
                    enableUniversalRouter: true,
                    simulateFromAddress: alice.address,
                    portionBips: portionBips,
                    portionAmount: portionAmount,
                    portionRecipient: FLAT_PORTION.recipient,
                  }

                  const queryParams = qs.stringify(quoteReq)

                  const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(
                    `${API}?${queryParams}`,
                    { headers: HEADERS_2_0 }
                  )
                  const { data, status } = response
                  expect(status).to.equal(200)
                  expect(data.simulationError).to.equal(false)
                  expect(data.methodParameters).to.not.be.undefined

                  expect(data.portionRecipient).to.not.be.undefined

                  if (!(state === 'before' && type === 'exactOut')) {
                    // before URA interim state it doesnt send portionBips to routing-api,
                    // so routing-api has no way to know the portionBips
                    expect(data.portionBips).to.not.be.undefined
                    expect(data.portionBips).to.equal(FLAT_PORTION.bips)
                  }
                  expect(data.portionAmount).to.not.be.undefined
                  expect(data.portionAmountDecimals).to.not.be.undefined
                  expect(data.quoteGasAndPortionAdjusted).to.not.be.undefined
                  expect(data.quoteGasAndPortionAdjustedDecimals).to.not.be.undefined

                  expect(data.portionRecipient).to.equal(FLAT_PORTION.recipient)

                  if (type == 'exactIn') {
                    const allQuotesAcrossRoutes = data.route
                      .map((routes) =>
                        routes
                          .map((route) => route.amountOut)
                          .map((amountOut) => CurrencyAmount.fromRawAmount(tokenOut, amountOut ?? '0'))
                          .reduce((cur, total) => total.add(cur), CurrencyAmount.fromRawAmount(tokenOut, '0'))
                      )
                      .reduce((cur, total) => total.add(cur), CurrencyAmount.fromRawAmount(tokenOut, '0'))

                    const quote = CurrencyAmount.fromRawAmount(tokenOut, data.quote)
                    const expectedPortionAmount = quote.multiply(new Fraction(FLAT_PORTION.bips, 10000))
                    expect(data.portionAmount).to.equal(expectedPortionAmount.quotient.toString())

                    // The most strict way to ensure the output amount from route path is correct with respect to portion
                    // is to make sure the output amount from route path is exactly portion bps different from the quote
                    const tokensDiff = quote.subtract(allQuotesAcrossRoutes)
                    const percentDiff = tokensDiff.asFraction.divide(quote.asFraction)
                    expect(percentDiff.quotient.toString()).equal(
                      new Fraction(FLAT_PORTION.bips, 10_000).quotient.toString()
                    )
                  } else {
                    const allQuotesAcrossRoutes = data.route
                      .map((routes) =>
                        routes
                          .map((route) => route.amountOut)
                          .map((amountOut) => CurrencyAmount.fromRawAmount(tokenIn, amountOut ?? '0'))
                          .reduce((cur, total) => total.add(cur), CurrencyAmount.fromRawAmount(tokenIn, '0'))
                      )
                      .reduce((cur, total) => total.add(cur), CurrencyAmount.fromRawAmount(tokenIn, '0'))
                    const quote = CurrencyAmount.fromRawAmount(tokenIn, data.quote)
                    const expectedPortionAmount = CurrencyAmount.fromRawAmount(tokenOut, amount).multiply(
                      new Fraction(FLAT_PORTION.bips, 10000)
                    )
                    expect(data.portionAmount).to.equal(expectedPortionAmount.quotient.toString())

                    // The most strict way to ensure the output amount from route path is correct with respect to portion
                    // is to make sure the output amount from route path is exactly portion bps different from the quote
                    const tokensDiff = allQuotesAcrossRoutes.subtract(quote)
                    const percentDiff = tokensDiff.asFraction.divide(quote.asFraction)
                    expect(percentDiff.quotient.toString()).equal(
                      new Fraction(FLAT_PORTION.bips, 10_000).quotient.toString()
                    )
                  }

                  const {
                    tokenInBefore,
                    tokenInAfter,
                    tokenOutBefore,
                    tokenOutAfter,
                    tokenOutPortionRecipientBefore,
                    tokenOutPortionRecipientAfter,
                  } = await executeSwap(
                    data.methodParameters!,
                    tokenIn,
                    tokenOut!,
                    false,
                    tokenIn.chainId,
                    FLAT_PORTION
                  )

                  if (type == 'exactIn') {
                    // if the token in is native token, the difference will be slightly larger due to gas. We have no way to know precise gas costs in terms of GWEI * gas units.
                    if (!tokenIn.isNative) {
                      expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal(originalAmount)
                    }

                    // if the token out is native token, the difference will be slightly larger due to gas. We have no way to know precise gas costs in terms of GWEI * gas units.
                    if (!tokenOut.isNative) {
                      checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(tokenOut, data.quote))
                    }

                    expect(data.portionAmount).not.to.be.undefined

                    const expectedPortionAmount = CurrencyAmount.fromRawAmount(tokenOut, data.portionAmount!)
                    checkPortionRecipientToken(
                      tokenOutPortionRecipientBefore!,
                      tokenOutPortionRecipientAfter!,
                      expectedPortionAmount
                    )
                  } else {
                    // if the token out is native token, the difference will be slightly larger due to gas. We have no way to know precise gas costs in terms of GWEI * gas units.
                    if (!tokenOut.isNative) {
                      expect(tokenOutAfter.subtract(tokenOutBefore).toExact()).to.equal(originalAmount)
                    }

                    // if the token out is native token, the difference will be slightly larger due to gas. We have no way to know precise gas costs in terms of GWEI * gas units.
                    if (!tokenIn.isNative) {
                      checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(tokenIn, data.quote))
                    }

                    expect(data.portionAmount).not.to.be.undefined

                    const expectedPortionAmount = CurrencyAmount.fromRawAmount(tokenOut, data.portionAmount!)
                    checkPortionRecipientToken(
                      tokenOutPortionRecipientBefore!,
                      tokenOutPortionRecipientAfter!,
                      expectedPortionAmount
                    )
                  }

                  // if it's exactIn quote, there's a slight chance the first quote request might be cache miss.
                  // but this is okay because each test case retries 3 times, so 2nd exactIn quote is def expected to hit cached routes.
                  // if it's exactOut quote, we should always hit the cached routes.
                  // this is regardless of protocol version.
                  // the reason is because exact in quote always runs before exact out
                  // along with the native or wrapped native pool token address assertions previously
                  // it ensures the cached routes will always cache wrapped native for v2,v3 pool routes
                  // and native for v4 pool routes
                  expect(response.data.hitsCachedRoutes).to.be.true
                })
              })
            })
          })
        }
        it(`erc20 -> erc20 no recipient/deadline/slippage`, async () => {
          const quoteReq: QuoteQueryParams = {
            tokenInAddress: 'USDC',
            tokenInChainId: 1,
            tokenOutAddress: 'USDT',
            tokenOutChainId: 1,
            amount: await getAmount(1, type, 'USDC', 'USDT', '100'),
            type,
            algorithm,
            enableUniversalRouter: true,
            protocols: ALL_PROTOCOLS,
          }

          const queryParams = qs.stringify(quoteReq)

          const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(`${API}?${queryParams}`, {
            headers: HEADERS_2_0,
          })
          const {
            data: { quoteDecimals, quoteGasAdjustedDecimals, methodParameters },
            status,
          } = response

          expect(status).to.equal(200)
          expect(parseFloat(quoteDecimals)).to.be.greaterThan(90)
          expect(parseFloat(quoteDecimals)).to.be.lessThan(110)

          if (type == 'exactIn') {
            expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals))
          } else {
            expect(parseFloat(quoteGasAdjustedDecimals)).to.be.greaterThanOrEqual(parseFloat(quoteDecimals))
          }

          expect(methodParameters).to.be.undefined

          // if it's exactIn quote, there's a slight chance the first quote request might be cache miss.
          // but this is okay because each test case retries 3 times, so 2nd exactIn quote is def expected to hit cached routes.
          // if it's exactOut quote, we should always hit the cached routes.
          // this is regardless of protocol version.
          // the reason is because exact in quote always runs before exact out
          // along with the native or wrapped native pool token address assertions previously
          // it ensures the cached routes will always cache wrapped native for v2,v3 pool routes
          // and native for v4 pool routes
          expect(response.data.hitsCachedRoutes).to.be.true
        })

        it(`one of recipient/deadline/slippage is missing`, async () => {
          const quoteReq: QuoteQueryParams = {
            tokenInAddress: 'USDC',
            tokenInChainId: 1,
            tokenOutAddress: 'USDT',
            tokenOutChainId: 1,
            amount: await getAmount(1, type, 'USDC', 'USDT', '100'),
            type,
            slippageTolerance: SLIPPAGE,
            deadline: '360',
            algorithm,
            enableUniversalRouter: true,
            protocols: ALL_PROTOCOLS,
          }
          const queryParams = qs.stringify(quoteReq)

          const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(`${API}?${queryParams}`, {
            headers: HEADERS_2_0,
          })
          const {
            data: { quoteDecimals, quoteGasAdjustedDecimals, methodParameters },
            status,
          } = response

          expect(status).to.equal(200)
          expect(parseFloat(quoteDecimals)).to.be.greaterThan(90)
          expect(parseFloat(quoteDecimals)).to.be.lessThan(110)

          if (type == 'exactIn') {
            expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals))
          } else {
            expect(parseFloat(quoteGasAdjustedDecimals)).to.be.greaterThanOrEqual(parseFloat(quoteDecimals))
          }

          // Since ur-sdk hardcodes recipient in case of no recipient https://github.com/Uniswap/universal-router-sdk/blob/main/src/entities/protocols/uniswap.ts#L68
          // the calldata will still get generated even if URA doesn't pass in recipient
          expect(methodParameters).not.to.be.undefined

          // if it's exactIn quote, there's a slight chance the first quote request might be cache miss.
          // but this is okay because each test case retries 3 times, so 2nd exactIn quote is def expected to hit cached routes.
          // if it's exactOut quote, we should always hit the cached routes.
          // this is regardless of protocol version.
          // the reason is because exact in quote always runs before exact out
          // along with the native or wrapped native pool token address assertions previously
          // it ensures the cached routes will always cache wrapped native for v2,v3 pool routes
          // and native for v4 pool routes
          expect(response.data.hitsCachedRoutes).to.be.true
        })

        it(`erc20 -> erc20 gas price specified`, async () => {
          const quoteReq: QuoteQueryParams = {
            tokenInAddress: 'USDC',
            tokenInChainId: 1,
            tokenOutAddress: 'USDT',
            tokenOutChainId: 1,
            amount: await getAmount(1, type, 'USDC', 'USDT', '100'),
            type,
            algorithm,
            gasPriceWei: '60000000000',
            enableUniversalRouter: true,
            protocols: ALL_PROTOCOLS,
          }

          const queryParams = qs.stringify(quoteReq)

          const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(`${API}?${queryParams}`, {
            headers: HEADERS_2_0,
          })
          const {
            data: { quoteDecimals, quoteGasAdjustedDecimals, methodParameters, gasPriceWei },
            status,
          } = response

          expect(status).to.equal(200)

          if (algorithm == 'alpha') {
            expect(gasPriceWei).to.equal('60000000000')
          }

          expect(parseFloat(quoteDecimals)).to.be.greaterThan(90)
          expect(parseFloat(quoteDecimals)).to.be.lessThan(110)

          if (type == 'exactIn') {
            expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals))
          } else {
            expect(parseFloat(quoteGasAdjustedDecimals)).to.be.greaterThanOrEqual(parseFloat(quoteDecimals))
          }

          expect(methodParameters).to.be.undefined

          // if it's exactIn quote, there's a slight chance the first quote request might be cache miss.
          // but this is okay because each test case retries 3 times, so 2nd exactIn quote is def expected to hit cached routes.
          // if it's exactOut quote, we should always hit the cached routes.
          // this is regardless of protocol version.
          // the reason is because exact in quote always runs before exact out
          // along with the native or wrapped native pool token address assertions previously
          // it ensures the cached routes will always cache wrapped native for v2,v3 pool routes
          // and native for v4 pool routes
          expect(response.data.hitsCachedRoutes).to.be.true
        })

        it(`erc20 -> erc20 gas token specified`, async () => {
          const quoteReq: QuoteQueryParams = {
            tokenInAddress: 'USDC',
            tokenInChainId: 1,
            tokenOutAddress: 'USDT',
            tokenOutChainId: 1,
            amount: await getAmount(1, type, 'USDC', 'USDT', '100'),
            type,
            algorithm,
            gasPriceWei: '60000000000',
            enableUniversalRouter: true,
            gasToken: USDC_MAINNET.address,
            protocols: ALL_PROTOCOLS,
          }

          const queryParams = qs.stringify(quoteReq)

          const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(`${API}?${queryParams}`, {
            headers: HEADERS_2_0,
          })
          const {
            data: {
              quoteDecimals,
              quoteGasAdjustedDecimals,
              gasUseEstimateGasToken,
              gasUseEstimateGasTokenDecimals,
              methodParameters,
              gasPriceWei,
            },
            status,
          } = response

          expect(status).to.equal(200)
          expect(gasUseEstimateGasToken).to.not.be.undefined
          expect(gasUseEstimateGasTokenDecimals).to.not.be.undefined

          if (algorithm == 'alpha') {
            expect(gasPriceWei).to.equal('60000000000')
          }

          expect(parseFloat(quoteDecimals)).to.be.greaterThan(90)
          expect(parseFloat(quoteDecimals)).to.be.lessThan(110)
          expect(parseFloat(gasUseEstimateGasTokenDecimals!)).to.be.greaterThan(0)

          if (type == 'exactIn') {
            expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals))
          } else {
            expect(parseFloat(quoteGasAdjustedDecimals)).to.be.greaterThanOrEqual(parseFloat(quoteDecimals))
          }

          expect(methodParameters).to.be.undefined

          // if it's exactIn quote, there's a slight chance the first quote request might be cache miss.
          // but this is okay because each test case retries 3 times, so 2nd exactIn quote is def expected to hit cached routes.
          // if it's exactOut quote, we should always hit the cached routes.
          // this is regardless of protocol version.
          // the reason is because exact in quote always runs before exact out
          // along with the native or wrapped native pool token address assertions previously
          // it ensures the cached routes will always cache wrapped native for v2,v3 pool routes
          // and native for v4 pool routes
          expect(response.data.hitsCachedRoutes).to.be.true
        })

        it(`erc20 -> erc20 by address`, async () => {
          const quoteReq: QuoteQueryParams = {
            tokenInAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
            tokenInChainId: 1, // DAI
            tokenOutAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            tokenOutChainId: 1, // USDC
            amount: await getAmount(1, type, 'DAI', 'USDC', '100'),
            type,
            recipient: alice.address,
            slippageTolerance: SLIPPAGE,
            deadline: '360',
            algorithm,
            enableUniversalRouter: true,
            protocols: ALL_PROTOCOLS,
          }

          const queryParams = qs.stringify(quoteReq)

          const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(`${API}?${queryParams}`, {
            headers: HEADERS_2_0,
          })

          const {
            data: { quoteDecimals, quoteGasAdjustedDecimals },
            status,
          } = response

          expect(status).to.equal(200)
          expect(parseFloat(quoteDecimals)).to.be.greaterThan(90)

          if (type == 'exactIn') {
            expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals))
          } else {
            expect(parseFloat(quoteGasAdjustedDecimals)).to.be.greaterThanOrEqual(parseFloat(quoteDecimals))
          }

          expect(parseFloat(quoteDecimals)).to.be.lessThan(110)

          // if it's exactIn quote, there's a slight chance the first quote request might be cache miss.
          // but this is okay because each test case retries 3 times, so 2nd exactIn quote is def expected to hit cached routes.
          // if it's exactOut quote, we should always hit the cached routes.
          // this is regardless of protocol version.
          // the reason is because exact in quote always runs before exact out
          // along with the native or wrapped native pool token address assertions previously
          // it ensures the cached routes will always cache wrapped native for v2,v3 pool routes
          // and native for v4 pool routes
          expect(response.data.hitsCachedRoutes).to.be.true
        })

        it(`erc20 -> erc20 one by address one by symbol`, async () => {
          const quoteReq: QuoteQueryParams = {
            tokenInAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
            tokenInChainId: 1,
            tokenOutAddress: 'USDC',
            tokenOutChainId: 1,
            amount: await getAmount(1, type, 'DAI', 'USDC', '100'),
            type,
            recipient: alice.address,
            slippageTolerance: SLIPPAGE,
            deadline: '360',
            algorithm,
            enableUniversalRouter: true,
            protocols: ALL_PROTOCOLS,
          }

          const queryParams = qs.stringify(quoteReq)

          const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(`${API}?${queryParams}`, {
            headers: HEADERS_2_0,
          })
          const {
            data: { quoteDecimals, quoteGasAdjustedDecimals },
            status,
          } = response

          expect(status).to.equal(200)
          expect(parseFloat(quoteDecimals)).to.be.greaterThan(90)

          if (type == 'exactIn') {
            expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals))
          } else {
            expect(parseFloat(quoteGasAdjustedDecimals)).to.be.greaterThanOrEqual(parseFloat(quoteDecimals))
          }

          expect(parseFloat(quoteDecimals)).to.be.lessThan(110)

          // if it's exactIn quote, there's a slight chance the first quote request might be cache miss.
          // but this is okay because each test case retries 3 times, so 2nd exactIn quote is def expected to hit cached routes.
          // if it's exactOut quote, we should always hit the cached routes.
          // this is regardless of protocol version.
          // the reason is because exact in quote always runs before exact out
          // along with the native or wrapped native pool token address assertions previously
          // it ensures the cached routes will always cache wrapped native for v2,v3 pool routes
          // and native for v4 pool routes
          expect(response.data.hitsCachedRoutes).to.be.true
        })
      })

      describe(`${ID_TO_NETWORK_NAME(1)} ${algorithm} ${type} 4xx`, () => {
        it(`field is missing in body`, async () => {
          const quoteReq: Partial<QuoteQueryParams> = {
            tokenOutAddress: 'USDT',
            tokenInChainId: 1,
            tokenOutChainId: 1,
            amount: await getAmount(1, type, 'USDC', 'USDT', '100'),
            type,
            recipient: alice.address,
            slippageTolerance: SLIPPAGE,
            deadline: '360',
            algorithm,
            enableUniversalRouter: true,
          }

          await callAndExpectFail(quoteReq, {
            status: 400,
            data: {
              detail: '"tokenInAddress" is required',
              errorCode: 'VALIDATION_ERROR',
            },
          })
        })

        it.skip(`amount is too big to find route`, async () => {
          const quoteReq: QuoteQueryParams = {
            tokenInAddress: 'UNI',
            tokenInChainId: 1,
            tokenOutAddress: 'KNC',
            tokenOutChainId: 1,
            amount: await getAmount(1, type, 'UNI', 'KNC', '9999999999999999999999999999999999999999999999999'),
            type,
            recipient: '0x88fc765949a27405480F374Aa49E20dcCD3fCfb8',
            slippageTolerance: SLIPPAGE,
            deadline: '360',
            algorithm,
            enableUniversalRouter: true,
            protocols: ALL_PROTOCOLS,
          }

          await callAndExpectFail(quoteReq, {
            status: 400,
            data: {
              detail: 'No route found',
              errorCode: 'NO_ROUTE',
            },
          })
        })

        it(`amount is too big for uint256`, async () => {
          const quoteReq: QuoteQueryParams = {
            tokenInAddress: 'USDC',
            tokenInChainId: 1,
            tokenOutAddress: 'USDT',
            tokenOutChainId: 1,
            amount: await getAmount(
              1,
              type,
              'USDC',
              'USDT',
              '100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
            ),
            type,
            recipient: alice.address,
            slippageTolerance: SLIPPAGE,
            deadline: '360',
            algorithm,
            protocols: ALL_PROTOCOLS,
          }

          await callAndExpectFail(quoteReq, {
            status: 400,
            data: {
              detail: '"amount" length must be less than or equal to 77 characters long',
              errorCode: 'VALIDATION_ERROR',
            },
          })
        })

        it(`amount is negative`, async () => {
          const quoteReq: QuoteQueryParams = {
            tokenInAddress: 'USDC',
            tokenInChainId: 1,
            tokenOutAddress: 'USDT',
            tokenOutChainId: 1,
            amount: '-10000000000',
            type,
            recipient: alice.address,
            slippageTolerance: SLIPPAGE,
            deadline: '360',
            algorithm,
            enableUniversalRouter: true,
            protocols: ALL_PROTOCOLS,
          }

          await callAndExpectFail(quoteReq, {
            status: 400,
            data: {
              detail: '"amount" with value "-10000000000" fails to match the required pattern: /^[0-9]+$/',
              errorCode: 'VALIDATION_ERROR',
            },
          })
        })

        it(`amount is zero`, async () => {
          const quoteReq: QuoteQueryParams = {
            tokenInAddress: 'USDC',
            tokenInChainId: 1,
            tokenOutAddress: 'USDT',
            tokenOutChainId: 1,
            amount: '0',
            type,
            recipient: alice.address,
            slippageTolerance: SLIPPAGE,
            deadline: '360',
            algorithm,
            enableUniversalRouter: true,
            protocols: ALL_PROTOCOLS,
          }

          await callAndExpectFail(quoteReq, {
            status: 400,
            data: {
              detail: 'Amount must be greater than 0',
              errorCode: 'AMOUNT_INVALID',
            },
          })
        })

        it(`amount is decimal`, async () => {
          const quoteReq: QuoteQueryParams = {
            tokenInAddress: 'USDC',
            tokenInChainId: 1,
            tokenOutAddress: 'USDT',
            tokenOutChainId: 1,
            amount: '1000000000.25',
            type,
            recipient: alice.address,
            slippageTolerance: SLIPPAGE,
            deadline: '360',
            algorithm,
            enableUniversalRouter: true,
            protocols: ALL_PROTOCOLS,
          }

          await callAndExpectFail(quoteReq, {
            status: 400,
            data: {
              detail: '"amount" with value "1000000000.25" fails to match the required pattern: /^[0-9]+$/',
              errorCode: 'VALIDATION_ERROR',
            },
          })
        })

        it(`symbol doesnt exist`, async () => {
          const quoteReq: QuoteQueryParams = {
            tokenInAddress: 'USDC',
            tokenInChainId: 1,
            tokenOutAddress: 'NONEXISTANTTOKEN',
            tokenOutChainId: 1,
            amount: await getAmount(1, type, 'USDC', 'USDT', '100'),
            type,
            recipient: alice.address,
            slippageTolerance: SLIPPAGE,
            deadline: '360',
            algorithm,
            protocols: ALL_PROTOCOLS,
          }

          await callAndExpectFail(quoteReq, {
            status: 400,
            data: {
              detail: 'Could not find token with address "NONEXISTANTTOKEN"',
              errorCode: 'TOKEN_OUT_INVALID',
            },
          })
        })

        it(`tokens are the same symbol`, async () => {
          const quoteReq: QuoteQueryParams = {
            tokenInAddress: 'USDT',
            tokenInChainId: 1,
            tokenOutAddress: 'USDT',
            tokenOutChainId: 1,
            amount: await getAmount(1, type, 'USDC', 'USDT', '100'),
            type,
            recipient: alice.address,
            slippageTolerance: SLIPPAGE,
            deadline: '360',
            algorithm,
            enableUniversalRouter: true,
            protocols: ALL_PROTOCOLS,
          }

          await callAndExpectFail(quoteReq, {
            status: 400,
            data: {
              detail: 'tokenIn and tokenOut must be different',
              errorCode: 'TOKEN_IN_OUT_SAME',
            },
          })
        })

        it(`tokens are the same symbol and address`, async () => {
          const quoteReq: QuoteQueryParams = {
            tokenInAddress: 'USDT',
            tokenInChainId: 1,
            tokenOutAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            tokenOutChainId: 1,
            amount: await getAmount(1, type, 'USDT', 'USDT', '100'),
            type,
            recipient: alice.address,
            slippageTolerance: SLIPPAGE,
            deadline: '360',
            algorithm,
            enableUniversalRouter: true,
            protocols: ALL_PROTOCOLS,
          }

          await callAndExpectFail(quoteReq, {
            status: 400,
            data: {
              detail: 'tokenIn and tokenOut must be different',
              errorCode: 'TOKEN_IN_OUT_SAME',
            },
          })
        })

        it(`tokens are the same address`, async () => {
          const quoteReq: QuoteQueryParams = {
            tokenInAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            tokenInChainId: 1,
            tokenOutAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            tokenOutChainId: 1,
            amount: await getAmount(1, type, 'USDT', 'USDT', '100'),
            type,
            recipient: alice.address,
            slippageTolerance: SLIPPAGE,
            deadline: '360',
            algorithm,
            enableUniversalRouter: true,
            protocols: ALL_PROTOCOLS,
          }
          await callAndExpectFail(quoteReq, {
            status: 400,
            data: {
              detail: 'tokenIn and tokenOut must be different',
              errorCode: 'TOKEN_IN_OUT_SAME',
            },
          })
        })

        it(`tokens are the same after getting wrapped`, async () => {
          const quoteReq: QuoteQueryParams = {
            tokenInAddress: 'ETH',
            tokenInChainId: 1,
            tokenOutAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
            tokenOutChainId: 1,
            amount: await getAmount(1, type, 'ETH', 'WETH', '1'),
            type,
            recipient: alice.address,
            slippageTolerance: SLIPPAGE,
            deadline: '360',
            algorithm,
            enableUniversalRouter: true,
            protocols: ALL_PROTOCOLS,
          }
          await callAndExpectFail(quoteReq, {
            status: 400,
            data: {
              detail: 'tokenIn and tokenOut must be different',
              errorCode: 'TOKEN_IN_OUT_SAME',
            },
          })
        })

        it(`recipient is an invalid address`, async () => {
          const quoteReq: QuoteQueryParams = {
            tokenInAddress: 'USDT',
            tokenInChainId: 1,
            tokenOutAddress: 'USDC',
            tokenOutChainId: 1,
            amount: await getAmount(1, type, 'USDT', 'USDC', '100'),
            type,
            recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aZZZZZZZ',
            slippageTolerance: SLIPPAGE,
            deadline: '360',
            algorithm,
            enableUniversalRouter: true,
            protocols: ALL_PROTOCOLS,
          }

          await callAndExpectFail(quoteReq, {
            status: 400,
            data: {
              detail:
                '"recipient" with value "0xAb5801a7D398351b8bE11C439e05C5B3259aZZZZZZZ" fails to match the required pattern: /^0x[a-fA-F0-9]{40}$/',
              errorCode: 'VALIDATION_ERROR',
            },
          })
        })

        it(`unsupported chain`, async () => {
          const quoteReq: QuoteQueryParams = {
            tokenInAddress: 'USDC',
            tokenInChainId: 70,
            tokenOutAddress: 'USDT',
            tokenOutChainId: 70,
            amount: '10000000000',
            type,
            recipient: alice.address,
            slippageTolerance: SLIPPAGE,
            deadline: '360',
            algorithm,
            enableUniversalRouter: true,
            protocols: ALL_PROTOCOLS,
          }

          const chains = SUPPORTED_CHAINS.values()
          const chainStr = [...chains].toString().split(',').join(', ')

          await callAndExpectFail(quoteReq, {
            status: 400,
            data: {
              detail: `"tokenInChainId" must be one of [${chainStr}]`,
              errorCode: 'VALIDATION_ERROR',
            },
          })
        })
      })
    }
  }

  const TEST_ERC20_1: { [chainId in ChainId]: () => null | Token } = {
    [ChainId.MAINNET]: () => USDC_ON(1),
    [ChainId.GOERLI]: () => USDC_ON(ChainId.GOERLI),
    [ChainId.SEPOLIA]: () => USDC_ON(ChainId.SEPOLIA),
    [ChainId.SEPOLIA]: () => V4_SEPOLIA_TEST_A,
    [ChainId.OPTIMISM]: () => USDC_ON(ChainId.OPTIMISM),
    [ChainId.OPTIMISM]: () => USDC_NATIVE_OPTIMISM,
    [ChainId.OPTIMISM_GOERLI]: () => USDC_ON(ChainId.OPTIMISM_GOERLI),
    [ChainId.OPTIMISM_SEPOLIA]: () => USDC_ON(ChainId.OPTIMISM_SEPOLIA),
    [ChainId.ARBITRUM_ONE]: () => USDC_ON(ChainId.ARBITRUM_ONE),
    [ChainId.ARBITRUM_ONE]: () => USDC_NATIVE_ARBITRUM,
    [ChainId.ARBITRUM_SEPOLIA]: () => USDC_ON(ChainId.ARBITRUM_ONE),
    [ChainId.POLYGON]: () => USDC_ON(ChainId.POLYGON),
    [ChainId.POLYGON]: () => USDC_NATIVE_POLYGON,
    [ChainId.POLYGON_MUMBAI]: () => USDC_ON(ChainId.POLYGON_MUMBAI),
    [ChainId.CELO]: () => CUSD_CELO,
    [ChainId.CELO_ALFAJORES]: () => CUSD_CELO_ALFAJORES,
    [ChainId.MOONBEAM]: () => null,
    [ChainId.GNOSIS]: () => null,
    [ChainId.ARBITRUM_GOERLI]: () => null,
    [ChainId.BNB]: () => USDC_ON(ChainId.BNB),
    [ChainId.AVALANCHE]: () => USDC_ON(ChainId.AVALANCHE),
    [ChainId.AVALANCHE]: () => USDC_NATIVE_AVAX,
    [ChainId.BASE_GOERLI]: () => USDC_ON(ChainId.BASE_GOERLI),
    [ChainId.BASE_SEPOLIA]: () => USDC_ON(ChainId.BASE_SEPOLIA),
    [ChainId.BASE]: () => USDC_ON(ChainId.BASE),
    [ChainId.BASE]: () => USDC_NATIVE_BASE,
    [ChainId.ZORA]: () => USDC_ON(ChainId.ZORA),
    [ChainId.ZORA_SEPOLIA]: () => USDC_ON(ChainId.ZORA_SEPOLIA),
    [ChainId.ROOTSTOCK]: () => USDC_ON(ChainId.ROOTSTOCK),
    [ChainId.BLAST]: () => USDB_BLAST,
    [ChainId.ZKSYNC]: () => USDC_ON(ChainId.ZKSYNC),
    [ChainId.WORLDCHAIN]: () => USDC_ON(ChainId.WORLDCHAIN),
    [ChainId.UNICHAIN_SEPOLIA]: () => USDC_ON(ChainId.UNICHAIN_SEPOLIA),
    [ChainId.UNICHAIN]: () => USDC_ON(ChainId.UNICHAIN),
    [ChainId.MONAD_TESTNET]: () => USDC_ON(ChainId.MONAD_TESTNET),
    [ChainId.SONEIUM]: () => USDC_ON(ChainId.SONEIUM),
  }

  const TEST_ERC20_2: { [chainId in ChainId]: () => Token | null } = {
    [ChainId.MAINNET]: () => DAI_ON(1),
    [ChainId.GOERLI]: () => DAI_ON(ChainId.GOERLI),
    [ChainId.SEPOLIA]: () => DAI_ON(ChainId.SEPOLIA),
    [ChainId.SEPOLIA]: () => V4_SEPOLIA_TEST_B,
    [ChainId.OPTIMISM]: () => DAI_ON(ChainId.OPTIMISM),
    [ChainId.OPTIMISM_GOERLI]: () => DAI_ON(ChainId.OPTIMISM_GOERLI),
    [ChainId.OPTIMISM_SEPOLIA]: () => USDC_ON(ChainId.OPTIMISM_SEPOLIA),
    [ChainId.ARBITRUM_ONE]: () => DAI_ON(ChainId.ARBITRUM_ONE),
    [ChainId.ARBITRUM_SEPOLIA]: () => DAI_ON(ChainId.ARBITRUM_ONE),
    [ChainId.POLYGON]: () => DAI_ON(ChainId.POLYGON),
    [ChainId.POLYGON_MUMBAI]: () => DAI_ON(ChainId.POLYGON_MUMBAI),
    [ChainId.CELO]: () => CEUR_CELO,
    [ChainId.CELO_ALFAJORES]: () => CEUR_CELO_ALFAJORES,
    [ChainId.MOONBEAM]: () => null,
    [ChainId.GNOSIS]: () => null,
    [ChainId.ARBITRUM_GOERLI]: () => null,
    [ChainId.BNB]: () => USDT_ON(ChainId.BNB),
    [ChainId.AVALANCHE]: () => DAI_ON(ChainId.AVALANCHE),
    [ChainId.BASE_GOERLI]: () => WNATIVE_ON(ChainId.BASE_GOERLI),
    [ChainId.BASE_SEPOLIA]: () => WNATIVE_ON(ChainId.BASE_SEPOLIA),
    [ChainId.BASE]: () => WNATIVE_ON(ChainId.BASE),
    [ChainId.ZORA]: () => WNATIVE_ON(ChainId.ZORA),
    [ChainId.ZORA_SEPOLIA]: () => WNATIVE_ON(ChainId.ZORA_SEPOLIA),
    [ChainId.ROOTSTOCK]: () => WNATIVE_ON(ChainId.ROOTSTOCK),
    [ChainId.BLAST]: () => WNATIVE_ON(ChainId.BLAST),
    [ChainId.ZKSYNC]: () => WNATIVE_ON(ChainId.ZKSYNC),
    [ChainId.WORLDCHAIN]: () => WLD_WORLDCHAIN,
    [ChainId.UNICHAIN_SEPOLIA]: () => WNATIVE_ON(ChainId.UNICHAIN_SEPOLIA),
    [ChainId.UNICHAIN]: () => WNATIVE_ON(ChainId.UNICHAIN),
    [ChainId.MONAD_TESTNET]: () => WNATIVE_ON(ChainId.MONAD_TESTNET),
    [ChainId.SONEIUM]: () => WNATIVE_ON(ChainId.SONEIUM),
  }

  // TODO: Find valid pools/tokens on optimistic kovan and polygon mumbai. We skip those tests for now.
  for (const chain of _.filter(
    SUPPORTED_CHAINS,
    (c) =>
      c != ChainId.OPTIMISM_SEPOLIA &&
      c != ChainId.POLYGON_MUMBAI &&
      c != ChainId.ARBITRUM_GOERLI &&
      c != ChainId.CELO_ALFAJORES &&
      // We will follow up supporting ZORA and ROOTSTOCK
      c != ChainId.ZORA_SEPOLIA &&
      c != ChainId.ROOTSTOCK &&
      c != ChainId.GOERLI &&
      // we have to disable sepolia tests for now
      // because they are testing V4_SEPOLIA_TEST_A -> V4_SEPOLIA_TEST_B
      // which no longer exists on re-deployed v4 pool manager
      c != ChainId.SEPOLIA &&
      c != ChainId.MONAD_TESTNET &&
      c != ChainId.UNICHAIN_SEPOLIA &&
      c != ChainId.BASE_SEPOLIA
  )) {
    for (const type of TRADE_TYPES) {
      const erc1 = TEST_ERC20_1[chain]()
      const erc2 = TEST_ERC20_2[chain]()

      // This is for Gnosis and Moonbeam which we don't have RPC Providers yet
      if (erc1 == null || erc2 == null) continue

      describe(`${ID_TO_NETWORK_NAME(chain)} ${type} 2xx`, function () {
        // Help with test flakiness by retrying.
        this.retries(3)
        const wrappedNative = WNATIVE_ON(chain)

        it(`${wrappedNative.symbol} -> erc20`, async () => {
          if (chain === ChainId.SEPOLIA && erc1.equals(V4_SEPOLIA_TEST_A)) {
            // there's no WETH/USDC v4 pool on Sepolia
            return
          }

          // Current WETH/USDB pool (https://blastscan.io/address/0xf52b4b69123cbcf07798ae8265642793b2e8990c) has low WETH amount
          const amount =
            chain === ChainId.BLAST ||
            chain === ChainId.WORLDCHAIN ||
            chain === ChainId.UNICHAIN_SEPOLIA ||
            chain === ChainId.ZORA
              ? type === 'exactOut'
                ? '0.002'
                : '0.01'
              : '1'

          const quoteReq: QuoteQueryParams = {
            tokenInAddress: wrappedNative.address,
            tokenInChainId: chain,
            tokenOutAddress: erc1.address,
            tokenOutChainId: chain,
            amount: await getAmountFromToken(type, wrappedNative, erc1, amount),
            type,
            enableUniversalRouter: true,
            protocols: ALL_PROTOCOLS,
          }

          const queryParams = qs.stringify(quoteReq)

          try {
            const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(`${API}?${queryParams}`, {
              headers: HEADERS_2_0,
            })
            const { status } = response

            expect(status).to.equal(200)

            // if it's exactIn quote, there's a slight chance the first quote request might be cache miss.
            // but this is okay because each test case retries 3 times, so 2nd exactIn quote is def expected to hit cached routes.
            // if it's exactOut quote, we should always hit the cached routes.
            // this is regardless of protocol version.
            // the reason is because exact in quote always runs before exact out
            // along with the native or wrapped native pool token address assertions previously
            // it ensures the cached routes will always cache wrapped native for v2,v3 pool routes
            // and native for v4 pool routes
            expect(response.data.hitsCachedRoutes).to.be.true
          } catch (err: any) {
            fail(JSON.stringify(err.response.data))
          }
        })

        it(`${wrappedNative.symbol} -> erc20 v2 only`, async () => {
          const isV2PairRoutable = V2_SUPPORTED_PAIRS.find(
            (pair) => pair[0]!.equals(wrappedNative) && pair[1]!.equals(erc1)
          )

          if (!isV2PairRoutable) {
            return
          }

          const quoteReq: QuoteQueryParams = {
            tokenInAddress: wrappedNative.address,
            tokenInChainId: chain,
            tokenOutAddress: erc1.address,
            tokenOutChainId: chain,
            amount: await getAmountFromToken(type, wrappedNative, erc1, '1'),
            type,
            enableUniversalRouter: true,
            protocols: 'v2',
          }

          const queryParams = qs.stringify(quoteReq)

          try {
            const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(`${API}?${queryParams}`, {
              headers: HEADERS_2_0,
            })
            const { status } = response

            expect(status).to.equal(200)

            // if it's exactIn quote, there's a slight chance the first quote request might be cache miss.
            // but this is okay because each test case retries 3 times, so 2nd exactIn quote is def expected to hit cached routes.
            // if it's exactOut quote, we should always hit the cached routes.
            // this is regardless of protocol version.
            // the reason is because exact in quote always runs before exact out
            // along with the native or wrapped native pool token address assertions previously
            // it ensures the cached routes will always cache wrapped native for v2,v3 pool routes
            // and native for v4 pool routes
            expect(response.data.hitsCachedRoutes).to.be.false
          } catch (err: any) {
            fail(JSON.stringify(err))
          }
        })

        it(`${erc1.symbol} -> ${erc2.symbol}`, async () => {
          if (chain === ChainId.SEPOLIA) {
            // Sepolia doesn't have sufficient liquidity on DAI pools yet
            return
          }

          // Disable ZORA exactOut tests to unblock pipeline because it doesn't have enough liquidity to calc gas costs.
          if (chain === ChainId.ZORA && type === 'exactOut') {
            return
          }

          // Disable SONEIUM exactOut tests to unblock pipeline because it doesn't have enough liquidity to calc gas costs.
          if (chain === ChainId.SONEIUM && type === 'exactOut') {
            return
          }

          // if it's exactOut and ZORA, don't use V2 because it doesn't have enough liquidity to calc gas costs.
          const protocols = chain === ChainId.ZORA && type === 'exactOut' ? 'v3,v4,mixed' : ALL_PROTOCOLS

          // Current WETH/USDB pool (https://blastscan.io/address/0xf52b4b69123cbcf07798ae8265642793b2e8990c) has low WETH amount
          const amount =
            type === 'exactOut' &&
            (chain === ChainId.BLAST || chain === ChainId.ZKSYNC || chain === ChainId.UNICHAIN_SEPOLIA)
              ? '0.002'
              : '1'

          const quoteReq: QuoteQueryParams = {
            tokenInAddress: erc1.address,
            tokenInChainId: chain,
            tokenOutAddress: erc2.address,
            tokenOutChainId: chain,
            amount: await getAmountFromToken(type, erc1, erc2, amount),
            protocols: protocols,
            type,
          }

          const queryParams = qs.stringify(quoteReq)

          try {
            const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(`${API}?${queryParams}`, {
              headers: HEADERS_2_0,
            })
            const { status } = response

            expect(status).to.equal(200)

            // if it's exactIn quote, there's a slight chance the first quote request might be cache miss.
            // but this is okay because each test case retries 3 times, so 2nd exactIn quote is def expected to hit cached routes.
            // if it's exactOut quote, we should always hit the cached routes.
            // this is regardless of protocol version.
            // the reason is because exact in quote always runs before exact out
            // along with the native or wrapped native pool token address assertions previously
            // it ensures the cached routes will always cache wrapped native for v2,v3 pool routes
            // and native for v4 pool routes
            if (!(chain === ChainId.ZORA && type === 'exactOut')) {
              expect(response.data.hitsCachedRoutes).to.be.true
            }
          } catch (err: any) {
            fail(JSON.stringify(err.response.data))
          }
        })

        const native = NATIVE_CURRENCY[chain]

        it(`${native} -> erc20`, async () => {
          if (
            chain === ChainId.BLAST ||
            chain === ChainId.ZORA ||
            chain === ChainId.ZKSYNC ||
            chain === ChainId.UNICHAIN_SEPOLIA ||
            chain === ChainId.UNICHAIN ||
            chain === ChainId.SONEIUM
          ) {
            // Blast doesn't have DAI or USDC yet
            // Zora doesn't have DAI
            // Zksync doesn't have liquid USDC/DAI pool yet
            return
          }

          // TODO ROUTE-64: Remove this once smart-order-router supports ETH native currency on BASE
          // see https://uniswapteam.slack.com/archives/C021SU4PMR7/p1691593679108459?thread_ts=1691532336.742419&cid=C021SU4PMR7
          const tokenOut = [ChainId.BASE, ChainId.SEPOLIA, ChainId.AVALANCHE].includes(chain)
            ? chain !== ChainId.SEPOLIA
              ? USDC_ON(chain)
              : USDC_NATIVE_SEPOLIA
            : erc2
          const amount = chain === ChainId.SEPOLIA ? (type === 'exactIn' ? '0.00000000000001' : '0.000001') : '0.1'

          const quoteReq: QuoteQueryParams = {
            tokenInAddress: native,
            tokenInChainId: chain,
            tokenOutAddress: tokenOut.address,
            tokenOutChainId: chain,
            amount: await getAmountFromToken(type, WNATIVE_ON(chain), tokenOut, amount),
            type,
            enableUniversalRouter: true,
            protocols: V4_SUPPORTED.includes(chain) ? 'v4' : 'v2,v3,mixed',
          }

          const queryParams = qs.stringify(quoteReq)

          try {
            const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(`${API}?${queryParams}`, {
              headers: HEADERS_2_0,
            })
            const { status, data } = response

            expect(status).to.equal(200, JSON.stringify(response.data))

            let nativeOrWrappedNativePoolFound = false
            let nativePoolFound = true

            // the v4 native pools or v3 wrapped native pools on sepolia can grow exponentially,
            // we just have to iterate through to make sure find it and assert the important data
            data.route.forEach((pools) => {
              pools.forEach((pool) => {
                if (pool.tokenIn.address === '0x0000000000000000000000000000000000000000') {
                  nativeOrWrappedNativePoolFound = true
                  nativePoolFound = true
                }

                if (pool.tokenIn.address.toLowerCase() === WNATIVE_ON(chain).address.toLowerCase()) {
                  nativeOrWrappedNativePoolFound = true
                }
              })
            })

            if (V4_SUPPORTED.includes(chain)) {
              expect(nativePoolFound).to.be.true
            }

            expect(nativeOrWrappedNativePoolFound).to.be.true

            // if it's exactIn quote, there's a slight chance the first quote request might be cache miss.
            // but this is okay because each test case retries 3 times, so 2nd exactIn quote is def expected to hit cached routes.
            // if it's exactOut quote, we should always hit the cached routes.
            // this is regardless of protocol version.
            // the reason is because exact in quote always runs before exact out
            // along with the native or wrapped native pool token address assertions previously
            // it ensures the cached routes will always cache wrapped native for v2,v3 pool routes
            // and native for v4 pool routes
            if (V4_SUPPORTED.includes(chain)) {
              expect(data.hitsCachedRoutes).to.be.false
            } else {
              expect(data.hitsCachedRoutes).to.be.true
            }
          } catch (err: any) {
            console.log(err) // log to see which assertion in the try block failed
            fail(JSON.stringify(err.response.data))
          }
        })

        it(`has quoteGasAdjusted values`, async () => {
          if (chain === ChainId.SEPOLIA && !erc1.equals(V4_SEPOLIA_TEST_A)) {
            // Sepolia doesn't have sufficient liquidity on DAI pools yet
            return
          }

          // Disable ZORA exactOut tests to unblock pipeline because it doesn't have enough liquidity to calc gas costs.
          if (chain === ChainId.ZORA && type === 'exactOut') {
            return
          }

          // Disable SONEIUM exactOut tests to unblock pipeline because it doesn't have enough liquidity to calc gas costs.
          if (chain === ChainId.SONEIUM && type === 'exactOut') {
            return
          }

          // if it's exactOut and ZORA, don't use V2 because it doesn't have enough liquidity to calc gas costs.
          const protocols = chain === ChainId.ZORA && type === 'exactOut' ? 'v3,v4,mixed' : ALL_PROTOCOLS

          // Current WETH/USDB pool (https://blastscan.io/address/0xf52b4b69123cbcf07798ae8265642793b2e8990c) has low WETH amount
          const amount =
            type === 'exactOut' &&
            (chain === ChainId.BLAST || chain === ChainId.ZKSYNC || chain === ChainId.UNICHAIN_SEPOLIA)
              ? '0.002'
              : '1'

          const quoteReq: QuoteQueryParams = {
            tokenInAddress: erc1.address,
            tokenInChainId: chain,
            tokenOutAddress: erc2.address,
            tokenOutChainId: chain,
            amount: await getAmountFromToken(type, erc1, erc2, amount),
            protocols: protocols,
            type,
          }

          const queryParams = qs.stringify(quoteReq)

          try {
            const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(`${API}?${queryParams}`, {
              headers: HEADERS_2_0,
            })
            const {
              data: { quoteDecimals, quoteGasAdjustedDecimals },
              status,
            } = response

            expect(status).to.equal(200)

            // check for quotes to be gas adjusted
            if (type == 'exactIn') {
              expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals))
            } else {
              expect(parseFloat(quoteGasAdjustedDecimals)).to.be.greaterThanOrEqual(parseFloat(quoteDecimals))
            }

            // if it's exactIn quote, there's a slight chance the first quote request might be cache miss.
            // but this is okay because each test case retries 3 times, so 2nd exactIn quote is def expected to hit cached routes.
            // if it's exactOut quote, we should always hit the cached routes.
            // this is regardless of protocol version.
            // the reason is because exact in quote always runs before exact out
            // along with the native or wrapped native pool token address assertions previously
            // it ensures the cached routes will always cache wrapped native for v2,v3 pool routes
            // and native for v4 pool routes

            if (!(chain === ChainId.ZORA && type === 'exactOut')) {
              expect(response.data.hitsCachedRoutes).to.be.true
            }
          } catch (err: any) {
            fail(JSON.stringify(err.response.data))
          }
        })
      })
    }
  }
})

describe('alpha only quote', function () {
  this.timeout(5000)

  for (const type of ['exactIn', 'exactOut']) {
    describe(`${type} 2xx`, () => {})
  }
})
