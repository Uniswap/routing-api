import { IV3PoolProvider, log, metric, MetricLoggerUnit, V3PoolAccessor } from '@uniswap/smart-order-router'
import { Token } from '@uniswap/sdk-core'
import { FeeAmount, Pool } from '@uniswap/v3-sdk'
import { ProviderConfig } from '@uniswap/smart-order-router/build/main/providers/provider'
import { POOL_PROVIDER_TRAFFIC_SWITCH_CONFIGURATION } from './pool-provider-traffic-switch-configuration'

export type TrafficSwitchPoolProviderProps = {
  currentPoolProvider: IV3PoolProvider
  targetPoolProvider: IV3PoolProvider
  sourceOfTruthPoolProvider: IV3PoolProvider
}

export class TrafficSwitchPoolProvider implements IV3PoolProvider {
  private readonly currentPoolProvider: IV3PoolProvider
  private readonly targetPoolProvider: IV3PoolProvider
  private readonly sourceOfTruthPoolProvider: IV3PoolProvider

  private readonly SHOULD_SWITCH_TRAFFIC = () =>
    POOL_PROVIDER_TRAFFIC_SWITCH_CONFIGURATION.switchPercentage > this.getRandomPercentage()
  private readonly SHOULD_SAMPLE_TRAFFIC = () =>
    POOL_PROVIDER_TRAFFIC_SWITCH_CONFIGURATION.samplingPercentage > this.getRandomPercentage()

  constructor({ currentPoolProvider, targetPoolProvider, sourceOfTruthPoolProvider }: TrafficSwitchPoolProviderProps) {
    this.currentPoolProvider = currentPoolProvider
    this.targetPoolProvider = targetPoolProvider
    this.sourceOfTruthPoolProvider = sourceOfTruthPoolProvider
  }

  getPoolAddress(
    tokenA: Token,
    tokenB: Token,
    feeAmount: FeeAmount
  ): {
    poolAddress: string
    token0: Token
    token1: Token
  } {
    // The underlying logic for getting the pool address is always from the
    // source of truth pool provider, and the result is deterministic.
    // It doesn't matter which pool provider we use, so we can start with the target
    // pool provider, which will delegate to the source of truth pool provider.
    return this.targetPoolProvider.getPoolAddress(tokenA, tokenB, feeAmount)
  }

  async getPools(tokenPairs: [Token, Token, FeeAmount][], providerConfig?: ProviderConfig): Promise<V3PoolAccessor> {
    const currentProviderPools = await this.currentPoolProvider.getPools(tokenPairs, providerConfig)

    metric.putMetric('V3_POOL_PROVIDER_POOL_TRAFFIC_TOTAL', 1, MetricLoggerUnit.None)
    const sampleTraffic = this.SHOULD_SAMPLE_TRAFFIC()
    if (sampleTraffic) {
      metric.putMetric('V3_POOL_PROVIDER_POOL_TRAFFIC_SAMPLING', 1, MetricLoggerUnit.None)
      const targetProviderPools = await this.targetPoolProvider.getPools(tokenPairs, providerConfig)

      // If we need to sample the traffic, we don't want to make it a blocking I/O
      this.sampleTraffic(tokenPairs, currentProviderPools, targetProviderPools, providerConfig)
    }

    const switchTraffic = this.SHOULD_SWITCH_TRAFFIC()
    if (!switchTraffic) {
      metric.putMetric('V3_POOL_PROVIDER_POOL_TRAFFIC_CURRENT', 1, MetricLoggerUnit.None)
      return currentProviderPools
    } else {
      metric.putMetric('V3_POOL_PROVIDER_POOL_TRAFFIC_TARGET', 1, MetricLoggerUnit.None)
      return await this.targetPoolProvider.getPools(tokenPairs, providerConfig)
    }
  }

  private async sampleTraffic(
    tokenPairs: [Token, Token, FeeAmount][],
    currentProviderPools: V3PoolAccessor,
    targetProviderPools: V3PoolAccessor,
    providerConfig?: ProviderConfig
  ): Promise<void> {
    const truthProviderPools = await this.sourceOfTruthPoolProvider.getPools(tokenPairs, providerConfig)

    truthProviderPools.getAllPools().forEach((pool: Pool) => {
      const currentProviderPool = currentProviderPools.getPool(pool.token0, pool.token1, pool.fee)
      if (!currentProviderPool) {
        // We don't expect missing pool, but export metric in case we see any
        metric.putMetric('V3_POOL_PROVIDER_POOL_CURRENT_MISSING', 1, MetricLoggerUnit.None)
        log.info(
          `v3 Pool ${pool.token0.symbol} ${pool.token1.symbol} ${pool.fee} not found in the current pool provider.`
        )
      } else {
        const sameQuote = currentProviderPool.token0Price.scalar.equalTo(pool.token0Price.scalar)

        if (!sameQuote) {
          log.info(`v3 Pool ${pool.token0.symbol} ${pool.token1.symbol} ${pool.fee} quote mismatch: 
            current ${currentProviderPool.token0Price.scalar} vs truth ${pool.token0Price.scalar}.`)
          metric.putMetric('V3_POOL_PROVIDER_POOL_CURRENT_ACCURACY_MISMATCH', 1, MetricLoggerUnit.None)
        } else {
          metric.putMetric('V3_POOL_PROVIDER_POOL_CURRENT_ACCURACY_MATCH', 1, MetricLoggerUnit.None)
        }
      }

      const targetProviderPool = targetProviderPools.getPool(pool.token0, pool.token1, pool.fee)
      if (!targetProviderPool) {
        // We don't expect missing pool, but export metric in case we see any
        metric.putMetric('V3_POOL_PROVIDER_POOL_TARGET_MISSING', 1, MetricLoggerUnit.None)
        log.info(
          `v3 Pool ${pool.token0.symbol} ${pool.token1.symbol} ${pool.fee} not found in the target pool provider.`
        )
      } else {
        const sameQuote = targetProviderPool.token0Price.scalar.equalTo(targetProviderPool.token0Price.scalar)

        if (!sameQuote) {
          log.info(`v3 Pool ${pool.token0.symbol} ${pool.token1.symbol} ${pool.fee} quote mismatch: 
            target ${targetProviderPool.token0Price.scalar} vs truth ${pool.token0Price.scalar}.`)
          metric.putMetric('V3_POOL_PROVIDER_POOL_TARGET_ACCURACY_MISMATCH', 1, MetricLoggerUnit.None)
        } else {
          metric.putMetric('V3_POOL_PROVIDER_POOL_TARGET_ACCURACY_MATCH', 1, MetricLoggerUnit.None)
        }
      }
    })
  }

  private getRandomPercentage(): number {
    return Math.floor(Math.random() * 100)
  }
}
