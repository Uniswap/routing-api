import { ChainId, ISubgraphProvider, log, SubgraphPool, SubgraphProvider } from '@uniswap/smart-order-router'
import { S3 } from 'aws-sdk'
import NodeCache from 'node-cache'

const POOL_CACHE = new NodeCache({ stdTTL: 240, useClones: false })
const POOL_CACHE_KEY = (chainId: ChainId) => `pools${chainId}`

export class AWSSubgraphProvider extends SubgraphProvider implements ISubgraphProvider {
  private key: string

  constructor(private chain: ChainId, private bucket: string, key: string) {
    super(chain)
    this.key = `${key}${chain != ChainId.MAINNET ? `-${chain}` : ''}`
  }

  public async getPools(): Promise<SubgraphPool[]> {
    const s3 = new S3()

    log.debug({ cacheStats: POOL_CACHE.getStats() }, 'Subgraph pool cache status')

    const cachedPools = POOL_CACHE.get<SubgraphPool[]>(POOL_CACHE_KEY(this.chain))

    if (cachedPools) {
      log.info(
        { subgraphPoolsSample: cachedPools.slice(0, 5) },
        `Subgraph pools fetched from local cache. Num: ${cachedPools.length}`
      )

      return cachedPools
    }

    log.info({ bucket: this.bucket, key: this.key }, 'Subgraph pools local cache miss. Getting subgraph pools from S3')
    try {
      const result = await s3.getObject({ Key: this.key, Bucket: this.bucket }).promise()

      const { Body: poolsBuffer } = result

      if (!poolsBuffer) {
        throw new Error('Could not get subgraph pool cache from S3')
      }

      const pools = JSON.parse(poolsBuffer.toString('utf-8')) as SubgraphPool[]

      log.info({ bucket: this.bucket, key: this.key }, `Got subgraph pools from S3. Num: ${pools.length}`)

      POOL_CACHE.set<SubgraphPool[]>(POOL_CACHE_KEY(this.chain), pools)

      return pools
    } catch (err) {
      log.info({ bucket: this.bucket, key: this.key }, `Failed to get subgraph pools from S3.`)

      return super.getPools()
    }
  }
}
