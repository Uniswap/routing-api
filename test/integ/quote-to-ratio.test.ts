import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Currency, CurrencyAmount, Ether, Fraction, WETH9 } from '@uniswap/sdk-core'
import { DAI_MAINNET, parseAmount, USDC_MAINNET, USDT_MAINNET, WBTC_MAINNET } from '@uniswap/smart-order-router'
import { MethodParameters, Pool, Position } from '@uniswap/v3-sdk'
import { fail } from 'assert'
import axios, { AxiosResponse } from 'axios'
import chai, { expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiSubset from 'chai-subset'
import { BigNumber, providers } from 'ethers'
import hre from 'hardhat'
import JSBI from 'jsbi'
import qs from 'qs'
import {
  QuoteToRatioQueryParams,
  QuoteToRatioResponse,
  ResponseFraction,
} from '../../lib/handlers/quote-to-ratio/schema/quote-to-ratio-schema'
import { parseSlippageTolerance } from '../../lib/handlers/shared'
import { absoluteValue } from '../utils/absoluteValue'
import { resetAndFundAtBlock } from '../utils/forkAndFund'
import { getBalance, getBalanceAndApprove, getBalanceOfAddress } from '../utils/getBalanceAndApprove'
import { minimumAmountOut } from '../utils/minimumAmountOut'
import { getTestParamsFromEvents, parseEvents } from '../utils/parseEvents'
import { FeeAmount, getMaxTick, getMinTick, TICK_SPACINGS } from '../utils/ticks'
import { UNI_MAINNET } from '../utils/tokens'

const { ethers } = hre

chai.use(chaiAsPromised)
chai.use(chaiSubset)

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

function parseFraction(fraction: ResponseFraction): Fraction {
  return new Fraction(JSBI.BigInt(fraction.numerator), JSBI.BigInt(fraction.denominator))
}

const SWAP_ROUTER_V2 = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45'

describe('quote-to-ratio', async function () {
  // Help with test flakiness by retrying.
  this.retries(2)

  this.timeout(10000)

  // chain parameters
  let alice: SignerWithAddress
  let block: number

  // request parameters
  let quoteToRatioParams: QuoteToRatioQueryParams
  let response: AxiosResponse<QuoteToRatioResponse>

  const DEFAULT_QUERY_PARAMS = {
    token0Address: DAI_MAINNET.address,
    token0ChainId: 1,
    token1Address: USDC_MAINNET.address,
    token1ChainId: 1,
    token0Balance: parseAmount('5000', DAI_MAINNET).quotient.toString(),
    token1Balance: parseAmount('2000', USDC_MAINNET).quotient.toString(),
    tickLower: getMinTick(TICK_SPACINGS[FeeAmount.LOW]),
    tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.LOW]),
    feeAmount: FeeAmount.LOW,
    recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // alice address
    slippageTolerance: '5',
    deadline: '360',
    ratioErrorTolerance: 1,
    maxIterations: 6,
    addLiquidityRecipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // alice address
  }

  const errorToleranceFraction = (ratioErrorTolerance: number): Fraction => {
    return new Fraction(ratioErrorTolerance * 100, 10_000)
  }

  const executeSwapAndAdd = async (
    pool: string,
    methodParameters: MethodParameters,
    currencyIn: Currency,
    currencyOut: Currency
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
      ? ([currency0, currency1] = [currencyIn, currencyOut])
      : ([currency0, currency1] = [currencyOut, currencyIn])

    const token0BeforeAlice = await getBalanceAndApprove(alice, SWAP_ROUTER_V2, currency0)
    const token1BeforeAlice = await getBalanceAndApprove(alice, SWAP_ROUTER_V2, currency1)

    const token0BeforePool = await getBalanceOfAddress(alice, pool, currency0.wrapped)
    const token1BeforePool = await getBalanceOfAddress(alice, pool, currency1.wrapped)

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

    const events = parseEvents(txReceipt, [
      SWAP_ROUTER_V2,
      pool,
      alice.address,
      currency0.wrapped.address,
      currency1.wrapped.address,
    ])

    const token0AfterPool = await getBalanceOfAddress(alice, pool, currency0.wrapped)
    const token1AfterPool = await getBalanceOfAddress(alice, pool, currency1.wrapped)
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

  async function testSuccessfulContractExecution(
    response: AxiosResponse<QuoteToRatioResponse>,
    params: QuoteToRatioQueryParams,
    token0: Currency,
    token1: Currency,
    zeroForOne: boolean
  ) {
    const {
      tickLower,
      tickUpper,
      feeAmount,
      slippageTolerance,
      token0Balance: token0BalanceStr,
      token1Balance: token1BalanceStr,
    } = params
    const token0Balance = CurrencyAmount.fromRawAmount(token0, JSBI.BigInt(token0BalanceStr))
    const token1Balance = CurrencyAmount.fromRawAmount(token1, JSBI.BigInt(token1BalanceStr))
    const {
      data: { amount, quote, methodParameters, postSwapTargetPool, token0BalanceUpdated, token1BalanceUpdated },
    } = response

    const [tokenIn, tokenOut] = zeroForOne ? [token0, token1] : [token1, token0]

    const postSwapPool = new Pool(
      token0.wrapped,
      token1.wrapped,
      feeAmount,
      postSwapTargetPool.sqrtRatioX96,
      postSwapTargetPool.liquidity,
      parseInt(postSwapTargetPool.tickCurrent)
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
    } = await executeSwapAndAdd(postSwapTargetPool.address, methodParameters!, token0, token1)

    const {
      // total amounts transferred from alice. including amounts transferred back as a result of dust
      amount0TransferredFromAlice,
      amount1TransferredFromAlice,
      amount0SwappedInPool,
      amount1SwappedInPool,
      onChainPosition,
    } = getTestParamsFromEvents(events, token0.wrapped, token1.wrapped, alice.address, postSwapTargetPool.address)

    // alice's balance differences after entire completed transaction
    const amount0DiffAlice = token0BeforeAlice.subtract(token0AfterAlice)
    const amount1DiffAlice = token1BeforeAlice.subtract(token1AfterAlice)

    const currencyInSwapped = CurrencyAmount.fromRawAmount(tokenIn, JSBI.BigInt(amount))
    const currencyOutQuote = CurrencyAmount.fromRawAmount(tokenOut, JSBI.BigInt(quote))

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
    const { amount0: minPositionAmount0, amount1: minPositionAmount1 } = mintedPositionQuoted.mintAmountsWithSlippage(
      parseSlippageTolerance(slippageTolerance!)
    )

    // collect position with minimum amount out from swap with max slippage. Min amounts added to position
    // will either be mintAmountsWithSlippage for quoted position OR amounts resulting from minimum possible amount quoted from swap.
    // the lesser of the two, since mintAmountsWithSlippage can be undependable in certain scenarios, specifically involving out-of-range positions
    const amountOutMaxSwapSlippage = minimumAmountOut(parseSlippageTolerance(slippageTolerance!), currencyOutQuote)
    const mintedPositionMaxSwapSlippage = Position.fromAmounts({
      pool: postSwapPool,
      tickLower,
      tickUpper,
      amount0: zeroForOne ? token0BalanceUpdated : amountOutMaxSwapSlippage.quotient,
      amount1: zeroForOne ? amountOutMaxSwapSlippage.quotient : token1BalanceUpdated,
      useFullPrecision: true,
    })

    // make sure we never transfer more than the user-stated available balance
    expect(!amount0TransferredFromAlice.greaterThan(token0Balance)).to.be.true
    expect(!amount1TransferredFromAlice.greaterThan(token1Balance)).to.be.true

    // make sure router has no funds left
    expect(swapRouterFinalBalance0.quotient.toString()).to.equal('0')
    expect(swapRouterFinalBalance1.quotient.toString()).to.equal('0')

    // total amountIn pulled but not swapped now lives in the position
    // with native currency, other checks should suffice, gas effects these numbers.
    if (zeroForOne && amount0DiffAlice.currency.symbol !== 'ETH') {
      expect(amount0DiffAlice.subtract(currencyInSwapped).quotient.toString()).to.equal(
        newPoolBalance0.subtract(amount0SwappedInPool).quotient.toString()
      )
    } else if (amount1DiffAlice.currency.symbol !== 'ETH') {
      expect(amount1DiffAlice.subtract(currencyInSwapped).quotient.toString()).to.equal(
        newPoolBalance1.subtract(amount1SwappedInPool).quotient.toString()
      )
    }

    // check position details
    expect(onChainPosition.amount0.quotient.toString()).to.equal(
      newPoolBalance0.subtract(amount0SwappedInPool).quotient.toString()
    )
    expect(onChainPosition.amount1.quotient.toString()).to.equal(
      newPoolBalance1.subtract(amount1SwappedInPool).quotient.toString()
    )

    // check only for newly minted positions
    if (onChainPosition.newMint) {
      expect(onChainPosition.owner).to.equal(alice.address)
      expect(onChainPosition.tickLower).to.equal(tickLower)
      expect(onChainPosition.tickUpper).to.equal(tickUpper)
    }

    // check slippage tolerance was not hit
    const min0 = mintedPositionMaxSwapSlippage.amount0.lessThan(minPositionAmount0)
      ? mintedPositionMaxSwapSlippage.amount0
      : minPositionAmount0
    const min1 = mintedPositionMaxSwapSlippage.amount1.lessThan(minPositionAmount1)
      ? mintedPositionMaxSwapSlippage.amount1
      : minPositionAmount1
    expect(!onChainPosition.amount0.lessThan(min0)).to.be.true
    expect(!onChainPosition.amount1.lessThan(min1)).to.be.true
  }

  before('generate blockchain fork', async function () {
    this.timeout(40000)
    ;[alice] = await ethers.getSigners()

    // Make a dummy call to the API to get a block number to fork from.
    const quoteToRatioRec: QuoteToRatioQueryParams = DEFAULT_QUERY_PARAMS

    const queryParams = qs.stringify(quoteToRatioRec)
    const response: AxiosResponse<QuoteToRatioResponse> = await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`)
    const {
      data: { blockNumber },
    } = response

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

  describe('erc20 -> erc20 high volume trade token0Excess', () => {
    before(async function () {
      const token0Balance = parseAmount('1000000', DAI_MAINNET).quotient.toString()
      const token1Balance = parseAmount('2000', USDC_MAINNET).quotient.toString()
      const slippageTolerance = '0.05'

      quoteToRatioParams = {
        ...DEFAULT_QUERY_PARAMS,
        token0Balance,
        token1Balance,
        slippageTolerance,
      }

      const queryParams = qs.stringify(quoteToRatioParams)
      response = await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`)
    })

    it('generates a legitimate trade with routing-api', async function () {
      const {
        data: { tokenInAddress, tokenOutAddress, newRatioFraction, optimalRatioFraction },
        status,
      } = response

      const newRatio = parseFraction(newRatioFraction)
      const optimalRatio = parseFraction(optimalRatioFraction)
      const ratioDeviation = absoluteValue(new Fraction(1, 1).subtract(newRatio.divide(optimalRatio)))
      const ratioErrorToleranceFraction = errorToleranceFraction(quoteToRatioParams.ratioErrorTolerance)

      expect(status).to.equal(200)
      expect(ratioDeviation.lessThan(ratioErrorToleranceFraction)).to.be.true
      expect(tokenInAddress.toLowerCase()).to.equal(DAI_MAINNET.address.toLowerCase())
      expect(tokenOutAddress.toLowerCase()).to.equal(USDC_MAINNET.address.toLowerCase())
    })

    it('executes at the contract level', async function () {
      const zeroForOne = true
      await testSuccessfulContractExecution(response, quoteToRatioParams, DAI_MAINNET, USDC_MAINNET, zeroForOne)
    })
  })

  describe('erc20 -> erc20 low volume trade token0Excess', () => {
    before(async () => {
      quoteToRatioParams = DEFAULT_QUERY_PARAMS
      const queryParams = qs.stringify(quoteToRatioParams)
      response = await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`)
    })

    it('generates a legitimate trade with routing-api', async () => {
      const {
        data: { tokenInAddress, tokenOutAddress, newRatioFraction, optimalRatioFraction },
        status,
      } = response
      const newRatio = parseFraction(newRatioFraction)
      const optimalRatio = parseFraction(optimalRatioFraction)
      const ratioDeviation = absoluteValue(new Fraction(1, 1).subtract(newRatio.divide(optimalRatio)))
      const ratioErrorToleranceFraction = errorToleranceFraction(quoteToRatioParams.ratioErrorTolerance)

      expect(status).to.equal(200)
      expect(ratioDeviation.lessThan(ratioErrorToleranceFraction)).to.be.true
      expect(tokenInAddress.toLowerCase()).to.equal(DAI_MAINNET.address.toLowerCase())
      expect(tokenOutAddress.toLowerCase()).to.equal(USDC_MAINNET.address.toLowerCase())
    })

    it('successfully executes at the contract level', async () => {
      const zeroForOne = true
      await testSuccessfulContractExecution(response, quoteToRatioParams, DAI_MAINNET, USDC_MAINNET, zeroForOne)
    })
  })

  describe('erc20 -> erc20 low volume trade token1Excess', async () => {
    before(async () => {
      const token0Balance = parseAmount('2000', DAI_MAINNET).quotient.toString()
      const token1Balance = parseAmount('5000', USDC_MAINNET).quotient.toString()

      quoteToRatioParams = {
        ...DEFAULT_QUERY_PARAMS,
        token0Balance,
        token1Balance,
      }

      const queryParams = qs.stringify(quoteToRatioParams)
      response = await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`)
    })

    it('generates a legitimate trade with routing-api', async () => {
      const {
        data: { tokenInAddress, tokenOutAddress, newRatioFraction, optimalRatioFraction },
        status,
      } = response
      const newRatio = parseFraction(newRatioFraction)
      const optimalRatio = parseFraction(optimalRatioFraction)
      const ratioDeviation = absoluteValue(new Fraction(1, 1).subtract(newRatio.divide(optimalRatio)))
      const ratioErrorToleranceFraction = errorToleranceFraction(quoteToRatioParams.ratioErrorTolerance)

      expect(status).to.equal(200)
      expect(ratioDeviation.lessThan(ratioErrorToleranceFraction)).to.be.true
      expect(tokenInAddress.toLowerCase()).to.equal(USDC_MAINNET.address.toLowerCase())
      expect(tokenOutAddress.toLowerCase()).to.equal(DAI_MAINNET.address.toLowerCase())
    })

    it('successfully executes at the contract level', async () => {
      const zeroForOne = false
      await testSuccessfulContractExecution(response, quoteToRatioParams, DAI_MAINNET, USDC_MAINNET, zeroForOne)
    })
  })

  describe('erc20 -> erc20 high volume trade token1Excess', async () => {
    before(async () => {
      const token0Balance = parseAmount('2000', DAI_MAINNET).quotient.toString()
      const token1Balance = parseAmount('2000000', USDC_MAINNET).quotient.toString()

      quoteToRatioParams = {
        ...DEFAULT_QUERY_PARAMS,
        token0Balance,
        token1Balance,
      }

      const queryParams = qs.stringify(quoteToRatioParams)
      response = await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`)
    })

    it('generates a legitimate trade with routing-api', async () => {
      const {
        data: { tokenInAddress, tokenOutAddress, newRatioFraction, optimalRatioFraction },
        status,
      } = response
      const newRatio = parseFraction(newRatioFraction)
      const optimalRatio = parseFraction(optimalRatioFraction)
      const ratioDeviation = absoluteValue(new Fraction(1, 1).subtract(newRatio.divide(optimalRatio)))
      const ratioErrorToleranceFraction = errorToleranceFraction(quoteToRatioParams.ratioErrorTolerance)

      expect(status).to.equal(200)
      expect(ratioDeviation.lessThan(ratioErrorToleranceFraction)).to.be.true
      expect(tokenInAddress.toLowerCase()).to.equal(USDC_MAINNET.address.toLowerCase())
      expect(tokenOutAddress.toLowerCase()).to.equal(DAI_MAINNET.address.toLowerCase())
    })

    it('successfully executes at the contract level', async () => {
      const zeroForOne = false
      await testSuccessfulContractExecution(response, quoteToRatioParams, DAI_MAINNET, USDC_MAINNET, zeroForOne)
    })
  })

  describe('erc20 -> erc20 range order position token1 excess', async () => {
    before(async () => {
      const token0Balance = parseAmount('2000', DAI_MAINNET).quotient.toString()
      const token1Balance = parseAmount('50000', USDC_MAINNET).quotient.toString()
      const tickLower = 0
      const tickUpper = 60

      quoteToRatioParams = {
        ...DEFAULT_QUERY_PARAMS,
        token0Balance,
        token1Balance,
        tickLower,
        tickUpper,
      }

      const queryParams = qs.stringify(quoteToRatioParams)
      response = await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`)
    })

    it('generates a legitimate trade with routing-api', async () => {
      const {
        data: { tokenInAddress, tokenOutAddress, newRatioFraction, optimalRatioFraction },
        status,
      } = response
      const newRatio = parseFraction(newRatioFraction)
      const optimalRatio = parseFraction(optimalRatioFraction)
      const ratioDeviation = absoluteValue(new Fraction(1, 1).subtract(newRatio.divide(optimalRatio)))
      const ratioErrorToleranceFraction = errorToleranceFraction(quoteToRatioParams.ratioErrorTolerance)

      expect(status).to.equal(200)
      expect(!ratioDeviation.greaterThan(ratioErrorToleranceFraction)).to.be.true
      expect(tokenInAddress.toLowerCase()).to.equal(USDC_MAINNET.address.toLowerCase())
      expect(tokenOutAddress.toLowerCase()).to.equal(DAI_MAINNET.address.toLowerCase())
    })

    it('successfully executes at the contract level', async () => {
      const zeroForOne = false
      await testSuccessfulContractExecution(response, quoteToRatioParams, DAI_MAINNET, USDC_MAINNET, zeroForOne)
    })
  })

  describe('erc20 -> erc20 range order position token0 excess', async () => {
    before(async () => {
      const token0Balance = parseAmount('50000', DAI_MAINNET).quotient.toString()
      const token1Balance = parseAmount('2000', USDC_MAINNET).quotient.toString()
      const tickLower = -286420
      const tickUpper = -276420

      quoteToRatioParams = {
        ...DEFAULT_QUERY_PARAMS,
        token0Balance,
        token1Balance,
        tickLower,
        tickUpper,
      }

      const queryParams = qs.stringify(quoteToRatioParams)
      response = await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`)
    })

    it('generates a legitimate trade with routing-api', async () => {
      const {
        data: { tokenInAddress, tokenOutAddress, newRatioFraction, optimalRatioFraction },
        status,
      } = response
      const newRatio = parseFraction(newRatioFraction)
      const optimalRatio = parseFraction(optimalRatioFraction)
      const ratioDeviation = absoluteValue(new Fraction(1, 1).subtract(newRatio.divide(optimalRatio)))
      const ratioErrorToleranceFraction = errorToleranceFraction(quoteToRatioParams.ratioErrorTolerance)

      expect(status).to.equal(200)
      expect(!ratioDeviation.greaterThan(ratioErrorToleranceFraction)).to.be.true
      expect(tokenInAddress.toLowerCase()).to.equal(DAI_MAINNET.address.toLowerCase())
      expect(tokenOutAddress.toLowerCase()).to.equal(USDC_MAINNET.address.toLowerCase())
    })

    it('successfully executes at the contract level', async () => {
      const zeroForOne = true
      await testSuccessfulContractExecution(response, quoteToRatioParams, DAI_MAINNET, USDC_MAINNET, zeroForOne)
    })
  })

  describe('eth -> erc20', async () => {
    before(async () => {
      const token1Address = 'ETH'
      const token0Balance = parseAmount('1000', DAI_MAINNET).quotient.toString()
      const token1Balance = parseAmount('3', WETH9[1]).quotient.toString()

      quoteToRatioParams = {
        ...DEFAULT_QUERY_PARAMS,
        token0Balance,
        token1Balance,
        token1Address,
      }

      const queryParams = qs.stringify(quoteToRatioParams)
      response = await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`)
    })

    it('generates a legitimate trade with routing-api', async () => {
      const {
        data: { tokenInAddress, tokenOutAddress, newRatioFraction, optimalRatioFraction },
        status,
      } = response
      const newRatio = parseFraction(newRatioFraction)
      const optimalRatio = parseFraction(optimalRatioFraction)
      const ratioDeviation = absoluteValue(new Fraction(1, 1).subtract(newRatio.divide(optimalRatio)))
      const ratioErrorToleranceFraction = errorToleranceFraction(quoteToRatioParams.ratioErrorTolerance)

      expect(status).to.equal(200)
      expect(!ratioDeviation.greaterThan(ratioErrorToleranceFraction)).to.be.true
      expect(tokenInAddress.toLowerCase()).to.equal(WETH9[1].address.toLowerCase())
      expect(tokenOutAddress.toLowerCase()).to.equal(DAI_MAINNET.address.toLowerCase())
    })

    it('successfully executes at the contract level', async () => {
      const zeroForOne = false
      await testSuccessfulContractExecution(response, quoteToRatioParams, DAI_MAINNET, Ether.onChain(1), zeroForOne)
    })
  })

  describe('erc20 -> eth', async () => {
    before(async () => {
      const token1Address = 'ETH'
      const token0Balance = parseAmount('10000', DAI_MAINNET).quotient.toString()
      const token1Balance = parseAmount('1', WETH9[1]).quotient.toString()

      quoteToRatioParams = {
        ...DEFAULT_QUERY_PARAMS,
        token0Balance,
        token1Balance,
        token1Address,
      }

      const queryParams = qs.stringify(quoteToRatioParams)
      response = await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`)
    })

    it('generates a legitimate trade with routing-api', async () => {
      const {
        data: { tokenInAddress, tokenOutAddress, newRatioFraction, optimalRatioFraction },
        status,
      } = response
      const newRatio = parseFraction(newRatioFraction)
      const optimalRatio = parseFraction(optimalRatioFraction)
      const ratioDeviation = absoluteValue(new Fraction(1, 1).subtract(newRatio.divide(optimalRatio)))
      const ratioErrorToleranceFraction = errorToleranceFraction(quoteToRatioParams.ratioErrorTolerance)

      expect(status).to.equal(200)
      expect(!ratioDeviation.greaterThan(ratioErrorToleranceFraction)).to.be.true
      expect(tokenInAddress.toLowerCase()).to.equal(DAI_MAINNET.address.toLowerCase())
      expect(tokenOutAddress.toLowerCase()).to.equal(WETH9[1].address.toLowerCase())
    })

    it('successfully executes at the contract level', async () => {
      const zeroForOne = true
      await testSuccessfulContractExecution(response, quoteToRatioParams, DAI_MAINNET, Ether.onChain(1), zeroForOne)
    })
  })

  // ALL tests in this block are subsequent and must be run together
  describe('when adding to an existing position', async () => {
    let tokenId: string

    // before hook times out. This test needed for subsequent tests in this block.
    it('first mint new position', async () => {
      const token0Balance = parseAmount('2000', DAI_MAINNET).quotient.toString()
      const token1Balance = parseAmount('5000', USDC_MAINNET).quotient.toString()

      quoteToRatioParams = {
        ...DEFAULT_QUERY_PARAMS,
        token0Balance,
        token1Balance,
      }

      const queryParams = qs.stringify(quoteToRatioParams)
      response = await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`)

      const {
        data: { methodParameters, postSwapTargetPool },
      } = response

      const { events } = await executeSwapAndAdd(
        postSwapTargetPool.address,
        methodParameters!,
        DAI_MAINNET,
        USDC_MAINNET
      )

      const { onChainPosition } = getTestParamsFromEvents(
        events,
        DAI_MAINNET,
        USDC_MAINNET,
        alice.address,
        postSwapTargetPool.address
      )

      tokenId = onChainPosition.tokenId.toString()
    })

    it('generates a legitimate trade with routing-api', async () => {
      const token0Balance = parseAmount('3000', DAI_MAINNET).quotient.toString()
      const token1Balance = parseAmount('8000', USDC_MAINNET).quotient.toString()
      const addLiquidityTokenId = tokenId
      const addLiquidityRecipient = undefined

      quoteToRatioParams = {
        ...DEFAULT_QUERY_PARAMS,
        token0Balance,
        token1Balance,
        addLiquidityTokenId,
        addLiquidityRecipient,
      }

      const queryParams = qs.stringify(quoteToRatioParams)
      response = await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`)

      const {
        data: { tokenInAddress, tokenOutAddress, newRatioFraction, optimalRatioFraction },
        status,
      } = response

      const newRatio = parseFraction(newRatioFraction)
      const optimalRatio = parseFraction(optimalRatioFraction)
      const ratioDeviation = absoluteValue(new Fraction(1, 1).subtract(newRatio.divide(optimalRatio)))
      const ratioErrorToleranceFraction = errorToleranceFraction(quoteToRatioParams.ratioErrorTolerance)

      expect(status).to.equal(200)
      expect(ratioDeviation.lessThan(ratioErrorToleranceFraction)).to.be.true
      expect(tokenInAddress.toLowerCase()).to.equal(USDC_MAINNET.address.toLowerCase())
      expect(tokenOutAddress.toLowerCase()).to.equal(DAI_MAINNET.address.toLowerCase())
    })

    it('successfully executes at the contract level', async () => {
      const zeroForOne = false
      await testSuccessfulContractExecution(response, quoteToRatioParams, DAI_MAINNET, USDC_MAINNET, zeroForOne)
    })
  })

  describe('4xx Error response', () => {
    it('when both balances are 0', async () => {
      const token0Balance = '0'
      const token1Balance = '0'

      quoteToRatioParams = {
        ...DEFAULT_QUERY_PARAMS,
        token0Balance,
        token1Balance,
      }

      await callAndExpectFail(quoteToRatioParams, {
        status: 400,
        data: {
          detail: 'No swap needed',
          errorCode: 'NO_SWAP_NEEDED',
        },
      })
    })

    it('when max iterations is 0', async () => {
      const maxIterations = 0
      quoteToRatioParams = {
        ...DEFAULT_QUERY_PARAMS,
        maxIterations,
      }

      await callAndExpectFail(quoteToRatioParams, {
        status: 400,
        data: {
          detail: '"maxIterations" must be larger than or equal to 1',
          errorCode: 'VALIDATION_ERROR',
        },
      })
    })

    it('when ratio is already fulfilled with token1', async () => {
      const token0Balance = parseAmount('0', DAI_MAINNET).quotient.toString()
      const token1Balance = parseAmount('5000', USDC_MAINNET).quotient.toString()
      const tickLower = -286420
      const tickUpper = -276420

      quoteToRatioParams = {
        ...DEFAULT_QUERY_PARAMS,
        token0Balance,
        token1Balance,
        tickLower,
        tickUpper,
      }

      await callAndExpectFail(quoteToRatioParams, {
        status: 400,
        data: {
          detail: 'No swap needed for range order',
          errorCode: 'NO_SWAP_NEEDED',
        },
      })
    })

    it('when ratio is already fulfilled with token0', async () => {
      const token0Balance = parseAmount('50000', DAI_MAINNET).quotient.toString()
      const token1Balance = parseAmount('0', USDC_MAINNET).quotient.toString()
      const tickLower = 0
      const tickUpper = 60

      quoteToRatioParams = {
        ...DEFAULT_QUERY_PARAMS,
        token0Balance,
        token1Balance,
        tickLower,
        tickUpper,
      }

      await callAndExpectFail(quoteToRatioParams, {
        status: 400,
        data: {
          detail: 'No swap needed for range order',
          errorCode: 'NO_SWAP_NEEDED',
        },
      })
    })

    it('amount exceeds uint256', async () => {
      const token0Balance =
        '100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'

      quoteToRatioParams = {
        ...DEFAULT_QUERY_PARAMS,
        token0Balance,
      }

      await callAndExpectFail(quoteToRatioParams, {
        status: 400,
        data: {
          detail: '"token0Balance" length must be less than or equal to 77 characters long',
          errorCode: 'VALIDATION_ERROR',
        },
      })
    })

    it('with unknown token', async () => {
      const token0Address = 'UNKNOWNTOKEN'

      quoteToRatioParams = {
        ...DEFAULT_QUERY_PARAMS,
        token0Address,
      }

      await callAndExpectFail(quoteToRatioParams, {
        status: 400,
        data: {
          detail: 'Could not find token with address "UNKNOWNTOKEN"',
          errorCode: 'TOKEN_0_INVALID',
        },
      })
    })

    it('when tokens are the same', async () => {
      const token0Address = DAI_MAINNET.address
      const token1Address = DAI_MAINNET.address

      quoteToRatioParams = {
        ...DEFAULT_QUERY_PARAMS,
        token0Address,
        token1Address,
      }

      await callAndExpectFail(quoteToRatioParams, {
        status: 400,
        data: {
          detail: 'token0 and token1 must be different',
          errorCode: 'TOKEN_0_1_SAME',
        },
      })
    })

    it('when token are out of order', async () => {
      const token0Address = USDC_MAINNET.address
      const token1Address = DAI_MAINNET.address

      quoteToRatioParams = {
        ...DEFAULT_QUERY_PARAMS,
        token0Address,
        token1Address,
      }

      await callAndExpectFail(quoteToRatioParams, {
        status: 400,
        data: {
          detail: 'token0 address must be less than token1 address',
          errorCode: 'TOKENS_MISORDERED',
        },
      })
    })

    it('when tick is not a multiple of target pool tick spacing', async () => {
      const tickLower = -44

      quoteToRatioParams = {
        ...DEFAULT_QUERY_PARAMS,
        tickLower,
      }

      await callAndExpectFail(quoteToRatioParams, {
        status: 400,
        data: {
          detail: 'tickLower and tickUpper must comply with the tick spacing of the target pool',
          errorCode: 'INVALID_TICK_SPACING',
        },
      })
    })
  })
})
