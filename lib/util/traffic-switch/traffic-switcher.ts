import { log, metric, MetricLoggerUnit } from '@uniswap/smart-order-router'

export interface TrafficSwitcherProps<TExperiment> {
  control: TExperiment
  treatment: TExperiment
  aliasControl: string
  aliasTreatment: string
  customization: TrafficSwitchCustomization
}

export interface TrafficSwitchCustomization {
  // pctEnabled is the percentage of traffic that will be switched to treatment
  pctEnabled: number
  // pctShadowSampling is the percentage of traffic that will be compared between control and treatment
  pctShadowSampling: number
}

/*
  This class is a base class that can be used for traffic switching or sampling between two implementations of an interface.
  It provides the ability to switch traffic between two implementations based on a percentage,
  or to sample traffic between two implementations based on a percentage (one or the other, not both at the same time).
  ExperimentName, aliasControl and aliasTreatment are unique identifiers and will be used for logging purposes.
 */
export abstract class TrafficSwitcher<TExperiment> {
  public static readonly METRIC_NAME_TEMPLATE: string = 'TRAFFIC_SWITCHER__{EXP}__{METHOD}__{METRIC}'

  // Used for logging purposes.
  protected readonly experimentName: string
  protected readonly props: TrafficSwitcherProps<TExperiment>

  constructor(experimentName: string, props: TrafficSwitcherProps<TExperiment>) {
    if (props.customization.pctEnabled < 0 || props.customization.pctEnabled > 1) {
      throw new Error('Percentages must be between 0 and 1')
    }
    if (props.customization.pctEnabled > 0 && props.customization.pctShadowSampling > 0) {
      throw new Error('Only one of pctEnabled and pctShadowSampling can be greater than 0')
    }

    this.experimentName = experimentName
    this.props = props
  }

  /* This method will do one of the following:
   *  - Switch traffic between two implementations based on the pctEnabled percentage
   *  - Sample traffic between two implementations based on the pctShadowSampling percentage
   * Please note that sampling is done on a per method call basis.
   * If a method is called multiple times during a request, it might or might not be sampled/traffic switched multiple times.
   * TODO: Implement a way to sample/switch traffic on a per request basis (e.g. based on a requestId).
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
          [methodA(), this.props.aliasControl, methodName],
          [methodB(), this.props.aliasTreatment, methodName],
        ])

        // Compare the results if a comparison method is provided
        if (results && results.length == 2) {
          try {
            comparisonMethod && comparisonMethod(results[0], results[1])
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
      if (Math.random() < this.props.customization.pctEnabled) {
        this.logMetric(methodName, `SELECTED_IMPL__${this.props.aliasTreatment}`)
        return methodB()
      } else {
        this.logMetric(methodName, `SELECTED_IMPL__${this.props.aliasControl}`)
        return methodA()
      }
    }
  }

  protected isSamplingEnabled(): boolean {
    return this.props.customization.pctShadowSampling > 0
  }

  protected shouldSample(): boolean {
    return this.isSamplingEnabled() && Math.random() < this.props.customization.pctShadowSampling
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
