import { IV3PoolProvider, V3PoolAccessor } from '@uniswap/smart-order-router'
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
    const targetProviderPools = await this.targetPoolProvider.getPools(tokenPairs, providerConfig)

    const sampleTraffic = this.SHOULD_SAMPLE_TRAFFIC()
    if (sampleTraffic) {
      // If we need to sample the traffic, we don't want to make it a blocking I/O
      this.sampleTraffic(tokenPairs, currentProviderPools, targetProviderPools, providerConfig)
    }

    const switchTraffic = this.SHOULD_SWITCH_TRAFFIC()
    if (switchTraffic) {
      return currentProviderPools
    } else {
      return targetProviderPools
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
        // TODO: emit current inaccurate metric
      } else {
        const sameQuote = currentProviderPool.token0Price.scalar.equalTo(pool.token0Price.scalar)

        if (!sameQuote) {
          // TODO: emit current inaccurate metric
        } else {
          // TODO: emit current accurate metric
        }
      }

      const targetProviderPool = targetProviderPools.getPool(pool.token0, pool.token1, pool.fee)
      if (!targetProviderPool) {
        // TODO: emit target inaccurate metric
      } else {
        const sameQuote = targetProviderPool.token0Price.scalar.equalTo(targetProviderPool.token0Price.scalar)

        if (!sameQuote) {
          // TODO: emit target inaccurate metric
        } else {
          // TODO: emit target inaccurate metric
        }
      }
    })
  }

  private getRandomPercentage(): number {
    return Math.floor(Math.random() * 100)
  }
}