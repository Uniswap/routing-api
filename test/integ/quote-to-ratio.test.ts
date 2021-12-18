import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import DEFAULT_TOKEN_LIST from '@uniswap/default-token-list'
import { Currency, CurrencyAmount, Ether, Fraction, WETH9 } from '@uniswap/sdk-core'
import { MethodParameters, Pool, Position } from '@uniswap/v3-sdk'
import { fail } from 'assert'
import axios, { AxiosResponse } from 'axios'
import chai, { expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiSubset from 'chai-subset'
import { BigNumber, providers } from 'ethers'
import { parseUnits } from 'ethers/lib/utils'
import hre from 'hardhat'
import JSBI from 'jsbi'
import NodeCache from 'node-cache'
import qs from 'qs'
import {
  QuoteToRatioQueryParams,
  QuoteToRatioResponse,
  ResponseFraction,
} from '../../lib/handlers/quote-to-ratio/schema/quote-to-ratio-schema'
import { absoluteValue } from '../utils/absoluteValue'
import { getTokenListProvider } from '../utils/tokens'
import { resetAndFundAtBlock } from '../utils/forkAndFund'
import { parseEvents, getTestParamsFromEvents } from '../utils/parseEvents'
import { getBalance, getBalanceAndApprove, getBalanceOfAddress } from '../utils/getBalanceAndApprove'
import { FeeAmount, getMaxTick, getMinTick, TICK_SPACINGS } from '../utils/ticks'
import {
  CachingTokenListProvider, NodeJSCache, ChainId,
  DAI_MAINNET,
  ID_TO_NETWORK_NAME,
  parseAmount,
  USDC_MAINNET,
  USDT_MAINNET,
  WBTC_MAINNET,
} from '@uniswap/smart-order-router'
import { parseSlippageTolerance } from '../../lib/handlers/shared'

const { ethers } = hre

chai.use(chaiAsPromised)
chai.use(chaiSubset)

const tokenListProvider = getTokenListProvider(1)

const API = `${process.env.UNISWAP_ROUTING_API!}quoteToRatio`

const callAndExpectFail = async (quoteReq: Partial<QuoteToRatioQueryParams>, resp: { status: number; data: any }) => {
  const queryParams = qs.stringify(quoteReq)
  try {
    await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`)
    fail()
  } catch (err: any) {
    expect(err.response).to.containSubset(resp)
  }
}

// Try to parse a user entered amount for a given token
async function parseAmountUsingAddress(value: number, tokenAddress: string): Promise<string> {
  const decimals = (await tokenStringToCurrency(tokenAddress))?.decimals
  // console.log('tokenStringToCurr: ', await tokenStringToCurrency(tokenAddress))
  return parseUnits(value.toString(), decimals).toString()
}

async function tokenStringToCurrency(tokenString: string): Promise<Currency | undefined> {
  const isAddress = (s: string) => s.length == 42 && s.startsWith('0x')

  let token: Currency | undefined
  if (tokenString == 'ETH' || tokenString.toLowerCase() == '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
    token = Ether.onChain(1)
  } else if (isAddress(tokenString)) {
    token = await tokenListProvider.getTokenByAddress(tokenString)
  }

  if (!token) {
    token = await tokenListProvider.getTokenBySymbol(tokenString)
  }

  if (!token) {
    throw new Error('could not find token')
  }

  return token
}

function parseFraction(fraction: ResponseFraction): Fraction {
  return new Fraction(JSBI.BigInt(fraction.numerator), JSBI.BigInt(fraction.denominator))
}

const SWAP_ROUTER_V2 = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45'

describe.only('quote-to-ratio', function () {
  // Help with test flakiness by retrying.
  this.retries(2)

  this.timeout(10000)

  // chain parameters
  let alice: SignerWithAddress
  let block: number

  // request parameters
  let token0Address: string
  let token1Address: string
  let token0Balance: CurrencyAmount<Currency>
  let token1Balance: CurrencyAmount<Currency>
  let tickUpper: number
  let tickLower: number
  let feeAmount: number
  let slippageTolerance: string
  let ratioErrorTolerance: number
  let ratioErrorToleranceFraction: Fraction

  function resetQueryParams() {
    token0Address = 'USDC'
    token1Address = 'USDT'
    token0Balance = parseAmount('5000', USDC_MAINNET)
    token1Balance = parseAmount('2000', USDT_MAINNET)
    tickLower =  getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM])
    tickUpper =  getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM])
    feeAmount = FeeAmount.MEDIUM
    slippageTolerance = '5'
    ratioErrorTolerance = 1
    ratioErrorToleranceFraction = new Fraction(ratioErrorTolerance * 100, 10_000)
  }

  let response: AxiosResponse<QuoteToRatioResponse>

  const executeSwap = async (
    pool: string,
    methodParameters: MethodParameters,
    currencyIn: Currency,
    currencyOut: Currency,
    approveCurrentOut?: boolean
  ): Promise<{
    token0AfterAlice: CurrencyAmount<Currency>
    token0BeforeAlice: CurrencyAmount<Currency>
    token1AfterAlice: CurrencyAmount<Currency>
    token1BeforeAlice: CurrencyAmount<Currency>
    token0AfterPool: CurrencyAmount<Currency>
    token0BeforePool: CurrencyAmount<Currency>
    token1AfterPool: CurrencyAmount<Currency>
    token1BeforePool: CurrencyAmount<Currency>
    swapRouterFinalBalance0: CurrencyAmount<Currency>
    swapRouterFinalBalance1: CurrencyAmount<Currency>
    events: any[]
  }> => {
    let currency0, currency1: Currency
    currencyIn.wrapped.sortsBefore(currencyOut.wrapped)
      ? [currency0, currency1] = [currencyIn, currencyOut]
      : [currency0, currency1] = [currencyOut, currencyIn]

    const token0BeforeAlice = await getBalanceAndApprove(alice, SWAP_ROUTER_V2, currency0)

    let token1BeforeAlice
    if (approveCurrentOut) {
      token1BeforeAlice = await getBalanceAndApprove(alice, SWAP_ROUTER_V2, currency1)
    } else {
      token1BeforeAlice = await getBalance(alice, currency1)
    }

    const token0BeforePool = await getBalanceOfAddress(alice, pool, currency0)
    const token1BeforePool = await getBalanceOfAddress(alice, pool, currency1)

    const transaction = {
      data: methodParameters.calldata,
      to: SWAP_ROUTER_V2,
      value: BigNumber.from(methodParameters.value),
      from: alice.address,
      gasPrice: BigNumber.from(2000000000000),
      type: 1,
    }

    const transactionResponse: providers.TransactionResponse = await alice.sendTransaction(transaction)
    const txReceipt = await transactionResponse.wait()

    const events = parseEvents(txReceipt)

    const token0AfterPool = await getBalanceOfAddress(alice, pool, currency0)
    const token1AfterPool = await getBalanceOfAddress(alice, pool, currency1)
    const token0AfterAlice = await getBalance(alice, currency0)
    const token1AfterAlice = await getBalance(alice, currency1)
    const swapRouterFinalBalance0 = await getBalanceOfAddress(alice, SWAP_ROUTER_V2, currency0)
    const swapRouterFinalBalance1 = await getBalanceOfAddress(alice, SWAP_ROUTER_V2, currency1)

    return {
      token0AfterAlice,
      token0BeforeAlice,
      token1AfterAlice,
      token1BeforeAlice,
      token0AfterPool,
      token0BeforePool,
      token1AfterPool,
      token1BeforePool,
      swapRouterFinalBalance0,
      swapRouterFinalBalance1,
      events,
    }
  }

  before('generate blockchain fork', async function () {
    this.timeout(40000)
    ;[alice] = await ethers.getSigners()

    // define query parameters
    resetQueryParams()

    // Make a dummy call to the API to get a block number to fork from.
    const quoteToRatioRec: QuoteToRatioQueryParams = {
      token0Address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      token0ChainId: 1,
      token1Address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      token1ChainId: 1,
      token0Balance: token0Balance.quotient.toString(),
      token1Balance: token1Balance.quotient.toString(),
      tickLower: -60,
      tickUpper: 60,
      feeAmount: 500,
      recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      slippageTolerance,
      deadline: '360',
      ratioErrorTolerance: 1,
      maxIterations: 6,
      addLiquiditySlippageTolerance: '5',
      addLiquidityDeadline: '360',
      addLiquidityRecipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
    }

    const queryParams = qs.stringify(quoteToRatioRec)
    const response: AxiosResponse<QuoteToRatioResponse> = await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`)
    const {
      data: { blockNumber },
    } = response

    block = parseInt(blockNumber) - 10

    alice = await resetAndFundAtBlock(alice, block, [
      parseAmount('5000000', USDC_MAINNET),
      parseAmount('5000000', USDT_MAINNET),
      parseAmount('10', WBTC_MAINNET),
      // parseAmount('1000', UNI_MAINNET),
      parseAmount('1000', WETH9[1]),
      parseAmount('5000000', DAI_MAINNET),
    ])
  })

  describe('erc20 -> erc20 high volume trade token0Excess', () => {
    after(() => {
      resetQueryParams()
    })

    before(async () => {
      token0Address = 'DAI'
      token1Address = 'USDC'
      token0Balance = parseAmount('1000000', DAI_MAINNET)
      token1Balance = parseAmount('2000', USDC_MAINNET)
      slippageTolerance = '0.05'

      const quoteToRatioRec: QuoteToRatioQueryParams = {
        token0Address,
        token0ChainId: 1,
        token1Address,
        token1ChainId: 1,
        token0Balance: token0Balance.quotient.toString(),
        token1Balance: token1Balance.quotient.toString(),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        feeAmount: 3000,
        recipient: alice.address,
        slippageTolerance,
        deadline: '360',
        ratioErrorTolerance,
        maxIterations: 6,
        addLiquiditySlippageTolerance: '5',
        addLiquidityDeadline: '360',
        addLiquidityRecipient: alice.address,
      }

      const queryParams = qs.stringify(quoteToRatioRec)
      response = await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`)
    })

    it('generates a legitimate trade with routing-api', async () => {
      const {
        data: {
          tokenInAddress,
          tokenOutAddress,
          newRatioFraction,
          optimalRatioFraction,
        },
        status,
      } = response

      const newRatio = parseFraction(newRatioFraction)
      const optimalRatio = parseFraction(optimalRatioFraction)
      const ratioDeviation = absoluteValue(new Fraction(1, 1).subtract(newRatio.divide(optimalRatio)))

      expect(status).to.equal(200)
      expect(ratioDeviation.lessThan(ratioErrorToleranceFraction)).to.be.true
      expect(tokenInAddress.toLowerCase()).to.equal(DAI_MAINNET.address.toLowerCase())
      expect(tokenOutAddress.toLowerCase()).to.equal(USDC_MAINNET.address.toLowerCase())
    })

    it.only('executes at the contract level', async () => {
      // testSuccessfulContractExecution(response)

      const {
        data: {
          amount,
          quote,
          methodParameters,
          postSwapTargetPool,
          token0BalanceUpdated,
          token1BalanceUpdated,
        },
      } = response


      const postSwapPool = new Pool(
        USDC_MAINNET,
        DAI_MAINNET,
        feeAmount,
        postSwapTargetPool.sqrtRatioX96,
        postSwapTargetPool.liquidity,
        parseInt(postSwapTargetPool.tickCurrent),
      )

      const {
        token0BeforeAlice,
        token0AfterAlice,
        token1BeforeAlice,
        token1AfterAlice,
        token0BeforePool,
        token0AfterPool,
        token1BeforePool,
        token1AfterPool,
        swapRouterFinalBalance0,
        swapRouterFinalBalance1,
        events,
      } = await executeSwap(postSwapTargetPool.address, methodParameters!, USDC_MAINNET, DAI_MAINNET, true)

      const {
        // total amounts transferred from alice. including amounts transferred back as a result of dust
        amount0TransferredFromAlice,
        amount1TransferredFromAlice,
        onChainPosition
      } = getTestParamsFromEvents(events, DAI_MAINNET, USDC_MAINNET, alice.address)

      // alice's balance differences after entire completed transaction
      const amount0DiffAlice = token0BeforeAlice.subtract(token0AfterAlice)
      const amount1DiffAlice = token1BeforeAlice.subtract(token1AfterAlice)

      const currencyInSwapped = CurrencyAmount.fromRawAmount(DAI_MAINNET, JSBI.BigInt(amount))
      const currencyOutQuote = CurrencyAmount.fromRawAmount(USDC_MAINNET, JSBI.BigInt(quote))

      const newPoolBalance0 = token0AfterPool.subtract(token0BeforePool)
      const newPoolBalance1 = token1AfterPool.subtract(token1BeforePool)

      const mintedPositionQuoted = Position.fromAmounts({
        pool: postSwapPool,
        tickLower,
        tickUpper,
        amount0: token0BalanceUpdated,
        amount1: token1BalanceUpdated,
        useFullPrecision: true,
      })

      const {
        amount0: minPositionAmount0,
        amount1: minPositionAmount1
      } = mintedPositionQuoted.mintAmountsWithSlippage(parseSlippageTolerance(slippageTolerance))


      // make sure we never transfer more than the user-stated available balance
      expect(!amount1TransferredFromAlice.greaterThan(token1Balance)).to.be.true
      expect(!amount0TransferredFromAlice.greaterThan(token0Balance)).to.be.true

      // make sure router has no funds left
      expect(swapRouterFinalBalance0.quotient.toString()).to.equal('0')
      expect(swapRouterFinalBalance1.quotient.toString()).to.equal('0')

      // total amountIn pulled but not swapped now lives in the position
      expect(amount0DiffAlice.subtract(currencyInSwapped).quotient.toString()).to.equal(newPoolBalance0.quotient.toString())

      // check position details
      expect(onChainPosition.amount0.quotient.toString()).to.equal(newPoolBalance0.quotient.toString())
      expect(onChainPosition.amount1.quotient.toString()).to.equal(newPoolBalance1.quotient.toString())
      // check only for newly minted positions
      expect(onChainPosition.owner).to.equal(alice.address)
      expect(onChainPosition.tickLower).to.equal(tickLower)
      expect(onChainPosition.tickUpper).to.equal(tickUpper)

      // check slippage tolerance was not hit
      expect(onChainPosition.amount0.greaterThan(minPositionAmount0)).to.be.true
      expect(onChainPosition.amount1.greaterThan(minPositionAmount1)).to.be.true

      //////////////// CONSOLE LOGS /////////////////////////////////////////////////////////////////////////////////////////////////////////

      // console.log('\n')
      // // console.log('amount1 IncreaseLiquidity', increaseLiquidityEvent[0].args.amount1.toString())
      //
      // console.log('amount0Transferred from user:', amount0TransferredFromAlice.toFixed(6))
      // console.log('amount1Transferred from user:', amount1TransferredFromAlice.toFixed(6))
      // // console.log('position amount from user:   ', newPoolBalance1.subtract(currencyOutQuote).toFixed(6))
      // console.log('amount0 input to swap:       ', currencyInSwapped.toFixed(6))
      // console.log('amount1 quoted from swap:    ', currencyOutQuote.toFixed(6))
      // console.log('pool Balance 0:              ', newPoolBalance0.toFixed(6))
      // console.log('pool Balance 1:              ', newPoolBalance1.toFixed(6))
      // console.log('position amount0 quoted:     ', amount0MintedQuoted.toFixed(6))
      // console.log('position amount1 quoted:     ', amount1MintedQuoted.toFixed(6))
      // console.log('position amount1 diff:       ', amount1MintedQuoted.subtract(newPoolBalance1).toFixed(6))
      //
      // console.log('Swap router:')
      // console.log(swapRouterFinalBalance0.toFixed(6))
      // console.log(swapRouterFinalBalance1.toFixed(6))
      // console.log('\n')
      // console.log('token0BalanceUpdated', token0BalanceUpdated)
      // console.log('token1BalanceUpdated', token1BalanceUpdated)

      //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

      // pool position and balance match up with expectations
      // expect(amount1MintedQuoted.quotient.toString()).to.equal(newPoolBalance1.asFraction.subtract(1).quotient.toString())
      // expect(amount0MintedQuoted.quotient.toString()).to.equal(newPoolBalance0.asFraction.subtract(1).quotient.toString())

      // all tokens transferred from alice are now in the Pool
      // expect(amount0TransferredFromAlice.quotient.toString()).to.equal(newPoolBalance0.quotient.toString())
      // expect(amount1TransferredFromAlice.quotient.toString()).to.equal(newPoolBalance1.quotient.toString())
    })
  })

  describe('erc20 -> erc20 low volume trade token0Excess', () => {
    after(() => {
      resetQueryParams()
    })

    before(async () => {
      tickLower = -60
      tickUpper = 60
      feeAmount = 500

      const quoteToRatioRec: QuoteToRatioQueryParams = {
        token0Address,
        token0ChainId: 1,
        token1Address,
        token1ChainId: 1,
        token0Balance: token0Balance.quotient.toString(),
        token1Balance: token1Balance.quotient.toString(),
        tickLower,
        tickUpper,
        feeAmount,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        ratioErrorTolerance,
        maxIterations: 6,
        addLiquiditySlippageTolerance: slippageTolerance,
        addLiquidityDeadline: '360',
        addLiquidityRecipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      }

      const queryParams = qs.stringify(quoteToRatioRec)
      response = await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`)
    })


    it('generates a legitimate trade with routing-api', async () => {
      const {
        data: {
          tokenInAddress,
          tokenOutAddress,
          newRatioFraction,
          optimalRatioFraction,
        },
        status,
      } = response
      const newRatio = parseFraction(newRatioFraction)
      const optimalRatio = parseFraction(optimalRatioFraction)
      const ratioDeviation = absoluteValue(new Fraction(1, 1).subtract(newRatio.divide(optimalRatio)))

      expect(status).to.equal(200)
      expect(ratioDeviation.lessThan(ratioErrorToleranceFraction)).to.be.true
      expect(tokenInAddress.toLowerCase()).to.equal(USDC_MAINNET.address.toLowerCase())
      expect(tokenOutAddress.toLowerCase()).to.equal(USDT_MAINNET.address.toLowerCase())
    })

    it('successfully executes at the contract level', async () => {
      const {
        data: {
          amount,
          methodParameters,
          postSwapTargetPool,
          token0BalanceUpdated,
          token1BalanceUpdated,
        },
      } = response

      const postSwapPool = new Pool(
        USDC_MAINNET,
        USDT_MAINNET,
        feeAmount,
        postSwapTargetPool.sqrtRatioX96,
        postSwapTargetPool.liquidity,
        parseInt(postSwapTargetPool.tickCurrent),
      )

      const newPosition = Position.fromAmounts({
        pool: postSwapPool,
        tickLower,
        tickUpper,
        amount0: token0BalanceUpdated,
        amount1: token1BalanceUpdated,
        useFullPrecision: false,
      })

      const {
        token0BeforeAlice,
        token0AfterAlice,
        token1BeforeAlice,
        token1AfterAlice,
        token0BeforePool,
        token0AfterPool,
        token1BeforePool,
        token1AfterPool,
      } = await executeSwap(
        postSwapTargetPool.address,
        methodParameters!,
        USDC_MAINNET,
        USDT_MAINNET,
        true
      )
      // console.log('hi')
      // console.log(token0BeforeAlice.subtract(TokenInAfterAlice).toExact())

    })
  })
//
//   it('erc20 -> erc20 low volume trade token1Excess', async () => {
//     token0Balance = await parseAmountUsingAddress(2_000, token0Address)
//     token1Balance = await parseAmountUsingAddress(5_000, token1Address)
//     const quoteToRatioRec: QuoteToRatioQueryParams = {
//       token0Address,
//       token0ChainId: 1,
//       token1Address,
//       token1ChainId: 1,
//       token0Balance,
//       token1Balance,
//       tickLower: -180,
//       tickUpper: 180,
//       feeAmount: 500,
//       recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
//       slippageTolerance: '1',
//       deadline: '360',
//       ratioErrorTolerance,
//       maxIterations: 6,
//       addLiquiditySlippageTolerance: '1',
//       addLiquidityDeadline: '360',
//       addLiquidityRecipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
//     }
//
//     const queryParams = qs.stringify(quoteToRatioRec)
//     const response: AxiosResponse<QuoteToRatioResponse> = await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`)
//     const {
//       data: {
//         tokenInAddress,
//         tokenOutAddress,
//         newRatioFraction,
//         optimalRatioFraction,
//         methodParameters,
//         postSwapTargetPool,
//       },
//       status,
//     } = response
//
//     const newRatio = parseFraction(newRatioFraction)
//     const optimalRatio = parseFraction(optimalRatioFraction)
//     const ratioDeviation = absoluteValue(new Fraction(1, 1).subtract(newRatio.divide(optimalRatio)))
//
//     expect(status).to.equal(200)
//     expect(ratioDeviation.lessThan(ratioErrorToleranceFraction)).to.be.true
//     expect(tokenInAddress.toLowerCase()).to.equal(token1Address.toLowerCase())
//     expect(tokenOutAddress.toLowerCase()).to.equal(token0Address.toLowerCase())
//
//     const {
//       token0BeforeAlice,
//       token0AfterAlice,
//       token1BeforeAlice,
//       token1AfterAlice,
//       token0BeforePool,
//       token0AfterPool,
//       token1BeforePool,
//       token1AfterPool,
//     } = await executeSwap(
//       postSwapTargetPool.address,
//       methodParameters!,
//       USDC_MAINNET,
//       USDT_MAINNET,
//       true
//     )
//   })
//
//   it('erc20 -> erc20 high volume trade token1Excess', async () => {
//     token0Balance = await parseAmountUsingAddress(2_000, token0Address)
//     token1Balance = await parseAmountUsingAddress(100_000_000, token1Address)
//     const quoteToRatioRec: QuoteToRatioQueryParams = {
//       token0Address,
//       token0ChainId: 1,
//       token1Address,
//       token1ChainId: 1,
//       token0Balance,
//       token1Balance,
//       tickLower: -200,
//       tickUpper: 200,
//       feeAmount: 10000,
//       recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
//       slippageTolerance: '5',
//       deadline: '360',
//       ratioErrorTolerance,
//       maxIterations: 6,
//       addLiquiditySlippageTolerance: '5',
//       addLiquidityDeadline: '360',
//       addLiquidityRecipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
//     }
//
//     const queryParams = qs.stringify(quoteToRatioRec)
//     const response: AxiosResponse<QuoteToRatioResponse> = await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`)
//     const {
//       data: { tokenInAddress, tokenOutAddress, newRatioFraction, optimalRatioFraction },
//       status,
//     } = response
//
//     const newRatio = parseFraction(newRatioFraction)
//     const optimalRatio = parseFraction(optimalRatioFraction)
//     const ratioDeviation = absoluteValue(new Fraction(1, 1).subtract(newRatio.divide(optimalRatio)))
//
//     expect(status).to.equal(200)
//     expect(ratioDeviation.lessThan(ratioErrorToleranceFraction)).to.be.true
//     expect(tokenInAddress.toLowerCase()).to.equal(token1Address.toLowerCase())
//     expect(tokenOutAddress.toLowerCase()).to.equal(token0Address.toLowerCase())
//   })
//
//   it('erc20 -> erc20 range order position token1 excess', async () => {
//     token0Balance = await parseAmountUsingAddress(50_000, token0Address)
//     token1Balance = await parseAmountUsingAddress(2_000, token1Address)
//     const quoteToRatioRec: QuoteToRatioQueryParams = {
//       token0Address,
//       token0ChainId: 1,
//       token1Address,
//       token1ChainId: 1,
//       token0Balance,
//       token1Balance,
//       tickLower: 100_000,
//       tickUpper: 200_000,
//       feeAmount: 500,
//       recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
//       slippageTolerance: '5',
//       deadline: '360',
//       ratioErrorTolerance,
//       maxIterations: 6,
//       addLiquiditySlippageTolerance: '5',
//       addLiquidityDeadline: '360',
//       addLiquidityRecipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
//     }
//
//     const queryParams = qs.stringify(quoteToRatioRec)
//     const response: AxiosResponse<QuoteToRatioResponse> = await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`)
//     const {
//       data: { amount, newRatioFraction, optimalRatioFraction },
//       status,
//     } = response
//
//     const newRatio = parseFraction(newRatioFraction)
//     const optimalRatio = parseFraction(optimalRatioFraction)
//     const ratioDeviation = absoluteValue(new Fraction(1, 1).subtract(newRatio.divide(optimalRatio)))
//
//     expect(status).to.equal(200)
//     expect(!ratioDeviation.greaterThan(ratioErrorToleranceFraction)).to.be.true
//     expect(amount).to.equal(token1Balance)
//   })
//
//   it('erc20 -> erc20 range order position token0 excess', async () => {
//     token0Balance = await parseAmountUsingAddress(50_000, token0Address)
//     token1Balance = await parseAmountUsingAddress(2_000, token1Address)
//     const quoteToRatioRec: QuoteToRatioQueryParams = {
//       token0Address,
//       token0ChainId: 1,
//       token1Address,
//       token1ChainId: 1,
//       token0Balance,
//       token1Balance,
//       tickLower: -200_000,
//       tickUpper: -100_000,
//       feeAmount: 500,
//       recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
//       slippageTolerance: '5',
//       deadline: '360',
//       ratioErrorTolerance,
//       maxIterations: 6,
//       addLiquiditySlippageTolerance: '5',
//       addLiquidityDeadline: '360',
//       addLiquidityRecipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
//     }
//
//     const queryParams = qs.stringify(quoteToRatioRec)
//     const response: AxiosResponse<QuoteToRatioResponse> = await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`)
//     const {
//       data: { amount, newRatioFraction, optimalRatioFraction },
//       status,
//     } = response
//
//     const newRatio = parseFraction(newRatioFraction)
//     const optimalRatio = parseFraction(optimalRatioFraction)
//     const ratioDeviation = absoluteValue(new Fraction(1, 1).subtract(newRatio.divide(optimalRatio)))
//
//     expect(status).to.equal(200)
//     expect(ratioDeviation.equalTo(new Fraction(0, 0))).to.be.true
//     expect(amount).to.equal(token0Balance)
//   })
//
//   it('weth -> erc20', async () => {
//     token0Address = 'DAI'
//     token1Address = 'ETH'
//     token0Balance = await parseAmountUsingAddress(2_000, token0Address)
//     token1Balance = await parseAmountUsingAddress(5_000, token1Address)
//     const quoteToRatioRec: QuoteToRatioQueryParams = {
//       token0Address,
//       token0ChainId: 1,
//       token1Address,
//       token1ChainId: 1,
//       token0Balance,
//       token1Balance,
//       tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
//       tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
//       feeAmount: FeeAmount.MEDIUM,
//       recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
//       slippageTolerance: '5',
//       deadline: '360',
//       ratioErrorTolerance,
//       maxIterations: 6,
//       addLiquiditySlippageTolerance: '5',
//       addLiquidityDeadline: '360',
//       addLiquidityRecipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
//     }
//
//     const queryParams = qs.stringify(quoteToRatioRec)
//     const response: AxiosResponse<QuoteToRatioResponse> = await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`)
//     const {
//       data: { newRatioFraction, optimalRatioFraction },
//       status,
//     } = response
//
//     const newRatio = parseFraction(newRatioFraction)
//     const optimalRatio = parseFraction(optimalRatioFraction)
//     const ratioDeviation = absoluteValue(new Fraction(1, 1).subtract(newRatio.divide(optimalRatio)))
//
//     expect(status).to.equal(200)
//     expect(!ratioDeviation.greaterThan(ratioErrorToleranceFraction)).to.be.true
//   })
//
//   // TODO: should be ERC20 -> ETH...residual ETH to WETH9
//   it('erc20 -> eth', async () => {
//     token0Address = 'DAI' //0x6b175474e89094c44da98b954eedeac495271d0f
//     token1Address = 'ETH' //0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2
//     token0Balance = await parseAmountUsingAddress(20_000, token0Address)
//     token1Balance = await parseAmountUsingAddress(0, token1Address)
//     const quoteToRatioRec: QuoteToRatioQueryParams = {
//       token0Address,
//       token0ChainId: 1,
//       token1Address,
//       token1ChainId: 1,
//       token0Balance,
//       token1Balance,
//       tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
//       tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
//       feeAmount: FeeAmount.MEDIUM,
//       recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
//       slippageTolerance: '5',
//       deadline: '360',
//       ratioErrorTolerance,
//       maxIterations: 6,
//       addLiquiditySlippageTolerance: '5',
//       addLiquidityDeadline: '360',
//       addLiquidityRecipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
//     }
//
//     console.log('20_000: ', await parseAmountUsingAddress(20_000, token0Address))
//     console.log('0: ', await parseAmountUsingAddress(0, token1Address))
//     const queryParams = qs.stringify(quoteToRatioRec)
//     const response: AxiosResponse<QuoteToRatioResponse> = await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`)
//     const {
//       data: { newRatioFraction, optimalRatioFraction },
//       status,
//     } = response
//
//     const newRatio = parseFraction(newRatioFraction)
//     const optimalRatio = parseFraction(optimalRatioFraction)
//     const ratioDeviation = absoluteValue(new Fraction(1, 1).subtract(newRatio.divide(optimalRatio)))
//     console.log(response.data)
//     expect(status).to.equal(200)
//     expect(!ratioDeviation.greaterThan(ratioErrorToleranceFraction)).to.be.true
//   })
//
//   it('singleAssetAdd token0Excess')
//
//   it('singleAssetAdd token1Excess')
//
//   it('mints a new position')
//
//   it('adds liquidity to an existing position')
//
//   it('')
//
//   describe('4xx Error response', () => {
//     it('when both balances are 0', async () => {
//       token0Address = 'DAI'
//       token1Address = 'WETH'
//       token0Balance = await parseAmountUsingAddress(0, token0Address)
//       token1Balance = await parseAmountUsingAddress(0, token1Address)
//       const quoteToRatioRec: QuoteToRatioQueryParams = {
//         token0Address,
//         token0ChainId: 1,
//         token1Address,
//         token1ChainId: 1,
//         token0Balance,
//         token1Balance,
//         tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
//         tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
//         feeAmount: FeeAmount.MEDIUM,
//         recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
//         slippageTolerance: '5',
//         deadline: '360',
//         ratioErrorTolerance,
//         maxIterations: 6,
//         addLiquiditySlippageTolerance: '5',
//         addLiquidityDeadline: '360',
//         addLiquidityRecipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
//       }
//
//       await callAndExpectFail(quoteToRatioRec, {
//         status: 400,
//         data: {
//           detail: 'No swap needed',
//           errorCode: 'NO_SWAP_NEEDED',
//         },
//       })
//     })
//
//     it('when max iterations is 0', async () => {
//       token0Address = 'WETH'
//       token1Address = 'DAI'
//       token0Balance = await parseAmountUsingAddress(50_000, token0Address)
//       token1Balance = await parseAmountUsingAddress(2_000, token1Address)
//       const quoteToRatioRec: QuoteToRatioQueryParams = {
//         token0Address,
//         token0ChainId: 1,
//         token1Address,
//         token1ChainId: 1,
//         token0Balance,
//         token1Balance,
//         tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
//         tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
//         feeAmount: FeeAmount.MEDIUM,
//         recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
//         slippageTolerance: '5',
//         deadline: '360',
//         ratioErrorTolerance,
//         maxIterations: 0,
//         addLiquiditySlippageTolerance: '5',
//         addLiquidityDeadline: '360',
//         addLiquidityRecipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
//       }
//
//       await callAndExpectFail(quoteToRatioRec, {
//         status: 400,
//         data: {
//           detail: '"maxIterations" must be larger than or equal to 1',
//           errorCode: 'VALIDATION_ERROR',
//         },
//       })
//     })
//
//     it('when ratio is already fulfilled with token1', async () => {
//       token0Balance = await parseAmountUsingAddress(0, token0Address)
//       token1Balance = await parseAmountUsingAddress(5_000, token1Address)
//       const quoteToRatioRec: QuoteToRatioQueryParams = {
//         token0Address,
//         token0ChainId: 1,
//         token1Address,
//         token1ChainId: 1,
//         token0Balance,
//         token1Balance,
//         tickLower: -120,
//         tickUpper: -60,
//         feeAmount: 500,
//         recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
//         slippageTolerance: '5',
//         deadline: '360',
//         ratioErrorTolerance,
//         maxIterations: 6,
//         addLiquiditySlippageTolerance: '5',
//         addLiquidityDeadline: '360',
//         addLiquidityRecipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
//       }
//
//       await callAndExpectFail(quoteToRatioRec, {
//         status: 400,
//         data: {
//           detail: 'No swap needed for range order',
//           errorCode: 'NO_SWAP_NEEDED',
//         },
//       })
//     })
//
//     it('when ratio is already fulfilled with token0', async () => {
//       token0Balance = await parseAmountUsingAddress(50_000, token0Address)
//       token1Balance = await parseAmountUsingAddress(0, token1Address)
//       const quoteToRatioRec: QuoteToRatioQueryParams = {
//         token0Address,
//         token0ChainId: 1,
//         token1Address,
//         token1ChainId: 1,
//         token0Balance,
//         token1Balance,
//         tickLower: 60,
//         tickUpper: 120,
//         feeAmount: 500,
//         recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
//         slippageTolerance: '5',
//         deadline: '360',
//         ratioErrorTolerance,
//         maxIterations: 6,
//         addLiquiditySlippageTolerance: '5',
//         addLiquidityDeadline: '360',
//         addLiquidityRecipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
//       }
//
//       await callAndExpectFail(quoteToRatioRec, {
//         status: 400,
//         data: {
//           detail: 'No swap needed for range order',
//           errorCode: 'NO_SWAP_NEEDED',
//         },
//       })
//     })
//
//     it('amount exceeds uint256', async () => {
//       token0Address = 'WETH'
//       token1Address = 'DAI'
//       token0Balance =
//         '100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
//       token1Balance = await parseAmountUsingAddress(2_000, token1Address)
//       const quoteToRatioRec: QuoteToRatioQueryParams = {
//         token0Address,
//         token0ChainId: 1,
//         token1Address,
//         token1ChainId: 1,
//         token0Balance,
//         token1Balance,
//         tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
//         tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
//         feeAmount: FeeAmount.MEDIUM,
//         recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
//         slippageTolerance: '5',
//         deadline: '360',
//         ratioErrorTolerance,
//         maxIterations: 5,
//         addLiquiditySlippageTolerance: '5',
//         addLiquidityDeadline: '360',
//         addLiquidityRecipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
//       }
//
//       await callAndExpectFail(quoteToRatioRec, {
//         status: 400,
//         data: {
//           detail: '"token0Balance" length must be less than or equal to 77 characters long',
//           errorCode: 'VALIDATION_ERROR',
//         },
//       })
//     })
//
//     it('with unknown token', async () => {
//       token0Address = 'UNKNOWNTOKEN'
//       token1Address = 'DAI'
//       token0Balance = '2000000000000'
//       token1Balance = await parseAmountUsingAddress(2_000, token1Address)
//       const quoteToRatioRec: QuoteToRatioQueryParams = {
//         token0Address,
//         token0ChainId: 1,
//         token1Address,
//         token1ChainId: 1,
//         token0Balance,
//         token1Balance,
//         tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
//         tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
//         feeAmount: FeeAmount.MEDIUM,
//         recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
//         slippageTolerance: '5',
//         deadline: '360',
//         ratioErrorTolerance,
//         maxIterations: 5,
//         addLiquiditySlippageTolerance: '5',
//         addLiquidityDeadline: '360',
//         addLiquidityRecipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
//       }
//
//       await callAndExpectFail(quoteToRatioRec, {
//         status: 400,
//         data: {
//           detail: 'Could not find token with address "UNKNOWNTOKEN"',
//           errorCode: 'TOKEN_0_INVALID',
//         },
//       })
//     })
//
//     it('when tokens are the same', async () => {
//       token0Address = 'DAI'
//       token1Address = 'DAI'
//       token0Balance = '2000000000000'
//       token1Balance = await parseAmountUsingAddress(2_000, token1Address)
//       const quoteToRatioRec: QuoteToRatioQueryParams = {
//         token0Address,
//         token0ChainId: 1,
//         token1Address,
//         token1ChainId: 1,
//         token0Balance,
//         token1Balance,
//         tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
//         tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
//         feeAmount: FeeAmount.MEDIUM,
//         recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
//         slippageTolerance: '5',
//         deadline: '360',
//         ratioErrorTolerance,
//         maxIterations: 5,
//         addLiquiditySlippageTolerance: '5',
//         addLiquidityDeadline: '360',
//         addLiquidityRecipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
//       }
//
//       await callAndExpectFail(quoteToRatioRec, {
//         status: 400,
//         data: {
//           detail: 'token0 and token1 must be different',
//           errorCode: 'TOKEN_0_1_SAME',
//         },
//       })
//     })
//
//     it('when token are out of order', async () => {
//       ;[token0Address, token1Address] = [token1Address, token0Address]
//       const quoteToRatioRec: QuoteToRatioQueryParams = {
//         token0Address,
//         token0ChainId: 1,
//         token1Address,
//         token1ChainId: 1,
//         token0Balance,
//         token1Balance,
//         tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
//         tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
//         feeAmount: FeeAmount.MEDIUM,
//         recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
//         slippageTolerance: '5',
//         deadline: '360',
//         ratioErrorTolerance,
//         maxIterations: 5,
//         addLiquiditySlippageTolerance: '5',
//         addLiquidityDeadline: '360',
//         addLiquidityRecipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
//       }
//
//       await callAndExpectFail(quoteToRatioRec, {
//         status: 400,
//         data: {
//           detail: 'token0 address must be less than token1 address',
//           errorCode: 'TOKENS_MISORDERED',
//         },
//       })
//     })
//   })
})
