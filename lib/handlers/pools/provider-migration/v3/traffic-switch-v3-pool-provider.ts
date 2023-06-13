import { IV3PoolProvider, log, metric, MetricLoggerUnit, V3PoolAccessor } from '@uniswap/smart-order-router'
import { Token } from '@uniswap/sdk-core'
import { FeeAmount, Pool } from '@uniswap/v3-sdk'
import { ProviderConfig } from '@uniswap/smart-order-router/build/main/providers/provider'
import { POOL_PROVIDER_TRAFFIC_SWITCH_CONFIGURATION } from '../../util/pool-provider-traffic-switch-configuration'
import JSBI from 'jsbi'

export type TrafficSwitchPoolProviderProps = {
  currentPoolProvider: IV3PoolProvider
  targetPoolProvider: IV3PoolProvider
  sourceOfTruthPoolProvider: IV3PoolProvider
}

export class TrafficSwitchV3PoolProvider implements IV3PoolProvider {
  private readonly currentPoolProvider: IV3PoolProvider
  private readonly targetPoolProvider: IV3PoolProvider
  private readonly sourceOfTruthPoolProvider: IV3PoolProvider

  protected readonly SHOULD_SWITCH_TRAFFIC = () =>
    POOL_PROVIDER_TRAFFIC_SWITCH_CONFIGURATION.switchPercentage > this.getRandomPercentage()
  protected readonly SHOULD_SAMPLE_TRAFFIC = () =>
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
    const sampleTraffic = this.SHOULD_SAMPLE_TRAFFIC()
    const switchTraffic = this.SHOULD_SWITCH_TRAFFIC()
    let currentProviderPools
    let targetProviderPools

    metric.putMetric('V3_POOL_PROVIDER_POOL_TRAFFIC_TOTAL', 1, MetricLoggerUnit.None)

    if (sampleTraffic) {
      metric.putMetric('V3_POOL_PROVIDER_POOL_TRAFFIC_SAMPLING', 1, MetricLoggerUnit.None)

      currentProviderPools = await this.currentPoolProvider.getPools(tokenPairs, providerConfig)
      targetProviderPools = await this.targetPoolProvider.getPools(tokenPairs, providerConfig)
      // If we need to sample the traffic, we don't want to make it a blocking I/O
      this.sampleTraffic(tokenPairs, currentProviderPools, targetProviderPools, providerConfig)
    }

    if (switchTraffic) {
      metric.putMetric('V3_POOL_PROVIDER_POOL_TRAFFIC_TARGET', 1, MetricLoggerUnit.None)

      return targetProviderPools ?? (await this.targetPoolProvider.getPools(tokenPairs, providerConfig))
    } else {
      metric.putMetric('V3_POOL_PROVIDER_POOL_TRAFFIC_CURRENT', 1, MetricLoggerUnit.None)

      return currentProviderPools ?? (await this.currentPoolProvider.getPools(tokenPairs, providerConfig))
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
        const sameQuote = JSBI.equal(currentProviderPool.sqrtRatioX96, pool.sqrtRatioX96)
        const sameLiquidity = JSBI.equal(currentProviderPool.liquidity, pool.liquidity)
        const accurate = sameQuote && sameLiquidity

        if (!sameQuote) {
          log.info(`v3 Pool ${pool.token0.symbol} ${pool.token1.symbol} ${pool.fee} quote mismatch: 
            current ${currentProviderPool.sqrtRatioX96} vs truth ${pool.sqrtRatioX96}.`)

          metric.putMetric('V3_POOL_PROVIDER_POOL_CURRENT_QUOTE_MISMATCH', 1, MetricLoggerUnit.None)
        }

        if (!sameLiquidity) {
          log.info(`v3 Pool ${pool.token0.symbol} ${pool.token1.symbol} ${pool.fee} liquidity mismatch: 
            current ${currentProviderPool.liquidity} vs truth ${pool.liquidity}.`)

          metric.putMetric('V3_POOL_PROVIDER_POOL_CURRENT_LIQUIDITY_MISMATCH', 1, MetricLoggerUnit.None)
        }

        if (!accurate) {
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
        const sameQuote = JSBI.equal(targetProviderPool.sqrtRatioX96, pool.sqrtRatioX96)
        const sameLiquidity = JSBI.equal(targetProviderPool.liquidity, pool.liquidity)
        const accurate = sameQuote && sameLiquidity

        if (!sameQuote) {
          log.info(`v3 Pool ${pool.token0.symbol} ${pool.token1.symbol} ${pool.fee} quote mismatch: 
            target ${targetProviderPool.sqrtRatioX96} vs truth ${pool.sqrtRatioX96}.`)

          metric.putMetric('V3_POOL_PROVIDER_POOL_TARGET_QUOTE_MISMATCH', 1, MetricLoggerUnit.None)
        }

        if (!sameLiquidity) {
          log.info(`v3 Pool ${pool.token0.symbol} ${pool.token1.symbol} ${pool.fee} liquidity mismatch: 
            target ${targetProviderPool.liquidity} vs truth ${pool.liquidity}.`)

          metric.putMetric('V3_POOL_PROVIDER_POOL_TARGET_LIQUIDITY_MISMATCH', 1, MetricLoggerUnit.None)
        }

        if (!accurate) {
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
