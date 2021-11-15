import { ChainId, IV3SubgraphProvider, log, V3SubgraphPool, V3SubgraphProvider } from '@uniswap/smart-order-router'
import { S3 } from 'aws-sdk'
import _ from 'lodash'
import NodeCache from 'node-cache'

const POOL_CACHE = new NodeCache({ stdTTL: 240, useClones: false })
const POOL_CACHE_KEY = (chainId: ChainId) => `pools${chainId}`

export class V3AWSSubgraphProviderWithFallback extends V3SubgraphProvider implements IV3SubgraphProvider {
  private key: string

  constructor(private chain: ChainId, private bucket: string, key: string) {
    super(chain)
    this.key = `${key}${chain != ChainId.MAINNET ? `-${chain}` : ''}`
  }

  public async getPools(): Promise<V3SubgraphPool[]> {
    log.info(`In legacy AWS subgraph provider for protocol V3`)

    const s3 = new S3()

    const cachedPools = POOL_CACHE.get<V3SubgraphPool[]>(POOL_CACHE_KEY(this.chain))

    if (cachedPools) {
      log.info(
        { subgraphPoolsSample: cachedPools.slice(0, 5) },
        `Subgraph pools fetched from local cache. Num: ${cachedPools.length}`
      )

      return cachedPools
    }

    log.info(
      { bucket: this.bucket, key: this.key },
      `Subgraph pools local cache miss. Getting subgraph pools from S3 ${this.bucket}/${this.key}`
    )
    try {
      const result = await s3.getObject({ Key: this.key, Bucket: this.bucket }).promise()

      const { Body: poolsBuffer } = result

      if (!poolsBuffer) {
        throw new Error('Could not get subgraph pool cache from S3')
      }

      let pools = JSON.parse(poolsBuffer.toString('utf-8'))

      if (pools[0].totalValueLockedETH) {
        pools = _.map(
          pools,
          (pool) =>
            ({
              ...pool,
              id: pool.id.toLowerCase(),
              token0: {
                id: pool.token0.id.toLowerCase(),
              },
              token1: {
                id: pool.token1.id.toLowerCase(),
              },
              tvlETH: parseFloat(pool.totalValueLockedETH),
              tvlUSD: parseFloat(pool.totalValueLockedUSD),
            } as V3SubgraphPool)
        )
        log.info({ sample: pools.slice(0, 5) }, 'Converted legacy schema to new schema')
      }

      log.info(
        { bucket: this.bucket, key: this.key, sample: pools.slice(0, 3) },
        `Got subgraph pools from S3. Num: ${pools.length}`
      )

      POOL_CACHE.set<V3SubgraphPool[]>(POOL_CACHE_KEY(this.chain), pools)

      return pools
    } catch (err) {
      log.info(
        { bucket: this.bucket, key: this.key },
        `Failed to get subgraph pools from S3 ${this.bucket}/${this.key}.`
      )

      return super.getPools()
    }
  }
}
