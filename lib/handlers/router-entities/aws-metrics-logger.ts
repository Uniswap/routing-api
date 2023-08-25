import { MetricsLogger as AWSEmbeddedMetricsLogger } from 'aws-embedded-metrics'
import { IMetric, MetricLoggerUnit } from '../../sor'

export class AWSMetricsLogger implements IMetric {
  constructor(private awsMetricLogger: AWSEmbeddedMetricsLogger) {}

  public putDimensions(dimensions: Record<string, string>): void {
    this.awsMetricLogger.putDimensions(dimensions)
  }

  public putMetric(key: string, value: number, unit?: MetricLoggerUnit): void {
    this.awsMetricLogger.putMetric(key, value, unit)
  }

  public setProperty(key: string, value: unknown): void {
    this.awsMetricLogger.setProperty(key, value)
  }
}
