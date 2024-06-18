import { TrafficSwitcher } from './traffic-switcher'
import { ITokenFeeFetcher, TokenFeeMap } from '@uniswap/smart-order-router/build/main/providers/token-fee-fetcher'
import { ProviderConfig } from '@uniswap/smart-order-router/build/main/providers/provider'
import { log } from '@uniswap/smart-order-router'

type Address = string

export class TrafficSwitcherITokenFeeFetcher extends TrafficSwitcher<ITokenFeeFetcher> implements ITokenFeeFetcher {
  async fetchFees(addresses: Address[], providerConfig?: ProviderConfig): Promise<TokenFeeMap> {
    return this.trafficSwitchMethod(
      () => this.props.control.fetchFees(addresses, providerConfig),
      () => this.props.treatment.fetchFees(addresses, providerConfig),
      this.fetchFees.name,
      {},
      this.compareResultsForFetchFees.bind(this)
    )
  }

  private compareResultsForFetchFees(resultA: TokenFeeMap | undefined, resultB: TokenFeeMap | undefined): void {
    // Check if both results are undefined or only one of them is. If so, log and return
    if (!resultA && !resultB) {
      this.logComparisonResult(this.fetchFees.name, 'IDENTICAL', true)
      return
    }
    if (!resultA) {
      this.logComparisonResult(this.fetchFees.name, this.props.aliasControl + '_IS_UNDEFINED', true)
      return
    }
    if (!resultB) {
      this.logComparisonResult(this.fetchFees.name, this.props.aliasTreatment + '_IS_UNDEFINED', true)
      return
    }

    // We have results from both implementations, compare them as a whole
    const identical = JSON.stringify(resultA) === JSON.stringify(resultB)
    this.logComparisonResult(this.fetchFees.name, 'IDENTICAL', identical)

    // Go deeper and let's do more granular custom comparisons
    if (!identical) {
      // Compare the number of results
      const comparisonResultLength = Object.keys(resultA).length === Object.keys(resultB).length
      this.logComparisonResult(this.fetchFees.name, 'LENGTHS_MATCH', comparisonResultLength)

      // find and log the differences: what's missing in A, what's missing in B, and what's different
      const keysA = Object.keys(resultA)
      const keysB = Object.keys(resultB)
      const missingInA = keysB.filter((k) => !keysA.includes(k))
      const missingInB = keysA.filter((k) => !keysB.includes(k))
      missingInA.forEach((k) =>
        this.logMetric(this.fetchFees.name, 'MISSING_IN_' + this.props.aliasControl + '__Address__' + k)
      )
      missingInB.forEach((k) =>
        this.logMetric(this.fetchFees.name, 'MISSING_IN_' + this.props.aliasTreatment + '__Address__' + k)
      )
      // find common keys with diffs
      const commonKeys = keysA.filter((k) => keysB.includes(k))
      const commonKeysWithDifferentFees = commonKeys.filter(
        (k) => JSON.stringify(resultA[k]) !== JSON.stringify(resultB[k])
      )
      commonKeysWithDifferentFees.forEach((k) => {
        this.logMetric(this.fetchFees.name, 'DIFFERENT_FEE_FOR__Address__' + k)
        log.warn(
          `TrafficSwitcherITokenFeeFetcher compareResultsForFetchFees: Different fee for address ${k}:  in control: ${JSON.stringify(
            resultA[k]
          )} and treatment: ${JSON.stringify(resultB[k])}`
        )
      })
    }
  }
}
