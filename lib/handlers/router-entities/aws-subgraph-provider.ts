import { Protocol } from '@uniswap/router-sdk'
import {
  IV2SubgraphProvider,
  IV3SubgraphProvider,
  log,
  metric,
  MetricLoggerUnit,
  V2SubgraphPool,
  V3SubgraphPool,
} from '@uniswap/smart-order-router'
import { S3 } from 'aws-sdk'
import { ChainId } from '@uniswap/sdk-core'
import NodeCache from 'node-cache'
import { S3_POOL_CACHE_KEY } from '../../util/pool-cache-key'
import { PoolCachingFilePrefixes } from '../../util/poolCachingFilePrefixes'
import * as zlib from 'zlib'

const POOL_CACHE = new NodeCache({ stdTTL: 240, useClones: false })
const LOCAL_POOL_CACHE_KEY = (chainId: ChainId, protocol: Protocol) => `pools${chainId}#${protocol}`
const s3 = new S3({ correctClockSkew: true, maxRetries: 1 })

export class AWSSubgraphProvider<TSubgraphPool extends V2SubgraphPool | V3SubgraphPool> {
  constructor(private chain: ChainId, private protocol: Protocol, private bucket: string, private baseKey: string) {}

  public async getPools(): Promise<TSubgraphPool[]> {
    log.info(`In new AWS subgraph provider for protocol ${this.protocol}`)

    const cachedPools = POOL_CACHE.get<TSubgraphPool[]>(LOCAL_POOL_CACHE_KEY(this.chain, this.protocol))

    if (cachedPools) {
      log.info(
        { subgraphPoolsSample: cachedPools.slice(0, 5) },
        `Subgraph pools fetched from local cache for protocol ${this.protocol}. Num: ${cachedPools.length}`
      )

      return cachedPools
    }

    log.info(
      { bucket: this.bucket, key: this.baseKey },
      `Subgraph pools local cache miss for protocol ${this.protocol}. Getting subgraph pools from S3`
    )

    const pools = await cachePoolsFromS3<TSubgraphPool>(s3, this.bucket, this.baseKey, this.chain, this.protocol)

    return pools
  }
}

export const cachePoolsFromS3 = async <TSubgraphPool>(
  s3: S3,
  bucket: string,
  baseKey: string,
  chainId: ChainId,
  protocol: Protocol
) => {
  const key = S3_POOL_CACHE_KEY(baseKey, chainId, protocol)

  let result
  try {
    const before = Date.now()
    result = await s3.getObject({ Key: key, Bucket: bucket }).promise()
    const after = Date.now()

    // Since we don't set the s3 request timeout, it's possible that the lambda timeout, because we even see latency metrics getting logged
    // In case of increased lambda timeout due to cold start, we expect to see the sampling count of this latency metric to decrease
    metric.putMetric(`S3GetObjectLatency_key_${key}`, after - before, MetricLoggerUnit.Milliseconds)
    log.info(
      { bucket, key },
      `Downloaded s3 object for ${protocol} on ${chainId} with latency ${after - before} milliseconds.`
    )
  } catch (err) {
    log.error({ bucket, key, err }, `Failed to get pools from S3 for ${protocol} on chain ${chainId}`)
    throw new Error(`Failed to get pools from S3 for ${protocol} on chain ${chainId}`)
  }

  const { Body: poolsBuffer } = result

  if (!poolsBuffer) {
    throw new Error(`Could not get subgraph pool cache from S3 for protocol ${protocol} on chain ${chainId}`)
  }

  let poolString

  if (key.startsWith(PoolCachingFilePrefixes.GzipText)) {
    poolString = zlib.inflateSync(poolsBuffer as Buffer).toString('utf-8')
  } else {
    poolString = poolsBuffer.toString('utf-8')
  }

  const before = Date.now()
  const pools = JSON.parse(poolString) as TSubgraphPool[]
  const after = Date.now()

  log.info(
    { bucket, key },
    `Got subgraph pools from S3 for protocol ${protocol} on ${chainId}. Num: ${pools.length} with latency ${
      after - before
    } milliseconds.`
  )

  metric.putMetric(`S3GetObjectParseLatency_key_${key}`, after - before, MetricLoggerUnit.Milliseconds)

  POOL_CACHE.set<TSubgraphPool[]>(LOCAL_POOL_CACHE_KEY(chainId, protocol), pools)

  return pools
}

export class V3AWSSubgraphProvider extends AWSSubgraphProvider<V3SubgraphPool> implements IV3SubgraphProvider {
  constructor(chainId: ChainId, bucket: string, baseKey: string) {
    super(chainId, Protocol.V3, bucket, baseKey)
  }

  public static async EagerBuild(bucket: string, baseKey: string, chainId: ChainId): Promise<V3AWSSubgraphProvider> {
    await cachePoolsFromS3<V3SubgraphPool>(s3, bucket, baseKey, chainId, Protocol.V3)

    return new V3AWSSubgraphProvider(chainId, bucket, baseKey)
  }
}

export class V2AWSSubgraphProvider extends AWSSubgraphProvider<V2SubgraphPool> implements IV2SubgraphProvider {
  constructor(chainId: ChainId, bucket: string, key: string) {
    super(chainId, Protocol.V2, bucket, key)
  }

  public static async EagerBuild(bucket: string, baseKey: string, chainId: ChainId): Promise<V2AWSSubgraphProvider> {
    await cachePoolsFromS3<V2SubgraphPool>(s3, bucket, baseKey, chainId, Protocol.V2)

    return new V2AWSSubgraphProvider(chainId, bucket, baseKey)
  }
}
