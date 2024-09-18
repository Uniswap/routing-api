import { Factory } from 'fishery'

import { ChainId, Percent, Token } from '@uniswap/sdk-core'
import { TradeTypeParam } from '../../../../lib/handlers/quote/schema/quote-schema'
import { expect, jest } from '@jest/globals'
import { SwapType } from '@uniswap/smart-order-router'
import { utils } from 'ethers'
import { UNIVERSAL_ROUTER_ADDRESS, UniversalRouterVersion } from '@uniswap/universal-router-sdk'

import {
  SwapOptionsFactory,
  SwapOptionsSwapRouter02Input,
  SwapOptionsUniversalRouterInput,
} from '../../../../lib/handlers/quote/SwapOptionsFactory'

const MAINNET_UNIVERSAL_ROUTER_ADDRESS = UNIVERSAL_ROUTER_ADDRESS(UniversalRouterVersion.V1_2, ChainId.MAINNET)

class universalRouterInputFactory extends Factory<SwapOptionsUniversalRouterInput> {
  withFees() {
    return this.params({
      portionBips: 100,
      portionRecipient: 'portionRecipient',
      portionAmount: '25',
      amountRaw: '2500000000000000000',
    })
  }

  withPermits() {
    return this.params({
      permitSignature: 'permitSignature',
      permitNonce: 'permitNonce',
      permitExpiration: 'permitExpiration',
      permitAmount: 'permitAmount',
      permitSigDeadline: 'permitSigDeadline',
      simulateFromAddress: 'simulateFromAddress',
    })
  }

  withSimulation() {
    return this.params({
      simulateFromAddress: 'simulateFromAddress',
    })
  }
}

const UniversalRouterInputFactory = universalRouterInputFactory.define(() => ({
  chainId: ChainId.MAINNET,
  currencyIn: new Token(ChainId.MAINNET, '0x0000000000000000000000000000000000000001', 18, 'FOO', 'Foo'),
  currencyOut: new Token(ChainId.MAINNET, '0x0000000000000000000000000000000000000002', 18, 'BAR', 'Bar'),
  tradeType: 'exactIn' as TradeTypeParam,
  universalRouterVersion: UniversalRouterVersion.V1_2,
  slippageTolerance: '0.5',
  amountRaw: '100000000000000000',
  deadline: '60',
  recipient: 'recipient',
}))

describe('SwapOptionsFactory - Universal Router', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })
  it('Sets the type to be SwapType.UNIVERSAL_ROUTER', () => {
    const input = UniversalRouterInputFactory.build()

    const swapOptions = SwapOptionsFactory.createUniversalRouterOptions({
      ...input,
    })
    expect(swapOptions).toBeDefined()

    expect(swapOptions!.type).toEqual(SwapType.UNIVERSAL_ROUTER)
  })

  it('Parses the slippageTolerance to a decimal if provided', () => {
    const input = UniversalRouterInputFactory.build({
      // 5% slippage
      slippageTolerance: '5',
    })

    const swapOptions = SwapOptionsFactory.createUniversalRouterOptions({
      ...input,
    })
    expect(swapOptions).toBeDefined()

    // 500 / 10_000 = 0.05 = 5%
    expect(swapOptions!.slippageTolerance).toEqual(new Percent(500, 10_000))
  })

  it('Returns undefined if slippageTolerance is undefined', () => {
    const input = UniversalRouterInputFactory.build({
      slippageTolerance: undefined,
    })

    const swapOptions = SwapOptionsFactory.createUniversalRouterOptions({ ...input })
    expect(swapOptions).toBeUndefined()
  })

  it('Sets the deadlineOrPreviousBlockHash if a deadline is provided', () => {
    const mockTimeInSeconds = 1_000_000
    jest.spyOn(Date, 'now').mockImplementation(() => mockTimeInSeconds)

    const deadline = '500'
    const input = UniversalRouterInputFactory.build({
      deadline: '500',
    })

    const swapOptions = SwapOptionsFactory.createUniversalRouterOptions({ ...input })
    expect(swapOptions).toBeDefined()

    // Deadline calculation is current time (mock time above) in milliseconds + the parsed deadline.
    const mockTimeInMilliseconds = mockTimeInSeconds / 1000

    expect(swapOptions!.deadlineOrPreviousBlockhash).toEqual(mockTimeInMilliseconds + parseInt(deadline))
  })

  it('Populates the "fee" field for an exactIn quote if all fee fields are provided', () => {
    const input = UniversalRouterInputFactory.withFees().build({
      tradeType: 'exactIn',
    })

    const swapOptions = SwapOptionsFactory.createUniversalRouterOptions({ ...input })
    expect(swapOptions).toBeDefined()

    expect(swapOptions!.fee).toBeDefined()
    expect(swapOptions!.fee).toEqual({
      recipient: 'portionRecipient',
      fee: new Percent(100, 10_000),
    })

    // flatFee should only be defined for exactOut quotes
    expect(swapOptions!.flatFee).toBeUndefined()
  })

  it('Populates the "flatFee" field for an exactOut quote if all fee fields are provided', () => {
    const input = UniversalRouterInputFactory.withFees().build({
      tradeType: 'exactOut',
    })

    const swapOptions = SwapOptionsFactory.createUniversalRouterOptions({ ...input })
    expect(swapOptions).toBeDefined()

    expect(swapOptions!.flatFee).toBeDefined()
    expect(swapOptions!.flatFee).toEqual({
      amount: '25',
      recipient: 'portionRecipient',
    })

    expect(swapOptions!.fee).toBeUndefined()
  })

  it('Omits all fee fields if portionBips is undefined', () => {
    const input = UniversalRouterInputFactory.withFees().build({
      portionBips: undefined,
    })

    const swapOptions = SwapOptionsFactory.createUniversalRouterOptions({ ...input })
    expect(swapOptions).toBeDefined()

    expect(swapOptions!.fee).toBeUndefined()
    expect(swapOptions!.flatFee).toBeUndefined()
  })

  it('Omits all fee fields if portionRecipient is undefined', () => {
    const input = UniversalRouterInputFactory.withFees().build({
      portionRecipient: undefined,
    })

    const swapOptions = SwapOptionsFactory.createUniversalRouterOptions({ ...input })
    expect(swapOptions).toBeDefined()

    expect(swapOptions!.fee).toBeUndefined()
    expect(swapOptions!.flatFee).toBeUndefined()
  })

  it('Derives the fee field from the CurrencyOut if the portionAmount is undefined for an exactIn trade', () => {
    const input = UniversalRouterInputFactory.withFees().build({
      tradeType: 'exactIn',
      portionAmount: undefined,
    })

    const swapOptions = SwapOptionsFactory.createUniversalRouterOptions({ ...input })
    expect(swapOptions).toBeDefined()

    expect(swapOptions!.fee).toBeDefined()
    expect(swapOptions!.fee!).toEqual({
      recipient: 'portionRecipient',
      fee: new Percent(100, 10_000),
    })
  })

  it('Derives the fee field from the currencyOut and raw amount if the portionAmount is undefined for an exactIn trade', () => {
    const input = UniversalRouterInputFactory.withFees().build({
      tradeType: 'exactOut',
      portionAmount: undefined,
    })

    const swapOptions = SwapOptionsFactory.createUniversalRouterOptions({ ...input })
    expect(swapOptions).toBeDefined()

    expect(swapOptions!.flatFee).toBeDefined()
    expect(swapOptions!.flatFee!).toEqual({
      recipient: 'portionRecipient',
      amount: '25000000000000000',
    })
  })

  it('Populates the permit data if all permit fields are provided', () => {
    const input = UniversalRouterInputFactory.withPermits().build()

    const swapOptions = SwapOptionsFactory.createUniversalRouterOptions({ ...input })
    expect(swapOptions).toBeDefined()

    expect(swapOptions!.inputTokenPermit).toBeDefined()
    expect(swapOptions!.inputTokenPermit!).toEqual({
      details: {
        token: '0x0000000000000000000000000000000000000001',
        amount: 'permitAmount',
        expiration: 'permitExpiration',
        nonce: 'permitNonce',
      },
      spender: MAINNET_UNIVERSAL_ROUTER_ADDRESS,
      sigDeadline: 'permitSigDeadline',
      signature: 'permitSignature',
    })
  })

  it('Omits the permit data if permitSignature is missing', () => {
    const input = UniversalRouterInputFactory.withPermits().build({
      permitSignature: undefined,
    })

    const swapOptions = SwapOptionsFactory.createUniversalRouterOptions({ ...input })
    expect(swapOptions).toBeDefined()

    expect(swapOptions!.inputTokenPermit).toBeUndefined()
  })

  it('Omits the permit data if permitNonce is missing', () => {
    const input = UniversalRouterInputFactory.withPermits().build({
      permitNonce: undefined,
    })

    const swapOptions = SwapOptionsFactory.createUniversalRouterOptions({ ...input })
    expect(swapOptions).toBeDefined()

    expect(swapOptions!.inputTokenPermit).toBeUndefined()
  })

  it('Omits the permit data if permitExpiration is missing', () => {
    const input = UniversalRouterInputFactory.withPermits().build({
      permitExpiration: undefined,
    })

    const swapOptions = SwapOptionsFactory.createUniversalRouterOptions({ ...input })
    expect(swapOptions).toBeDefined()

    expect(swapOptions!.inputTokenPermit).toBeUndefined()
  })

  it('Omits the permit data if permitAmount is missing', () => {
    const input = UniversalRouterInputFactory.withPermits().build({
      permitAmount: undefined,
    })

    const swapOptions = SwapOptionsFactory.createUniversalRouterOptions({ ...input })
    expect(swapOptions).toBeDefined()

    expect(swapOptions!.inputTokenPermit).toBeUndefined()
  })

  it('Omits the permit data if permitSigDeadline is missing', () => {
    const input = UniversalRouterInputFactory.withPermits().build({
      permitSigDeadline: undefined,
    })

    const swapOptions = SwapOptionsFactory.createUniversalRouterOptions({ ...input })
    expect(swapOptions).toBeDefined()

    expect(swapOptions!.inputTokenPermit).toBeUndefined()
  })

  it('Includes the simulate field if the simulateFromAddress is passed', () => {
    const input = UniversalRouterInputFactory.withSimulation().build({})

    const swapOptions = SwapOptionsFactory.createUniversalRouterOptions({ ...input })
    expect(swapOptions).toBeDefined()

    expect(swapOptions!.simulate).toBeDefined()
    expect(swapOptions!.simulate!).toEqual({
      fromAddress: 'simulateFromAddress',
    })
  })

  it('Omits the simulate field if the simulateFromAddress is missing', () => {
    const input = UniversalRouterInputFactory.build({
      simulateFromAddress: undefined,
    })

    const swapOptions = SwapOptionsFactory.createUniversalRouterOptions({ ...input })
    expect(swapOptions).toBeDefined()

    expect(swapOptions!.simulate).toBeUndefined()
  })
})

class swapRouter02InputFactory extends Factory<SwapOptionsSwapRouter02Input> {
  withPermitNonceAndExpiration() {
    return this.params({
      permitSignature: 'permitSignature',
      permitNonce: 'permitNonce',
      permitExpiration: 'permitExpiration',
    })
  }

  withPermitAmountAndSigDeadline() {
    return this.params({
      permitSignature: 'permitSignature',
      permitAmount: 'permitAmount',
      permitSigDeadline: 'permitSigDeadline',
    })
  }

  withSimulation() {
    return this.params({
      simulateFromAddress: 'simulateFromAddress',
    })
  }
}

const SwapRouter02InputFactory = swapRouter02InputFactory.define(() => ({
  slippageTolerance: '0.5',
  deadline: '60',
  recipient: 'recipient',
  amountRaw: '100000000000000000',
}))

describe('SwapOptionsFactory - Swap Router 02', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  it('Sets the type to be SwapType.SWAP_ROUTER_02', () => {
    const input = SwapRouter02InputFactory.build()

    const swapOptions = SwapOptionsFactory.createSwapRouter02Options({
      ...input,
    })
    expect(swapOptions).toBeDefined()

    expect(swapOptions!.type).toEqual(SwapType.SWAP_ROUTER_02)
  })

  it('Parses the slippageTolerance to a decimal if provided', () => {
    const input = SwapRouter02InputFactory.build({
      // 5% slippage
      slippageTolerance: '5',
    })

    const swapOptions = SwapOptionsFactory.createSwapRouter02Options({
      ...input,
    })
    expect(swapOptions).toBeDefined()

    // 500 / 10_000 = 0.05 = 5%
    expect(swapOptions!.slippageTolerance).toEqual(new Percent(500, 10_000))
  })

  it('Returns undefined if slippageTolerance is undefined', () => {
    const input = SwapRouter02InputFactory.build({
      slippageTolerance: undefined,
    })

    const swapOptions = SwapOptionsFactory.createSwapRouter02Options({ ...input })
    expect(swapOptions).toBeUndefined()
  })

  it('Sets the deadline and recipient if both are provided', () => {
    const mockTimeInSeconds = 1_000_000
    jest.spyOn(Date, 'now').mockImplementation(() => mockTimeInSeconds)

    const deadline = '500'
    const input = SwapRouter02InputFactory.build({
      deadline: '500',
      recipient: 'recipient',
    })

    const swapOptions = SwapOptionsFactory.createSwapRouter02Options({ ...input })
    expect(swapOptions).toBeDefined()

    // Deadline calculation is current time (mock time above) in milliseconds + the parsed deadline.
    const mockTimeInMilliseconds = mockTimeInSeconds / 1000

    expect(swapOptions!.deadline).toEqual(mockTimeInMilliseconds + parseInt(deadline))
    expect(swapOptions!.recipient).toEqual('recipient')
  })

  // This preserves the existing behavior of the SwapRouter: if either
  // the deadline or recipient is undefined, the entire result is undefined.

  // Note that this is not the case for the UniversalRouter. Follow-up work: determine if this
  // should be applied to both.
  it('Returns undefined if the deadline is undefined', () => {
    const input = SwapRouter02InputFactory.build({
      deadline: undefined,
    })

    const swapOptions = SwapOptionsFactory.createSwapRouter02Options({ ...input })
    expect(swapOptions).toBeUndefined()
  })

  it('Returns undefined if the recipient is undefined', () => {
    const input = SwapRouter02InputFactory.build({
      recipient: undefined,
    })

    const swapOptions = SwapOptionsFactory.createSwapRouter02Options({ ...input })
    expect(swapOptions).toBeUndefined()
  })

  it('Splits the token signature if permitSignature, permitNonce, and permitExpiration are provided', () => {
    jest.spyOn(utils, 'splitSignature').mockImplementation(
      () =>
        ({
          v: 'v',
          r: 'r',
          s: 's',
        } as any)
    )
    const input = SwapRouter02InputFactory.withPermitNonceAndExpiration().build()

    const swapOptions = SwapOptionsFactory.createSwapRouter02Options({ ...input })
    expect(swapOptions).toBeDefined()

    expect(swapOptions!.inputTokenPermit).toBeDefined()
    expect(swapOptions!.inputTokenPermit!).toEqual({
      v: 'v',
      r: 'r',
      s: 's',
      nonce: 'permitNonce',
      expiry: 'permitExpiration',
    })
  })

  it('Splits the token signature if permitSignature, permitAmount, and permitSigDeadline are provided', () => {
    jest.spyOn(utils, 'splitSignature').mockImplementation(
      () =>
        ({
          v: 'v',
          r: 'r',
          s: 's',
        } as any)
    )
    const input = SwapRouter02InputFactory.withPermitAmountAndSigDeadline().build()

    const swapOptions = SwapOptionsFactory.createSwapRouter02Options({ ...input })
    expect(swapOptions).toBeDefined()

    expect(swapOptions!.inputTokenPermit).toBeDefined()
    expect(swapOptions!.inputTokenPermit!).toEqual({
      v: 'v',
      r: 'r',
      s: 's',
      amount: 'permitAmount',
      deadline: 'permitSigDeadline',
    })
  })

  it('Omits the permit details if the signature is missing', () => {
    const input = SwapRouter02InputFactory.withPermitAmountAndSigDeadline().build({
      permitSignature: undefined,
    })

    const swapOptions = SwapOptionsFactory.createSwapRouter02Options({ ...input })
    expect(swapOptions).toBeDefined()

    expect(swapOptions!.inputTokenPermit).toBeUndefined()
  })

  it('Includes the simulate field if the simulateFromAddress is passed', () => {
    const input = SwapRouter02InputFactory.withSimulation().build()

    const swapOptions = SwapOptionsFactory.createSwapRouter02Options({ ...input })
    expect(swapOptions).toBeDefined()

    expect(swapOptions!.simulate).toBeDefined()
    expect(swapOptions!.simulate!).toEqual({
      fromAddress: 'simulateFromAddress',
    })
  })

  it('Omits the simulate field if the simulateFromAddress is missing', () => {
    const input = SwapRouter02InputFactory.build({
      simulateFromAddress: undefined,
    })

    const swapOptions = SwapOptionsFactory.createSwapRouter02Options({ ...input })
    expect(swapOptions).toBeDefined()

    expect(swapOptions!.simulate).toBeUndefined()
  })
})
