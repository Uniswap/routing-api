import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Currency, CurrencyAmount, Ether, Fraction, Token, WETH9 } from '@uniswap/sdk-core'
import { ChainId, ID_TO_NETWORK_NAME, parseAmount } from '@uniswap/smart-order-router'
import { MethodParameters } from '@uniswap/v3-sdk'
import { fail } from 'assert'
import axios, { AxiosResponse } from 'axios'
import chai, { expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiSubset from 'chai-subset'
import { BigNumber, providers } from 'ethers'
import hre from 'hardhat'
import _ from 'lodash'
import qs from 'qs'
import { SUPPORTED_CHAINS } from '../../lib/handlers/injector-sor'
import { QuoteQueryParams } from '../../lib/handlers/quote/schema/quote-schema'
import { QuoteResponse } from '../../lib/handlers/schema'
import { resetAndFundAtBlock } from '../utils/forkAndFund'
import { getBalance, getBalanceAndApprove } from '../utils/getBalanceAndApprove'
import {
  DAI_MAINNET,
  DAI_ON,
  getAmount,
  getAmountFromToken,
  UNI_ARBITRUM_RINKEBY,
  UNI_MAINNET,
  USDC_MAINNET,
  USDC_ON,
  USDT_ARBITRUM_RINKEBY,
  USDT_MAINNET,
  USDT_OPTIMISTIC_KOVAN,
  WBTC_MAINNET,
  WETH_ON,
} from '../utils/tokens'
const { ethers } = hre

chai.use(chaiAsPromised)
chai.use(chaiSubset)

if (!process.env.UNISWAP_ROUTING_API || !process.env.ARCHIVE_NODE_RPC) {
  throw new Error('Must set UNISWAP_ROUTING_API and ARCHIVE_NODE_RPC env variables for integ tests. See README')
}

const API = `${process.env.UNISWAP_ROUTING_API!}quote`

const SLIPPAGE = '5'

const callAndExpectFail = async (quoteReq: Partial<QuoteQueryParams>, resp: { status: number; data: any }) => {
  const queryParams = qs.stringify(quoteReq)
  try {
    await axios.get<QuoteResponse>(`${API}?${queryParams}`)
    fail()
  } catch (err: any) {
    expect(err.response).to.containSubset(resp)
  }
}

const checkQuoteToken = (
  before: CurrencyAmount<Currency>,
  after: CurrencyAmount<Currency>,
  tokensQuoted: CurrencyAmount<Currency>
) => {
  // Check which is bigger to support exactIn and exactOut
  const tokensSwapped = after.greaterThan(before) ? after.subtract(before) : before.subtract(after)

  const tokensDiff = tokensQuoted.greaterThan(tokensSwapped)
    ? tokensQuoted.subtract(tokensSwapped)
    : tokensSwapped.subtract(tokensQuoted)
  const percentDiff = tokensDiff.asFraction.divide(tokensQuoted.asFraction)
  expect(percentDiff.lessThan(new Fraction(parseInt(SLIPPAGE), 100))).to.be.true
}

const SWAP_ROUTER_V2 = '0x075B36dE1Bd11cb361c5B3B1E80A9ab0e7aa8a60'

describe('quote', function () {
  // Help with test flakiness by retrying.
  this.retries(2)

  this.timeout(10000)

  let alice: SignerWithAddress
  let block: number

  const executeSwap = async (
    methodParameters: MethodParameters,
    currencyIn: Currency,
    currencyOut: Currency
  ): Promise<{
    tokenInAfter: CurrencyAmount<Currency>
    tokenInBefore: CurrencyAmount<Currency>
    tokenOutAfter: CurrencyAmount<Currency>
    tokenOutBefore: CurrencyAmount<Currency>
  }> => {
    const tokenInBefore = await getBalanceAndApprove(alice, SWAP_ROUTER_V2, currencyIn)
    const tokenOutBefore = await getBalance(alice, currencyOut)

    const transaction = {
      data: methodParameters.calldata,
      to: SWAP_ROUTER_V2,
      value: BigNumber.from(methodParameters.value),
      from: alice.address,
      gasPrice: BigNumber.from(2000000000000),
      type: 1,
    }

    const transactionResponse: providers.TransactionResponse = await alice.sendTransaction(transaction)

    await transactionResponse.wait()

    const tokenInAfter = await getBalance(alice, currencyIn)
    const tokenOutAfter = await getBalance(alice, currencyOut)

    return {
      tokenInAfter,
      tokenInBefore,
      tokenOutAfter,
      tokenOutBefore,
    }
  }

  before(async function () {
    this.timeout(40000)
    ;[alice] = await ethers.getSigners()

    // Make a dummy call to the API to get a block number to fork from.
    const quoteReq: QuoteQueryParams = {
      tokenInAddress: 'USDC',
      tokenInChainId: 1,
      tokenOutAddress: 'USDT',
      tokenOutChainId: 1,
      amount: await getAmount(1, 'exactIn', 'USDC', 'USDT', '100'),
      type: 'exactIn',
    }

    const {
      data: { blockNumber },
    } = await axios.get<QuoteResponse>(`${API}?${qs.stringify(quoteReq)}`)

    block = parseInt(blockNumber) - 10

    alice = await resetAndFundAtBlock(alice, block, [
      parseAmount('8000000', USDC_MAINNET),
      parseAmount('5000000', USDT_MAINNET),
      parseAmount('10', WBTC_MAINNET),
      parseAmount('1000', UNI_MAINNET),
      parseAmount('4000', WETH9[1]),
      parseAmount('5000000', DAI_MAINNET),
    ])
  })

  for (const algorithm of ['alpha' /* , 'legacy' */]) {
    for (const type of ['exactIn', 'exactOut']) {
      describe(`${ID_TO_NETWORK_NAME(1)} ${algorithm} ${type} 2xx`, () => {
        describe(`+ simulate swap`, () => {
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
            }

            const queryParams = qs.stringify(quoteReq)

            const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(`${API}?${queryParams}`)
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
          })

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
            }

            const queryParams = qs.stringify(quoteReq)

            const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(`${API}?${queryParams}`)
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
            }

            const queryParams = qs.stringify(quoteReq)

            const response = await axios.get<QuoteResponse>(`${API}?${queryParams}`)
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
              slippageTolerance: SLIPPAGE,
              deadline: '360',
              algorithm,
            }

            const queryParams = qs.stringify(quoteReq)

            const response = await axios.get<QuoteResponse>(`${API}?${queryParams}`)
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
            }

            const queryParams = qs.stringify(quoteReq)

            const response = await axios.get<QuoteResponse>(`${API}?${queryParams}`)
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
              expect(tokenOutAfter.subtract(tokenOutBefore).toExact()).to.equal('10000')
              checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(Ether.onChain(1), data.quote))
            }
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
            }

            const queryParams = qs.stringify(quoteReq)

            const response = await axios.get<QuoteResponse>(`${API}?${queryParams}`)
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
            }

            const queryParams = qs.stringify(quoteReq)

            const response = await axios.get<QuoteResponse>(`${API}?${queryParams}`)
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
              }

              const queryParams = qs.stringify(quoteReq)

              const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(`${API}?${queryParams}`)
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
              }

              const queryParams = qs.stringify(quoteReq)

              const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(`${API}?${queryParams}`)
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
              }

              const queryParams = qs.stringify(quoteReq)

              const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(`${API}?${queryParams}`)
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

              let hasV3Pool = false
              let hasV2Pool = false
              for (const r of route) {
                for (const pool of r) {
                  if (pool.type == 'v3-pool') {
                    hasV3Pool = true
                  }
                  if (pool.type == 'v2-pool') {
                    hasV2Pool = true
                  }
                }
              }

              expect(hasV3Pool && hasV2Pool).to.be.true

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
          }
        })

        it(`erc20 -> erc20 no recipient/deadline/slippage`, async () => {
          const quoteReq: QuoteQueryParams = {
            tokenInAddress: 'USDC',
            tokenInChainId: 1,
            tokenOutAddress: 'USDT',
            tokenOutChainId: 1,
            amount: await getAmount(1, type, 'USDC', 'USDT', '100'),
            type,
            algorithm,
          }

          const queryParams = qs.stringify(quoteReq)

          const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(`${API}?${queryParams}`)
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
          }

          const queryParams = qs.stringify(quoteReq)

          const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(`${API}?${queryParams}`)
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
          }

          const queryParams = qs.stringify(quoteReq)

          const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(`${API}?${queryParams}`)

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
          }

          const queryParams = qs.stringify(quoteReq)

          const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(`${API}?${queryParams}`)
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
          }

          await callAndExpectFail(quoteReq, {
            status: 400,
            data: {
              detail: '"amount" with value "-10000000000" fails to match the required pattern: /^[0-9]+$/',
              errorCode: 'VALIDATION_ERROR',
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
          }
          await callAndExpectFail(quoteReq, {
            status: 400,
            data: {
              detail: 'tokenIn and tokenOut must be different',
              errorCode: 'TOKEN_IN_OUT_SAME',
            },
          })
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
          }
          await callAndExpectFail(quoteReq, {
            status: 400,
            data: {
              detail: '"value" contains [slippageTolerance, deadline] without its required peers [recipient]',
              errorCode: 'VALIDATION_ERROR',
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
          }

          await callAndExpectFail(quoteReq, {
            status: 400,
            data: {
              detail: '"tokenInChainId" must be one of [1, 4, 3, 42, 10, 69, 42161, 421611]',
              errorCode: 'VALIDATION_ERROR',
            },
          })
        })
      })
    }
  }

  const TEST_ERC20_1: { [chainId in ChainId]: Token } = {
    [ChainId.MAINNET]: USDC_ON(1),
    [ChainId.ROPSTEN]: USDC_ON(ChainId.ROPSTEN),
    [ChainId.RINKEBY]: USDC_ON(ChainId.RINKEBY),
    [ChainId.GÖRLI]: USDC_ON(ChainId.GÖRLI),
    [ChainId.KOVAN]: USDC_ON(ChainId.KOVAN),
    [ChainId.OPTIMISM]: USDC_ON(ChainId.OPTIMISM),
    [ChainId.OPTIMISTIC_KOVAN]: DAI_ON(ChainId.OPTIMISTIC_KOVAN),
    [ChainId.ARBITRUM_ONE]: USDC_ON(ChainId.ARBITRUM_ONE),
    [ChainId.ARBITRUM_RINKEBY]: UNI_ARBITRUM_RINKEBY,
  }

  const TEST_ERC20_2: { [chainId in ChainId]: Token } = {
    [ChainId.MAINNET]: DAI_ON(1),
    [ChainId.ROPSTEN]: DAI_ON(ChainId.ROPSTEN),
    [ChainId.RINKEBY]: DAI_ON(ChainId.RINKEBY),
    [ChainId.GÖRLI]: DAI_ON(ChainId.GÖRLI),
    [ChainId.KOVAN]: DAI_ON(ChainId.KOVAN),
    [ChainId.OPTIMISM]: DAI_ON(ChainId.OPTIMISM),
    [ChainId.OPTIMISTIC_KOVAN]: USDT_OPTIMISTIC_KOVAN,
    [ChainId.ARBITRUM_ONE]: DAI_ON(ChainId.ARBITRUM_ONE),
    [ChainId.ARBITRUM_RINKEBY]: USDT_ARBITRUM_RINKEBY,
  }

  for (const chain of SUPPORTED_CHAINS) {
    for (const type of ['exactIn', 'exactOut']) {
      const erc1 = TEST_ERC20_1[chain]
      const erc2 = TEST_ERC20_2[chain]

      describe(`${ID_TO_NETWORK_NAME(chain)} ${type} 2xx`, function () {
        // Help with test flakiness by retrying.
        this.retries(2)
        this.timeout(15000)

        it(`weth -> erc20`, async () => {
          const quoteReq: QuoteQueryParams = {
            tokenInAddress: WETH_ON(chain).address,
            tokenInChainId: chain,
            tokenOutAddress: erc1.address,
            tokenOutChainId: chain,
            amount: await getAmountFromToken(type, WETH_ON(chain), erc1, '10'),
            type,
          }

          const queryParams = qs.stringify(quoteReq)

          const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(`${API}?${queryParams}`)
          const { status } = response

          expect(status).to.equal(200)
        })

        it(`erc20 -> erc20`, async () => {
          const quoteReq: QuoteQueryParams = {
            tokenInAddress: erc1.address,
            tokenInChainId: chain,
            tokenOutAddress: erc2.address,
            tokenOutChainId: chain,
            amount: await getAmountFromToken(type, erc1, erc2, '1'),
            type,
          }

          const queryParams = qs.stringify(quoteReq)

          const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(`${API}?${queryParams}`)
          const { status } = response

          expect(status).to.equal(200)
        })

        it(`eth -> erc20`, async () => {
          const quoteReq: QuoteQueryParams = {
            tokenInAddress: 'ETH',
            tokenInChainId: chain,
            tokenOutAddress: erc2.address,
            tokenOutChainId: chain,
            amount: await getAmountFromToken(type, WETH_ON(chain), erc2, '10'),
            type,
          }

          const queryParams = qs.stringify(quoteReq)

          const response: AxiosResponse<QuoteResponse> = await axios.get<QuoteResponse>(`${API}?${queryParams}`)
          const { status } = response

          expect(status).to.equal(200)
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
