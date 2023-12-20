import { ChainId, Currency, CurrencyAmount } from '@uniswap/sdk-core'
import { IMetric, MetricLoggerUnit, SwapOptions, SwapType } from '@uniswap/smart-order-router'
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

export class SwapOptionsFactory {
  static assemble(
    chainId: ChainId,
    currencyIn: Currency,
    currencyOut: Currency,
    tradeType: TradeTypeParam,
    slippageTolerance: string | undefined,
    enableUniversalRouter: boolean | undefined,
    portionBips: number | undefined,
    portionRecipient: string | undefined,
    portionAmount: string | undefined,
    amountRaw: string,
    deadline: string | undefined,
    recipient: string | undefined,
    permitSignature: string | undefined,
    permitNonce: string | undefined,
    permitExpiration: string | undefined,
    permitAmount: string | undefined,
    permitSigDeadline: string | undefined,
    simulateFromAddress: string | undefined,
    metric: IMetric
  ): SwapOptions | undefined {
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
        simulateFromAddress,
        metric
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
        simulateFromAddress,
        metric
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
    simulateFromAddress: string | undefined,
    metric: IMetric
  ): SwapOptions | undefined {
    // slippageTolerance looks like it's required for both the UniversalRouter and SwapRouter02.
    // If it's undefined, we'll exit early and not request any call data generation from SOR.
    if (!slippageTolerance) {
      return undefined
    }

    // e.g. Inputs of form "1.25%" with 2dp max. Convert to fractional representation => 1.25 => 125 / 10000
    const slippageTolerancePercent = parseSlippageTolerance(slippageTolerance)

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
      slippageTolerance: slippageTolerancePercent,
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
      metric.putMetric('Simulation Requested', 1, MetricLoggerUnit.Count)

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
    simulateFromAddress: string | undefined,
    metric: IMetric
  ): SwapOptions | undefined {
    // slippageTolerance looks like it's required for both the UniversalRouter and SwapRouter02.
    // If it's undefined, we'll exit early and not request any call data generation from SOR.
    if (!slippageTolerance) {
      return undefined
    }

    let swapParams: SwapOptions | undefined = undefined

    // e.g. Inputs of form "1.25%" with 2dp max. Convert to fractional representation => 1.25 => 125 / 10000
    const slippageTolerancePercent = parseSlippageTolerance(slippageTolerance)

    if (deadline && recipient) {
      swapParams = {
        type: SwapType.SWAP_ROUTER_02,
        deadline: parseDeadline(deadline),
        recipient: recipient,
        slippageTolerance: slippageTolerancePercent,
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
      metric.putMetric('Simulation Requested', 1, MetricLoggerUnit.Count)

      if (swapParams) {
        swapParams.simulate = { fromAddress: simulateFromAddress }
      }
    }
    return swapParams
  }
}
