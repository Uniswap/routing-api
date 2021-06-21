import { IMetricLogger, MetricLoggerUnit } from '@uniswap/smart-order-router';
import { MetricsLogger as AWSEmbeddedMetricsLogger } from 'aws-embedded-metrics';
import Logger from 'bunyan';

export class AWSMetricsLogger implements IMetricLogger {
  constructor(
    private awsMetricLogger: AWSEmbeddedMetricsLogger,
    private log: Logger
  ) {}

  public putDimensions(dimensions: Record<string, string>): void {
    this.awsMetricLogger.putDimensions(dimensions);
  }

  public putMetric(key: string, value: number, unit?: MetricLoggerUnit): void {
    this.log.info({ key, value, unit }, `[Metric] ${key}: ${value} | ${unit}`);
    this.awsMetricLogger.putMetric(key, value, unit);
  }
}
