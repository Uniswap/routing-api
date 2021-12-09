import { Currency, Ether, Fraction } from '@uniswap/sdk-core'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import DEFAULT_TOKEN_LIST from '@uniswap/default-token-list'
import { CachingTokenListProvider, NodeJSCache, parseAmount } from '@uniswap/smart-order-router'
import { Currency, CurrencyAmount, Ether, Fraction, WETH9 } from '@uniswap/sdk-core'
import { MethodParameters } from '@uniswap/v3-sdk'
import { BigNumber, providers } from 'ethers'
import { fail } from 'assert'
import axios, { AxiosResponse } from 'axios'
import chai, { expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiSubset from 'chai-subset'
import { parseUnits } from 'ethers/lib/utils'
import JSBI from 'jsbi'
import NodeCache from 'node-cache'
import hre from 'hardhat'
import qs from 'qs'
import {
  QuoteToRatioQueryParams,
  QuoteToRatioResponse,
  ResponseFraction,
} from '../../lib/handlers/quote-to-ratio/schema/quote-to-ratio-schema'
import { QuoteQueryParams } from '../../lib/handlers/quote/schema/quote-schema'
import { QuoteResponse } from '../../lib/handlers/schema'
import { absoluteValue } from '../utils/absoluteValue'
import { FeeAmount, getMaxTick, getMinTick, TICK_SPACINGS } from '../utils/ticks'
import { getTokenListProvider } from '../utils/tokens'
import { resetAndFundAtBlock } from '../utils/forkAndFund'
import { getBalance, getBalanceAndApprove } from '../utils/getBalanceAndApprove'
import { DAI_MAINNET, getAmount, UNI_MAINNET, USDC_MAINNET, USDT_MAINNET, WBTC_MAINNET } from '../utils/tokens'
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

const SWAP_ROUTER_V2 = '0x075B36dE1Bd11cb361c5B3B1E80A9ab0e7aa8a60'

describe('quote-to-ratio', function () {
  // Help with test flakiness by retrying.
  this.retries(2)

  this.timeout(10000)

  // chain parameters
  let alice: SignerWithAddress
  let block: number

  // request parameters
  let token0Address: string
  let token1Address: string
  let token0Balance: string
  let token1Balance: string
  let ratioErrorTolerance: number
  let ratioErrorToleranceFraction: Fraction

  const executeSwap = async (
    methodParameters: MethodParameters,
    currencyIn: Currency,
    currencyOut: Currency,
    approveCurrentOut?: boolean
  ): Promise<{
    tokenInAfter: CurrencyAmount<Currency>
    tokenInBefore: CurrencyAmount<Currency>
    tokenOutAfter: CurrencyAmount<Currency>
    tokenOutBefore: CurrencyAmount<Currency>
  }> => {
    const tokenInBefore = await getBalanceAndApprove(alice, SWAP_ROUTER_V2, currencyIn)

    let tokenOutBefore
    if (approveCurrentOut) {
      tokenOutBefore = await getBalanceAndApprove(alice, SWAP_ROUTER_V2, currencyOut)
    } else {
      tokenOutBefore = await getBalance(alice, currencyOut)
    }

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

    // const tokenInAfter = await getBalance(alice, currencyIn)
    // const tokenOutAfter = await getBalance(alice, currencyOut)
    //
    return {
      tokenInAfter:  await getBalance(alice, currencyIn),
      tokenInBefore:  await getBalance(alice, currencyIn),
      tokenOutAfter:  await getBalance(alice, currencyIn),
      tokenOutBefore:  await getBalance(alice, currencyIn),
    }
  }

  before('generate blockchain fork', async function () {
    this.timeout(40000)
    ;[alice] = await ethers.getSigners()

    // Make a dummy call to the API to get a block number to fork from.

    const quoteToRatioRec: QuoteToRatioQueryParams = {
      token0Address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      token0ChainId: 1,
      token1Address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      token1ChainId: 1,
      token0Balance: await parseAmountUsingAddress(5_000, '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'),
      token1Balance: await parseAmountUsingAddress(2_000, '0xdac17f958d2ee523a2206206994597c13d831ec7'),
      tickLower: -60,
      tickUpper: 60,
      feeAmount: 500,
      recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      slippageTolerance: '5',
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

    console.log('blockNumber', blockNumber)
    block = parseInt(blockNumber) - 10

    alice = await resetAndFundAtBlock(alice, block, [
      parseAmount('5000000', USDC_MAINNET),
      parseAmount('5000000', USDT_MAINNET),
      parseAmount('10', WBTC_MAINNET),
      parseAmount('1000', UNI_MAINNET),
      parseAmount('1000', WETH9[1]),
      parseAmount('5000000', DAI_MAINNET),
    ])
  })

  beforeEach('refresh query data', async () => {
    token0Address = 'USDC'
    token1Address = 'USDT'
    token0Balance = parseAmount('5000', USDC_MAINNET).quotient.toString()
    token1Balance = parseAmount('2000', USDT_MAINNET).quotient.toString()
    ratioErrorTolerance = 1
    ratioErrorToleranceFraction = new Fraction(ratioErrorTolerance * 100, 10_000)
  })

  it.only('erc20 -> erc20 low volume trade token0Excess', async () => {
    const quoteToRatioRec: QuoteToRatioQueryParams = {
      token0Address,
      token0ChainId: 1,
      token1Address,
      token1ChainId: 1,
      token0Balance,
      token1Balance,
      tickLower: -60,
      tickUpper: 60,
      feeAmount: 500,
      recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      slippageTolerance: '5',
      deadline: '360',
      ratioErrorTolerance,
      maxIterations: 6,
      addLiquiditySlippageTolerance: '5',
      addLiquidityDeadline: '360',
      addLiquidityRecipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
    }

    const queryParams = qs.stringify(quoteToRatioRec)
    const response: AxiosResponse<QuoteToRatioResponse> = await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`)
    const {
      data: { tokenInAddress, tokenOutAddress, newRatioFraction, optimalRatioFraction, methodParameters },
      status,
    } = response

    const newRatio = parseFraction(newRatioFraction)
    const optimalRatio = parseFraction(optimalRatioFraction)
    const ratioDeviation = absoluteValue(new Fraction(1, 1).subtract(newRatio.divide(optimalRatio)))

    expect(status).to.equal(200)
    expect(ratioDeviation.lessThan(ratioErrorToleranceFraction)).to.be.true
    expect(tokenInAddress.toLowerCase()).to.equal(USDC_MAINNET.address.toLowerCase())
    expect(tokenOutAddress.toLowerCase()).to.equal(USDT_MAINNET.address.toLowerCase())

    // console.log(response.data)

    const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(
      methodParameters!,
      USDC_MAINNET,
      USDT_MAINNET,
      true,
    )

  })

  it.only('erc20 -> erc20 high volume trade token0Excess', async () => {
    token0Address = 'DAI'
    token1Address = 'USDC'
    token0Balance = parseAmount('1000000', DAI_MAINNET).quotient.toString()
    token1Balance = parseAmount('2000', USDC_MAINNET).quotient.toString()
    const quoteToRatioRec: QuoteToRatioQueryParams = {
      token0Address,
      token0ChainId: 1,
      token1Address,
      token1ChainId: 1,
      token0Balance,
      token1Balance,
      tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      feeAmount: 3000,
      recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      slippageTolerance: '5',
      deadline: '360',
      ratioErrorTolerance,
      maxIterations: 6,
      addLiquiditySlippageTolerance: '5',
      addLiquidityDeadline: '360',
      addLiquidityRecipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
    }

    const queryParams = qs.stringify(quoteToRatioRec)
    const response: AxiosResponse<QuoteToRatioResponse> = await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`)
    const {
      data: { tokenInAddress, tokenOutAddress, newRatioFraction, optimalRatioFraction, methodParameters },
      status,
    } = response

    const newRatio = parseFraction(newRatioFraction)
    const optimalRatio = parseFraction(optimalRatioFraction)
    const ratioDeviation = absoluteValue(new Fraction(1, 1).subtract(newRatio.divide(optimalRatio)))

    expect(status).to.equal(200)
    expect(ratioDeviation.lessThan(ratioErrorToleranceFraction)).to.be.true
    expect(tokenInAddress.toLowerCase()).to.equal(DAI_MAINNET.address.toLowerCase())
    expect(tokenOutAddress.toLowerCase()).to.equal(USDC_MAINNET.address.toLowerCase())

    const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(
      methodParameters!,
      USDC_MAINNET,
      DAI_MAINNET,
      true,
    )
  })

  it('erc20 -> erc20 low volume trade token1Excess', async () => {
    token0Balance = await parseAmountUsingAddress(2_000, token0Address)
    token1Balance = await parseAmountUsingAddress(5_000, token1Address)
    const quoteToRatioRec: QuoteToRatioQueryParams = {
      token0Address,
      token0ChainId: 1,
      token1Address,
      token1ChainId: 1,
      token0Balance,
      token1Balance,
      tickLower: -180,
      tickUpper: 180,
      feeAmount: 500,
      recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      slippageTolerance: '1',
      deadline: '360',
      ratioErrorTolerance,
      maxIterations: 6,
      addLiquiditySlippageTolerance: '1',
      addLiquidityDeadline: '360',
      addLiquidityRecipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
    }

    const queryParams = qs.stringify(quoteToRatioRec)
    const response: AxiosResponse<QuoteToRatioResponse> = await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`)
    const {
      data: { tokenInAddress, tokenOutAddress, newRatioFraction, optimalRatioFraction, methodParameters },
      status,
    } = response

    const newRatio = parseFraction(newRatioFraction)
    const optimalRatio = parseFraction(optimalRatioFraction)
    const ratioDeviation = absoluteValue(new Fraction(1, 1).subtract(newRatio.divide(optimalRatio)))

    expect(status).to.equal(200)
    expect(ratioDeviation.lessThan(ratioErrorToleranceFraction)).to.be.true
    expect(tokenInAddress.toLowerCase()).to.equal(token1Address.toLowerCase())
    expect(tokenOutAddress.toLowerCase()).to.equal(token0Address.toLowerCase())

    const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(
      methodParameters!,
      USDC_MAINNET,
      USDT_MAINNET,
      true,
    )
  })

  it('erc20 -> erc20 high volume trade token1Excess', async () => {
    token0Balance = await parseAmountUsingAddress(2_000, token0Address)
    token1Balance = await parseAmountUsingAddress(100_000_000, token1Address)
    const quoteToRatioRec: QuoteToRatioQueryParams = {
      token0Address,
      token0ChainId: 1,
      token1Address,
      token1ChainId: 1,
      token0Balance,
      token1Balance,
      tickLower: -200,
      tickUpper: 200,
      feeAmount: 10000,
      recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      slippageTolerance: '5',
      deadline: '360',
      ratioErrorTolerance,
      maxIterations: 6,
      addLiquiditySlippageTolerance: '5',
      addLiquidityDeadline: '360',
      addLiquidityRecipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
    }

    const queryParams = qs.stringify(quoteToRatioRec)
    const response: AxiosResponse<QuoteToRatioResponse> = await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`)
    const {
      data: { tokenInAddress, tokenOutAddress, newRatioFraction, optimalRatioFraction },
      status,
    } = response

    const newRatio = parseFraction(newRatioFraction)
    const optimalRatio = parseFraction(optimalRatioFraction)
    const ratioDeviation = absoluteValue(new Fraction(1, 1).subtract(newRatio.divide(optimalRatio)))

    expect(status).to.equal(200)
    expect(ratioDeviation.lessThan(ratioErrorToleranceFraction)).to.be.true
    expect(tokenInAddress.toLowerCase()).to.equal(token1Address.toLowerCase())
    expect(tokenOutAddress.toLowerCase()).to.equal(token0Address.toLowerCase())
  })

  it('erc20 -> erc20 range order position token1 excess', async () => {
    token0Balance = await parseAmountUsingAddress(50_000, token0Address)
    token1Balance = await parseAmountUsingAddress(2_000, token1Address)
    const quoteToRatioRec: QuoteToRatioQueryParams = {
      token0Address,
      token0ChainId: 1,
      token1Address,
      token1ChainId: 1,
      token0Balance,
      token1Balance,
      tickLower: 100_000,
      tickUpper: 200_000,
      feeAmount: 500,
      recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      slippageTolerance: '5',
      deadline: '360',
      ratioErrorTolerance,
      maxIterations: 6,
      addLiquiditySlippageTolerance: '5',
      addLiquidityDeadline: '360',
      addLiquidityRecipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
    }

    const queryParams = qs.stringify(quoteToRatioRec)
    const response: AxiosResponse<QuoteToRatioResponse> = await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`)
    const {
      data: { amount, newRatioFraction, optimalRatioFraction },
      status,
    } = response

    const newRatio = parseFraction(newRatioFraction)
    const optimalRatio = parseFraction(optimalRatioFraction)
    const ratioDeviation = absoluteValue(new Fraction(1, 1).subtract(newRatio.divide(optimalRatio)))

    expect(status).to.equal(200)
    expect(!ratioDeviation.greaterThan(ratioErrorToleranceFraction)).to.be.true
    expect(amount).to.equal(token1Balance)
  })

  it('erc20 -> erc20 range order position token0 excess', async () => {
    token0Balance = await parseAmountUsingAddress(50_000, token0Address)
    token1Balance = await parseAmountUsingAddress(2_000, token1Address)
    const quoteToRatioRec: QuoteToRatioQueryParams = {
      token0Address,
      token0ChainId: 1,
      token1Address,
      token1ChainId: 1,
      token0Balance,
      token1Balance,
      tickLower: -200_000,
      tickUpper: -100_000,
      feeAmount: 500,
      recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      slippageTolerance: '5',
      deadline: '360',
      ratioErrorTolerance,
      maxIterations: 6,
      addLiquiditySlippageTolerance: '5',
      addLiquidityDeadline: '360',
      addLiquidityRecipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
    }

    const queryParams = qs.stringify(quoteToRatioRec)
    const response: AxiosResponse<QuoteToRatioResponse> = await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`)
    const {
      data: { amount, newRatioFraction, optimalRatioFraction },
      status,
    } = response

    const newRatio = parseFraction(newRatioFraction)
    const optimalRatio = parseFraction(optimalRatioFraction)
    const ratioDeviation = absoluteValue(new Fraction(1, 1).subtract(newRatio.divide(optimalRatio)))

    expect(status).to.equal(200)
    expect(ratioDeviation.equalTo(new Fraction(0, 0))).to.be.true
    expect(amount).to.equal(token0Balance)
  })

  it('weth -> erc20', async () => {
    token0Address = 'DAI'
    token1Address = 'ETH'
    token0Balance = await parseAmountUsingAddress(2_000, token0Address)
    token1Balance = await parseAmountUsingAddress(5_000, token1Address)
    const quoteToRatioRec: QuoteToRatioQueryParams = {
      token0Address,
      token0ChainId: 1,
      token1Address,
      token1ChainId: 1,
      token0Balance,
      token1Balance,
      tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      feeAmount: FeeAmount.MEDIUM,
      recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      slippageTolerance: '5',
      deadline: '360',
      ratioErrorTolerance,
      maxIterations: 6,
      addLiquiditySlippageTolerance: '5',
      addLiquidityDeadline: '360',
      addLiquidityRecipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
    }

    const queryParams = qs.stringify(quoteToRatioRec)
    const response: AxiosResponse<QuoteToRatioResponse> = await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`)
    const {
      data: { newRatioFraction, optimalRatioFraction },
      status,
    } = response

    const newRatio = parseFraction(newRatioFraction)
    const optimalRatio = parseFraction(optimalRatioFraction)
    const ratioDeviation = absoluteValue(new Fraction(1, 1).subtract(newRatio.divide(optimalRatio)))

    expect(status).to.equal(200)
    expect(!ratioDeviation.greaterThan(ratioErrorToleranceFraction)).to.be.true
  })

  // TODO: should be ERC20 -> ETH...residual ETH to WETH9
  it('erc20 -> eth', async () => {
    token0Address = 'DAI' //0x6b175474e89094c44da98b954eedeac495271d0f
    token1Address = 'ETH' //0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2
    token0Balance = await parseAmountUsingAddress(20_000, token0Address)
    token1Balance = await parseAmountUsingAddress(0, token1Address)
    const quoteToRatioRec: QuoteToRatioQueryParams = {
      token0Address,
      token0ChainId: 1,
      token1Address,
      token1ChainId: 1,
      token0Balance,
      token1Balance,
      tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      feeAmount: FeeAmount.MEDIUM,
      recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      slippageTolerance: '5',
      deadline: '360',
      ratioErrorTolerance,
      maxIterations: 6,
      addLiquiditySlippageTolerance: '5',
      addLiquidityDeadline: '360',
      addLiquidityRecipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
    }

    console.log('20_000: ', await parseAmountUsingAddress(20_000, token0Address))
    console.log('0: ', await parseAmountUsingAddress(0, token1Address))
    const queryParams = qs.stringify(quoteToRatioRec)
    const response: AxiosResponse<QuoteToRatioResponse> = await axios.get<QuoteToRatioResponse>(`${API}?${queryParams}`)
    const {
      data: { newRatioFraction, optimalRatioFraction },
      status,
    } = response

    const newRatio = parseFraction(newRatioFraction)
    const optimalRatio = parseFraction(optimalRatioFraction)
    const ratioDeviation = absoluteValue(new Fraction(1, 1).subtract(newRatio.divide(optimalRatio)))
    console.log(response.data)
    expect(status).to.equal(200)
    expect(!ratioDeviation.greaterThan(ratioErrorToleranceFraction)).to.be.true
  })

  it('singleAssetAdd token0Excess')

  it('singleAssetAdd token1Excess')

  it('mints a new position')

  it('adds liquidity to an existing position')

  it('')




  describe('4xx Error response', () => {
    it('when both balances are 0', async () => {
      token0Address = 'DAI'
      token1Address = 'WETH'
      token0Balance = await parseAmountUsingAddress(0, token0Address)
      token1Balance = await parseAmountUsingAddress(0, token1Address)
      const quoteToRatioRec: QuoteToRatioQueryParams = {
        token0Address,
        token0ChainId: 1,
        token1Address,
        token1ChainId: 1,
        token0Balance,
        token1Balance,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        feeAmount: FeeAmount.MEDIUM,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        ratioErrorTolerance,
        maxIterations: 6,
        addLiquiditySlippageTolerance: '5',
        addLiquidityDeadline: '360',
        addLiquidityRecipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      }

      await callAndExpectFail(quoteToRatioRec, {
        status: 400,
        data: {
          detail: 'No swap needed',
          errorCode: 'NO_SWAP_NEEDED',
        },
      })
    })

    it('when max iterations is 0', async () => {
      token0Address = 'WETH'
      token1Address = 'DAI'
      token0Balance = await parseAmountUsingAddress(50_000, token0Address)
      token1Balance = await parseAmountUsingAddress(2_000, token1Address)
      const quoteToRatioRec: QuoteToRatioQueryParams = {
        token0Address,
        token0ChainId: 1,
        token1Address,
        token1ChainId: 1,
        token0Balance,
        token1Balance,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        feeAmount: FeeAmount.MEDIUM,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        ratioErrorTolerance,
        maxIterations: 0,
        addLiquiditySlippageTolerance: '5',
        addLiquidityDeadline: '360',
        addLiquidityRecipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      }

      await callAndExpectFail(quoteToRatioRec, {
        status: 400,
        data: {
          detail: '"maxIterations" must be larger than or equal to 1',
          errorCode: 'VALIDATION_ERROR',
        },
      })
    })

    it('when ratio is already fulfilled with token1', async () => {
      token0Balance = await parseAmountUsingAddress(0, token0Address)
      token1Balance = await parseAmountUsingAddress(5_000, token1Address)
      const quoteToRatioRec: QuoteToRatioQueryParams = {
        token0Address,
        token0ChainId: 1,
        token1Address,
        token1ChainId: 1,
        token0Balance,
        token1Balance,
        tickLower: -120,
        tickUpper: -60,
        feeAmount: 500,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        ratioErrorTolerance,
        maxIterations: 6,
        addLiquiditySlippageTolerance: '5',
        addLiquidityDeadline: '360',
        addLiquidityRecipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      }

      await callAndExpectFail(quoteToRatioRec, {
        status: 400,
        data: {
          detail: 'No swap needed for range order',
          errorCode: 'NO_SWAP_NEEDED',
        },
      })
    })

    it('when ratio is already fulfilled with token0', async () => {
      token0Balance = await parseAmountUsingAddress(50_000, token0Address)
      token1Balance = await parseAmountUsingAddress(0, token1Address)
      const quoteToRatioRec: QuoteToRatioQueryParams = {
        token0Address,
        token0ChainId: 1,
        token1Address,
        token1ChainId: 1,
        token0Balance,
        token1Balance,
        tickLower: 60,
        tickUpper: 120,
        feeAmount: 500,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        ratioErrorTolerance,
        maxIterations: 6,
        addLiquiditySlippageTolerance: '5',
        addLiquidityDeadline: '360',
        addLiquidityRecipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      }

      await callAndExpectFail(quoteToRatioRec, {
        status: 400,
        data: {
          detail: 'No swap needed for range order',
          errorCode: 'NO_SWAP_NEEDED',
        },
      })
    })

    it('amount exceeds uint256', async () => {
      token0Address = 'WETH'
      token1Address = 'DAI'
      token0Balance =
        '100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
      token1Balance = await parseAmountUsingAddress(2_000, token1Address)
      const quoteToRatioRec: QuoteToRatioQueryParams = {
        token0Address,
        token0ChainId: 1,
        token1Address,
        token1ChainId: 1,
        token0Balance,
        token1Balance,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        feeAmount: FeeAmount.MEDIUM,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        ratioErrorTolerance,
        maxIterations: 5,
        addLiquiditySlippageTolerance: '5',
        addLiquidityDeadline: '360',
        addLiquidityRecipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      }

      await callAndExpectFail(quoteToRatioRec, {
        status: 400,
        data: {
          detail: '"token0Balance" length must be less than or equal to 77 characters long',
          errorCode: 'VALIDATION_ERROR',
        },
      })
    })

    it('with unknown token', async () => {
      token0Address = 'UNKNOWNTOKEN'
      token1Address = 'DAI'
      token0Balance = '2000000000000'
      token1Balance = await parseAmountUsingAddress(2_000, token1Address)
      const quoteToRatioRec: QuoteToRatioQueryParams = {
        token0Address,
        token0ChainId: 1,
        token1Address,
        token1ChainId: 1,
        token0Balance,
        token1Balance,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        feeAmount: FeeAmount.MEDIUM,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        ratioErrorTolerance,
        maxIterations: 5,
        addLiquiditySlippageTolerance: '5',
        addLiquidityDeadline: '360',
        addLiquidityRecipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      }

      await callAndExpectFail(quoteToRatioRec, {
        status: 400,
        data: {
          detail: 'Could not find token with address "UNKNOWNTOKEN"',
          errorCode: 'TOKEN_0_INVALID',
        },
      })
    })

    it('when tokens are the same', async () => {
      token0Address = 'DAI'
      token1Address = 'DAI'
      token0Balance = '2000000000000'
      token1Balance = await parseAmountUsingAddress(2_000, token1Address)
      const quoteToRatioRec: QuoteToRatioQueryParams = {
        token0Address,
        token0ChainId: 1,
        token1Address,
        token1ChainId: 1,
        token0Balance,
        token1Balance,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        feeAmount: FeeAmount.MEDIUM,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        ratioErrorTolerance,
        maxIterations: 5,
        addLiquiditySlippageTolerance: '5',
        addLiquidityDeadline: '360',
        addLiquidityRecipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      }

      await callAndExpectFail(quoteToRatioRec, {
        status: 400,
        data: {
          detail: 'token0 and token1 must be different',
          errorCode: 'TOKEN_0_1_SAME',
        },
      })
    })

    it('when token are out of order', async () => {
      ;[token0Address, token1Address] = [token1Address, token0Address]
      const quoteToRatioRec: QuoteToRatioQueryParams = {
        token0Address,
        token0ChainId: 1,
        token1Address,
        token1ChainId: 1,
        token0Balance,
        token1Balance,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        feeAmount: FeeAmount.MEDIUM,
        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        slippageTolerance: '5',
        deadline: '360',
        ratioErrorTolerance,
        maxIterations: 5,
        addLiquiditySlippageTolerance: '5',
        addLiquidityDeadline: '360',
        addLiquidityRecipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      }

      await callAndExpectFail(quoteToRatioRec, {
        status: 400,
        data: {
          detail: 'token0 address must be less than token1 address',
          errorCode: 'TOKENS_MISORDERED',
        },
      })
    })
  })
})
