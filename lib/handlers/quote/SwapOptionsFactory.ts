import { ChainId, Currency, CurrencyAmount } from '@uniswap/sdk-core'
import { SwapOptions, SwapType } from '@uniswap/smart-order-router'
import JSBI from 'jsbi'
import { TradeTypeParam } from './schema/quote-schema'
import { computePortionAmount, parseDeadline, parseSlippageTolerance, populateFeeOptions } from '../shared'
import { PermitSingle } from '@uniswap/permit2-sdk'
import { UNIVERSAL_ROUTER_ADDRESS } from '@uniswap/universal-router-sdk'
import { utils } from 'ethers'

export type SwapOptionsFeeConfig = {
  portionBips?: number
  portionRecipient?: string
  portionAmount?: string
  amountRaw: string
}

export type SwapOptionsPermitConfig = {
  deadline?: string
  recipient?: string
  permitSignature?: string
  permitNonce?: string
  permitExpiration?: string
  permitAmount?: string
  permitSigDeadline?: string
}

type SwapOptionsInput = {
  chainId: ChainId
  currencyIn: Currency
  currencyOut: Currency
  tradeType: TradeTypeParam
  amountRaw: string
  slippageTolerance?: string
  enableUniversalRouter?: boolean
  portionBips?: number
  portionRecipient?: string
  portionAmount?: string
  deadline?: string
  recipient?: string
  permitSignature?: string
  permitNonce?: string
  permitExpiration?: string
  permitAmount?: string
  permitSigDeadline?: string
  simulateFromAddress?: string
}

export class SwapOptionsFactory {
  static assemble({
    chainId,
    currencyIn,
    currencyOut,
    tradeType,
    amountRaw,
    slippageTolerance,
    enableUniversalRouter,
    portionBips,
    portionRecipient,
    portionAmount,
    deadline,
    recipient,
    permitSignature,
    permitNonce,
    permitExpiration,
    permitAmount,
    permitSigDeadline,
    simulateFromAddress,
  }: SwapOptionsInput): SwapOptions | undefined {
    if (enableUniversalRouter) {
      return SwapOptionsFactory.createUniversalRouterOptions(
        chainId,
        currencyIn,
        currencyOut,
        tradeType,
        slippageTolerance,
        {
          portionBips,
          portionRecipient,
          portionAmount,
          amountRaw,
        },
        {
          deadline,
          recipient,
          permitSignature,
          permitNonce,
          permitExpiration,
          permitAmount,
          permitSigDeadline,
        },
        simulateFromAddress
      )
    } else {
      return SwapOptionsFactory.createSwapRouter02Options(
        slippageTolerance,
        {
          deadline,
          recipient,
          permitSignature,
          permitNonce,
          permitExpiration,
          permitAmount,
          permitSigDeadline,
        },
        simulateFromAddress
      )
    }
  }

  static createUniversalRouterOptions(
    chainId: ChainId,
    currencyIn: Currency,
    currencyOut: Currency,
    tradeType: TradeTypeParam,
    slippageTolerance: string | undefined,
    { portionBips, portionRecipient, portionAmount, amountRaw }: SwapOptionsFeeConfig,
    {
      deadline,
      recipient,
      permitSignature,
      permitNonce,
      permitExpiration,
      permitAmount,
      permitSigDeadline,
    }: SwapOptionsPermitConfig,
    simulateFromAddress: string | undefined
  ): SwapOptions | undefined {
    // slippageTolerance looks like it's required for both the UniversalRouter and SwapRouter02.
    // If it's undefined, we'll exit early and not request any call data generation from SOR.
    if (!slippageTolerance) {
      return undefined
    }

    const allFeeOptions = populateFeeOptions(
      tradeType,
      portionBips,
      portionRecipient,
      portionAmount ??
        computePortionAmount(CurrencyAmount.fromRawAmount(currencyOut, JSBI.BigInt(amountRaw)), portionBips)
    )

    const swapParams: SwapOptions = {
      type: SwapType.UNIVERSAL_ROUTER,
      deadlineOrPreviousBlockhash: deadline ? parseDeadline(deadline) : undefined,
      recipient: recipient,
      slippageTolerance: parseSlippageTolerance(slippageTolerance),
      ...allFeeOptions,
    }

    if (permitSignature && permitNonce && permitExpiration && permitAmount && permitSigDeadline) {
      const permit: PermitSingle = {
        details: {
          token: currencyIn.wrapped.address,
          amount: permitAmount,
          expiration: permitExpiration,
          nonce: permitNonce,
        },
        spender: UNIVERSAL_ROUTER_ADDRESS(chainId),
        sigDeadline: permitSigDeadline,
      }

      swapParams.inputTokenPermit = {
        ...permit,
        signature: permitSignature,
      }
    }

    if (simulateFromAddress) {
      swapParams.simulate = { fromAddress: simulateFromAddress }
    }
    return swapParams
  }

  static createSwapRouter02Options(
    slippageTolerance: string | undefined,
    {
      deadline,
      recipient,
      permitSignature,
      permitNonce,
      permitExpiration,
      permitAmount,
      permitSigDeadline,
    }: SwapOptionsPermitConfig,
    simulateFromAddress: string | undefined
  ): SwapOptions | undefined {
    // slippageTolerance looks like it's required for both the UniversalRouter and SwapRouter02.
    // If it's undefined, we'll exit early and not request any call data generation from SOR.
    if (!slippageTolerance) {
      return undefined
    }

    let swapParams: SwapOptions | undefined = undefined

    if (deadline && recipient) {
      swapParams = {
        type: SwapType.SWAP_ROUTER_02,
        deadline: parseDeadline(deadline),
        recipient: recipient,
        slippageTolerance: parseSlippageTolerance(slippageTolerance),
      }
    }

    if (permitSignature && ((permitNonce && permitExpiration) || (permitAmount && permitSigDeadline))) {
      const { v, r, s } = utils.splitSignature(permitSignature)

      if (swapParams) {
        swapParams.inputTokenPermit = {
          v: v as 0 | 1 | 27 | 28,
          r,
          s,
          ...(permitNonce && permitExpiration
            ? { nonce: permitNonce!, expiry: permitExpiration! }
            : { amount: permitAmount!, deadline: permitSigDeadline! }),
        }
      }
    }

    if (simulateFromAddress) {
      if (swapParams) {
        swapParams.simulate = { fromAddress: simulateFromAddress }
      }
    }
    return swapParams
  }
}
