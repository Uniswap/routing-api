import { log, metric, MetricLoggerUnit } from '@uniswap/smart-order-router'

/*
  This class is a base class that can be used for traffic switching or sampling between two implementations of an interface.
  It provides the ability to switch traffic between two implementations based on a percentage,
  or to sample traffic between two implementations based on a percentage (one or the other, not both at the same time).
  ExperimentName, aliasA and aliasB are unique identifiers and will be used for logging purposes.
 */
export abstract class TrafficSwitcher<T> {
  public static readonly METRIC_NAME_TEMPLATE: string = 'TRAFFIC_SWITCHER__{EXP}__{METHOD}__{METRIC}'

  // Used for logging purposes.
  protected readonly experimentName: string
  protected readonly aliasA: string
  protected readonly aliasB: string
  // 2 implementations of the interface that we want to switch traffic between.
  protected readonly implementationA: T
  protected readonly implementationB: T

  // pctTrafficSwitchToB is the percentage of traffic that will be switched to implementationB
  protected readonly pctTrafficSwitchToB: number
  // pctSamplingToCompare is the percentage of traffic that will be compared between implementationA and implementationB
  protected readonly pctSamplingToCompare: number

  constructor(
    experimentName: string,
    implementationA: T,
    implementationB: T,
    aliasA: string,
    aliasB: string,
    pctTrafficSwitchToB: number = 0.0,
    pctSamplingToCompare: number = 0.0
  ) {
    if (pctTrafficSwitchToB < 0 || pctTrafficSwitchToB > 1) {
      throw new Error('Percentages must be between 0 and 1')
    }
    if (pctTrafficSwitchToB > 0 && pctSamplingToCompare > 0) {
      throw new Error('Only one of pctTrafficSwitchToB and pctSamplingToCompare can be greater than 0')
    }

    this.experimentName = experimentName
    this.implementationA = implementationA
    this.implementationB = implementationB
    this.aliasA = aliasA
    this.aliasB = aliasB
    this.pctTrafficSwitchToB = pctTrafficSwitchToB
    this.pctSamplingToCompare = pctSamplingToCompare
  }

  /* This method will do one of the following:
   *  - Switch traffic between two implementations based on the pctTrafficSwitchToB percentage
   *  - Sample traffic between two implementations based on the pctSamplingToCompare percentage
   */
  protected async trafficSwitchMethod<K>(
    methodA: () => Promise<K>,
    methodB: () => Promise<K>,
    methodName: string,
    defaultReturnVal: K,
    comparisonMethod: ((resultA: K | undefined, resultB: K | undefined) => void) | undefined
  ): Promise<K> {
    if (this.isSamplingEnabled()) {
      if (this.shouldSample()) {
        this.logMetric(methodName, `COMPARISON_SAMPLE`)
        // If in sampling mode, and we should sample, call both implementations and compare results
        // Note: here we'll wait for both implementations to finish before comparing results.
        const results: (K | undefined)[] = await this.allSettled<K>([
          [methodA(), this.aliasA, methodName],
          [methodB(), this.aliasB, methodName],
        ])

        // Compare the results if a comparison method is provided
        if (results && results.length == 2) {
          try {
            if (comparisonMethod) {
              comparisonMethod(results[0], results[1])
            }
          } catch (error) {
            log.error(`Error in TrafficSwitcher comparison method ${methodName}`, error)
            this.logMetric(methodName, 'COMPARISON_ERROR')
          }
        }

        // Always return the result from the first implementation when in sampling mode, or default value.
        // Note: when in sampling mode, exceptions in sampling traffic are logged and ignored (default value is returned).
        return results && results.length > 0 ? results[0] ?? defaultReturnVal : defaultReturnVal
      } else {
        // If in sampling mode, but we are not sampling for this call, just call implementation A.
        return methodA()
      }
    } else {
      // Otherwise we are in switch traffic mode, just call the selected implementation based on the traffic switch percentage
      if (Math.random() < this.pctTrafficSwitchToB) {
        this.logMetric(methodName, `SELECTED_IMPL__${this.aliasB}`)
        return methodB()
      } else {
        this.logMetric(methodName, `SELECTED_IMPL__${this.aliasA}`)
        return methodA()
      }
    }
  }

  protected isSamplingEnabled(): boolean {
    return this.pctSamplingToCompare > 0
  }

  protected shouldSample(): boolean {
    return this.isSamplingEnabled() && Math.random() < this.pctSamplingToCompare
  }

  protected logComparisonResult(method: string, comparisonType: string, equals: boolean): void {
    const comparisonResult = equals ? 'YES' : 'NO'
    this.logMetric(method, `COMPARISON__${comparisonType}__RESULT__${comparisonResult}`)
  }

  protected logMetric(method: string, metricName: string): void {
    metric.putMetric(
      TrafficSwitcher.METRIC_NAME_TEMPLATE.replace('{EXP}', this.experimentName)
        .replace('{METHOD}', method)
        .replace('{METRIC}', metricName),
      1,
      MetricLoggerUnit.Count
    )
  }

  /* All promises are executed concurrently, and will wait for all of them to finish before returning the results */
  protected allSettled<K>(promises: [Promise<K>, string, string][]): Promise<(K | undefined)[]> {
    return Promise.all(
      promises.map(([promise, alias, method]) =>
        promise
          .then((value) => value)
          .catch((error) => {
            log.error(`TrafficSwitcher: Error in experiment ${this.experimentName} in ${method} for ${alias}`, error)
            this.logMetric(method, alias + '_EXCEPTION')
            return undefined
          })
      )
    )
  }
}
