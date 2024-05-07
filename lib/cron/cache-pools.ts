import { Protocol } from '@uniswap/router-sdk'
import { IMetric, setGlobalLogger, setGlobalMetric, V2SubgraphPool, V3SubgraphPool } from '@uniswap/smart-order-router'
import { EventBridgeEvent, ScheduledHandler } from 'aws-lambda'
import { S3 } from 'aws-sdk'
import { ChainId } from '@uniswap/sdk-core'
import { default as bunyan, default as Logger } from 'bunyan'
import { S3_POOL_CACHE_KEY } from '../util/pool-cache-key'
import { chainProtocols } from './cache-config'
import { AWSMetricsLogger } from '../handlers/router-entities/aws-metrics-logger'
import { metricScope } from 'aws-embedded-metrics'
import * as zlib from 'zlib'

const handler: ScheduledHandler = metricScope((metrics) => async (event: EventBridgeEvent<string, void>) => {
  const beforeAll = Date.now()
  metrics.setNamespace('Uniswap')
  metrics.setDimensions({ Service: 'CachePools' })
  const metric = new AWSMetricsLogger(metrics)
  setGlobalMetric(metric)

  const chainId: ChainId = parseInt(process.env.chainId!)
  const protocol = process.env.protocol! as Protocol
  // Don't retry for V2 as it will timeout and throw 500
  const provider = chainProtocols.find(
    (element) => element.protocol == protocol && element.chainId == chainId
  )!.provider
  const log: Logger = bunyan.createLogger({
    name: 'RoutingLambda',
    serializers: bunyan.stdSerializers,
    level: 'info',
    requestId: event.id,
  })
  setGlobalLogger(log)

  const s3 = new S3()

  log.info(`Getting pools for ${protocol} on ${chainId}`)
  const metricPrefix = `CachePools.chain_${chainId}.${protocol}_protocol`
  metric.putMetric(metricPrefix, 1)

  let pools
  try {
    const beforeGetPool = Date.now()
    pools = await provider.getPools()
    metric.putMetric(`${metricPrefix}.getPools.latency`, Date.now() - beforeGetPool)
  } catch (err) {
    metric.putMetric(`${metricPrefix}.getPools.error`, 1)
    log.error({ err }, `Failed to get pools for ${protocol} on ${chainId}`)
    throw new Error(`Failed to get pools for ${protocol} on ${chainId}`)
  }

  if (!pools || pools.length == 0) {
    metric.putMetric(`${metricPrefix}.getPools.empty`, 1)
    log.info(`No ${protocol} pools found from the subgraph for ${chainId.toString()}`)
    return
  }

  const beforeS3 = Date.now()
  const key = S3_POOL_CACHE_KEY(process.env.POOL_CACHE_KEY!, chainId, protocol)
  const compressedKey = S3_POOL_CACHE_KEY(process.env.POOL_CACHE_GZIP_KEY!, chainId, protocol)
  log.info(
    `Got ${
      pools.length
    } ${protocol} pools from the subgraph for ${chainId.toString()}. Saving to ${key} and ${compressedKey}`
  )

  const serializedPools = JSON.stringify(pools)
  const compressedPools = zlib.deflateSync(serializedPools)
  const [result, newResult] = await Promise.all([
    s3
      .putObject({
        Bucket: process.env.POOL_CACHE_BUCKET_2!,
        Key: key,
        Body: serializedPools,
      })
      .promise(),
    s3
      .putObject({
        Bucket: process.env.POOL_CACHE_BUCKET_3!,
        Key: compressedKey,
        Body: compressedPools,
      })
      .promise(),
  ])

  metric.putMetric(`${metricPrefix}.s3.latency`, Date.now() - beforeS3)

  log.info({ result, newResult }, `Done ${protocol} for ${chainId.toString()}`)

  log.info(
    `Successfully cached ${chainId} ${protocol} pools to S3 bucket ${process.env.POOL_CACHE_BUCKET_2} ${process.env.POOL_CACHE_BUCKET_3}`
  )
  metric.putMetric(`${metricPrefix}.latency`, Date.now() - beforeAll)

  log.info(
    `compression ratio for ${chainId} ${protocol} pool file is ${serializedPools.length}:${compressedPools.length}`
  )
  metric.putMetric(`${metricPrefix}.compression_ratio`, serializedPools.length / compressedPools.length)

  const beforeDecompress = Date.now()
  const decompressedPools = zlib.inflateSync(compressedPools)
  metric.putMetric(`${metricPrefix}.decompression_latency`, Date.now() - beforeDecompress)

  const parsedPools: V2SubgraphPool[] | V3SubgraphPool[] = JSON.parse(decompressedPools.toString())

  checkSum(pools, parsedPools, log, metric, chainId, protocol)
})

module.exports = { handler }

function checkSum(
  pools: V3SubgraphPool[] | V2SubgraphPool[],
  parsedPools: V3SubgraphPool[] | V2SubgraphPool[],
  log: bunyan,
  metric: IMetric,
  chainId: ChainId,
  protocol: Protocol
) {
  if (pools.length !== parsedPools.length) {
    log.error(
      `Checksum failed for ${chainId} ${protocol} pools. Expected ${pools.length} but got ${parsedPools.length}`
    )
    metric.putMetric(`CachePools.chain_${chainId}.${protocol}_protocol.checksum.pool_length_diff`, 0)
    return
  }

  const poolMap = new Map<string, V3SubgraphPool | V2SubgraphPool>()
  const parsedPoolMap = new Map<string, V3SubgraphPool | V2SubgraphPool>()

  pools.forEach((pool) => {
    poolMap.set(pool.id, pool)
  })

  parsedPools.forEach((pool) => {
    parsedPoolMap.set(pool.id, pool)
  })

  poolMap.forEach((pool, id) => {
    if (!parsedPoolMap.has(id)) {
      log.error(`Checksum failed for ${chainId} ${protocol} pools. Expected pool ${id} but got nothing`)
      metric.putMetric(`CachePools.chain_${chainId}.${protocol}_protocol.checksum.pool_${id}_diff`, 0)
      return
    }

    const parsedPool = parsedPoolMap.get(id)
    if (parsedPool) {
      if (JSON.stringify(pool) !== JSON.stringify(parsedPool)) {
        log.error(
          `Checksum failed for ${chainId} ${protocol} pools. Expected pool ${id} to be ${JSON.stringify(
            pool
          )} but got ${JSON.stringify(parsedPool)}`
        )
        metric.putMetric(`CachePools.chain_${chainId}.${protocol}_protocol.checksum.pool_${id}_diff`, 0)
        return
      }
    }
  })

  parsedPoolMap.forEach((parsedPool, id) => {
    if (!poolMap.has(id)) {
      log.error(`Checksum failed for ${chainId} ${protocol} pools. Expected nothing but got pool ${id}`)
      metric.putMetric(`CachePools.chain_${chainId}.${protocol}_protocol.checksum.pool_${id}_diff`, 0)
    }

    const pool = poolMap.get(id)
    if (pool) {
      if (JSON.stringify(parsedPool) !== JSON.stringify(pool)) {
        log.error(
          `Checksum failed for ${chainId} ${protocol} pools. Expected pool ${id} to be ${JSON.stringify(
            pool
          )} but got ${JSON.stringify(parsedPool)}`
        )
        metric.putMetric(`CachePools.chain_${chainId}.${protocol}_protocol.checksum.pool_${id}_diff`, 0)
      }
    }
  })

  log.info(`Checksum passed for ${chainId} ${protocol} pools on chainId`)
  metric.putMetric(`CachePools.chain_${chainId}.${protocol}_protocol.checksum.passed`, 1)
}
