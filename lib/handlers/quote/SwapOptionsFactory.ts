import { ChainId, Currency, CurrencyAmount } from '@uniswap/sdk-core'
import { IMetric, MetricLoggerUnit, SwapOptions, SwapType } from '@uniswap/smart-order-router'
import JSBI from 'jsbi'
import { TradeTypeParam } from './schema/quote-schema'
import { computePortionAmount, parseDeadline, parseSlippageTolerance, populateFeeOptions } from '../shared'
import { PermitSingle } from '@uniswap/permit2-sdk'
import { UNIVERSAL_ROUTER_ADDRESS } from '@uniswap/universal-router-sdk'
import { utils } from 'ethers'

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
    let swapParams: SwapOptions | undefined = undefined

    // e.g. Inputs of form "1.25%" with 2dp max. Convert to fractional representation => 1.25 => 125 / 10000
    if (slippageTolerance) {
      const slippageTolerancePercent = parseSlippageTolerance(slippageTolerance)

      // TODO: Remove once universal router is no longer behind a feature flag.
      if (enableUniversalRouter) {
        const allFeeOptions = populateFeeOptions(
          tradeType,
          portionBips,
          portionRecipient,
          portionAmount ??
            computePortionAmount(CurrencyAmount.fromRawAmount(currencyOut, JSBI.BigInt(amountRaw)), portionBips)
        )

        swapParams = {
          type: SwapType.UNIVERSAL_ROUTER,
          deadlineOrPreviousBlockhash: deadline ? parseDeadline(deadline) : undefined,
          recipient: recipient,
          slippageTolerance: slippageTolerancePercent,
          ...allFeeOptions,
        }
      } else {
        if (deadline && recipient) {
          swapParams = {
            type: SwapType.SWAP_ROUTER_02,
            deadline: parseDeadline(deadline),
            recipient: recipient,
            slippageTolerance: slippageTolerancePercent,
          }
        }
      }

      if (
        enableUniversalRouter &&
        permitSignature &&
        permitNonce &&
        permitExpiration &&
        permitAmount &&
        permitSigDeadline
      ) {
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

        if (swapParams) {
          swapParams.inputTokenPermit = {
            ...permit,
            signature: permitSignature,
          }
        }
      } else if (
        !enableUniversalRouter &&
        permitSignature &&
        ((permitNonce && permitExpiration) || (permitAmount && permitSigDeadline))
      ) {
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
    }
    return swapParams
  }
}
