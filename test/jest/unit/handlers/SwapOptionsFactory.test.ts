import { ChainId, Percent, Token } from '@uniswap/sdk-core'
import { TradeTypeParam } from '../../../../lib/handlers/quote/schema/quote-schema'
import { expect, jest } from '@jest/globals'
import { SwapType } from '@uniswap/smart-order-router'
import { UNIVERSAL_ROUTER_ADDRESS } from '@uniswap/universal-router-sdk'

import { utils } from 'ethers'
import { SwapOptionsFactory } from '../../../../lib/handlers/quote/SwapOptionsFactory'

const mockTime = 1_000_000

const MAINNET_UNIVERSAL_ROUTER_ADDRESS = UNIVERSAL_ROUTER_ADDRESS(ChainId.MAINNET)

describe('SwapOptionsFactory', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockImplementation(() => mockTime)
  })
  afterEach(() => {
    jest.resetAllMocks()
  })

  it('Coverage test - slippageTolerance=defined, enableUniversalRouter=true, permit provided, portions provided', () => {
    const chainId = ChainId.MAINNET
    const currencyIn = new Token(ChainId.MAINNET, '0x0000000000000000000000000000000000000001', 18, 'FOO', 'Foo')
    const tradeType: TradeTypeParam = 'exactIn'
    const currencyOut = new Token(ChainId.MAINNET, '0x0000000000000000000000000000000000000002', 18, 'BAR', 'Bar')

    const slippageTolerance = '0.5'

    const enableUniversalRouter = true

    const portionBips = 1
    const portionRecipient = 'portionRecipient'
    const portionAmount = '1'
    const amountRaw = '100000000000000000'

    const deadline = '60'
    const recipient = 'recipient'
    const permitSignature = 'permitSignature'
    const permitNonce = 'permitNonce'
    const permitExpiration = 'permitExpiration'
    const permitAmount = 'permitAmount'
    const permitSigDeadline = 'permitSigDeadline'
    const simulateFromAddress = 'simulateFromAddress'

    const metric = {
      putMetric: jest.fn(),
    } as any

    expect(
      SwapOptionsFactory.assemble(
        chainId,
        currencyIn,
        currencyOut,
        tradeType,
        slippageTolerance,
        enableUniversalRouter,
        portionBips,
        portionRecipient,
        portionAmount,
        amountRaw,
        deadline,
        recipient,
        permitSignature,
        permitNonce,
        permitExpiration,
        permitAmount,
        permitSigDeadline,
        simulateFromAddress,
        metric
      )
    ).toEqual({
      deadlineOrPreviousBlockhash: 1060,
      type: SwapType.UNIVERSAL_ROUTER,
      recipient: 'recipient',

      fee: {
        fee: new Percent(1, 10_000),
        recipient: 'portionRecipient',
      },

      simulate: {
        fromAddress: 'simulateFromAddress',
      },

      inputTokenPermit: {
        details: {
          amount: 'permitAmount',
          token: '0x0000000000000000000000000000000000000001',
          expiration: 'permitExpiration',
          nonce: 'permitNonce',
        },
        sigDeadline: 'permitSigDeadline',
        signature: 'permitSignature',
        spender: MAINNET_UNIVERSAL_ROUTER_ADDRESS,
      },

      slippageTolerance: new Percent(50, 10_000),
    })
  })

  it('Coverage test - enableUniversalRouter=false, permit provided, portions provided', () => {
    const chainId = ChainId.MAINNET
    const currencyIn = new Token(ChainId.MAINNET, '0x0000000000000000000000000000000000000001', 18, 'FOO', 'Foo')
    const currencyOut = new Token(ChainId.MAINNET, '0x0000000000000000000000000000000000000002', 18, 'BAR', 'Bar')
    const tradeType: TradeTypeParam = 'exactIn'

    const slippageTolerance = '0.5'

    const enableUniversalRouter = false

    const portionBips = 1
    const portionRecipient = 'portionRecipient'
    const portionAmount = '1'
    const amountRaw = '100000000000000000'

    const deadline = '60'
    const recipient = 'recipient'
    const permitSignature = 'permitSignature'
    const permitNonce = 'permitNonce'
    const permitExpiration = 'permitExpiration'
    const permitAmount = 'permitAmount'
    const permitSigDeadline = 'permitSigDeadline'
    const simulateFromAddress = 'simulateFromAddress'

    const metric = {
      putMetric: jest.fn(),
    } as any

    jest.spyOn(utils, 'splitSignature').mockImplementation(
      () =>
        ({
          v: 'v',
          r: 'r',
          s: 's',
        } as any)
    )
    expect(
      SwapOptionsFactory.assemble(
        chainId,
        currencyIn,
        currencyOut,
        tradeType,
        slippageTolerance,
        enableUniversalRouter,
        portionBips,
        portionRecipient,
        portionAmount,
        amountRaw,
        deadline,
        recipient,
        permitSignature,
        permitNonce,
        permitExpiration,
        permitAmount,
        permitSigDeadline,
        simulateFromAddress,
        metric
      )
    ).toEqual({
      deadline: 1060,
      type: SwapType.SWAP_ROUTER_02,
      recipient: 'recipient',

      simulate: {
        fromAddress: 'simulateFromAddress',
      },

      inputTokenPermit: {
        expiry: 'permitExpiration',
        nonce: 'permitNonce',
        r: 'r',
        s: 's',
        v: 'v',
      },

      slippageTolerance: new Percent(50, 10_000),
    })
  })

  it('Coverage test - returns undefined if slippageTolerance is undefined', () => {
    const chainId = ChainId.MAINNET
    const currencyIn = new Token(ChainId.MAINNET, '0x0000000000000000000000000000000000000001', 18, 'FOO', 'Foo')
    const tradeType: TradeTypeParam = 'exactIn'
    const currencyOut = new Token(ChainId.MAINNET, '0x0000000000000000000000000000000000000002', 18, 'BAR', 'Bar')

    const slippageTolerance = undefined

    const enableUniversalRouter = true

    const portionBips = 1
    const portionRecipient = 'portionRecipient'
    const portionAmount = '1'
    const amountRaw = '100000000000000000'

    const deadline = '60'
    const recipient = 'recipient'
    const permitSignature = 'permitSignature'
    const permitNonce = 'permitNonce'
    const permitExpiration = 'permitExpiration'
    const permitAmount = 'permitAmount'
    const permitSigDeadline = 'permitSigDeadline'
    const simulateFromAddress = 'simulateFromAddress'

    const metric = {
      putMetric: jest.fn(),
    } as any
    expect(
      SwapOptionsFactory.assemble(
        chainId,
        currencyIn,
        currencyOut,
        tradeType,
        slippageTolerance,
        enableUniversalRouter,
        portionBips,
        portionRecipient,
        portionAmount,
        amountRaw,
        deadline,
        recipient,
        permitSignature,
        permitNonce,
        permitExpiration,
        permitAmount,
        permitSigDeadline,
        simulateFromAddress,
        metric
      )
    ).toBeUndefined()
  })
})
