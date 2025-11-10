import { Protocol } from '@uniswap/router-sdk'
import {
  setGlobalLogger,
  setGlobalMetric,
  V3SubgraphPool,
  V3SubgraphProvider,
} from '@uniswap/smart-order-router'
import { EventBridgeEvent, ScheduledHandler } from 'aws-lambda'
import { S3 } from 'aws-sdk'
import { ChainId } from '@uniswap/sdk-core'
import { default as bunyan, default as Logger } from 'bunyan'
import { S3_POOL_CACHE_KEY } from '../util/pool-cache-key'
import { chainProtocols, v3SubgraphUrlOverride, v3TrackedEthThreshold } from './cache-config'
import { AWSMetricsLogger } from '../handlers/router-entities/aws-metrics-logger'
import { metricScope } from 'aws-embedded-metrics'
import * as zlib from 'zlib'
import dotenv from 'dotenv'

// Needed for local dev, not needed for staging or prod
dotenv.config()

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

    // V2 not supported - entire V2 mainnet section removed for V3-only deployment

    if (protocol === Protocol.V3 && chainId === ChainId.MAINNET) {
      const v3MainnetSubgraphProvider = new V3SubgraphProvider(
        ChainId.MAINNET,
        3,
        90000,
        true,
        v3TrackedEthThreshold,
        0, // wstETH/USDC totalValueLockedUSDUntracked is 0, but the pool balance (https://app.uniswap.org/explore/pools/ethereum/0x4622df6fb2d9bee0dcdacf545acdb6a2b2f4f863) is sufficiently hight
        v3SubgraphUrlOverride(ChainId.MAINNET)
      )
      const additionalPools = await v3MainnetSubgraphProvider.getPools()
      const filteredPools = additionalPools.filter((pool: V3SubgraphPool) => {
        const shouldFilter = pool.id.toLowerCase() === '0x4622df6fb2d9bee0dcdacf545acdb6a2b2f4f863'

        if (shouldFilter) {
          log.info(`Filtering pool ${pool.id} from ${protocol} on ${chainId}`)
        }
        return shouldFilter
      })
      filteredPools.forEach((pool) => pools.push(pool))

      pools = (pools as Array<V3SubgraphPool>).filter((pool: V3SubgraphPool) => {
        const shouldFilterOut =
          // filter out AMPL-token pools from v3 subgraph, since they are not supported on v3
          pool.token0.id.toLowerCase() === '0xd46ba6d942050d489dbd938a2c909a5d5039a161' ||
          pool.token1.id.toLowerCase() === '0xd46ba6d942050d489dbd938a2c909a5d5039a161' ||
          // https://linear.app/uniswap/issue/CX-1005
          pool.id.toLowerCase() === '0x0f681f10ab1aa1cde04232a199fe3c6f2652a80c'

        if (shouldFilterOut) {
          log.info(`Filtering out pool ${pool.id} from ${protocol} on ${chainId}`)
        }

        return !shouldFilterOut
      })
    }


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
  const compressedKey = S3_POOL_CACHE_KEY(process.env.POOL_CACHE_GZIP_KEY!, chainId, protocol)
  log.info(
    `Got ${pools.length} ${protocol} pools from the subgraph for ${chainId.toString()}. Saving to ${compressedKey}`
  )

  const serializedPools = JSON.stringify(pools)
  const compressedPools = zlib.deflateSync(serializedPools)

  // Calculate sizes in MB
  const serializedSizeMB = (Buffer.byteLength(serializedPools, 'utf8') / (1024 * 1024)).toFixed(2)
  const compressedSizeMB = (Buffer.byteLength(compressedPools) / (1024 * 1024)).toFixed(2)

  const result = await s3
    .putObject({
      Bucket: process.env.POOL_CACHE_BUCKET_3!,
      Key: compressedKey,
      Body: compressedPools,
    })
    .promise()

  metric.putMetric(`${metricPrefix}.s3.latency`, Date.now() - beforeS3)

  log.info({ result }, `Done ${protocol} for ${chainId.toString()}`)

  log.info(`Successfully cached ${chainId} ${protocol} pools to S3 bucket ${process.env.POOL_CACHE_BUCKET_3}`)
  metric.putMetric(`${metricPrefix}.latency`, Date.now() - beforeAll)

  log.info(
    `compression ratio for ${chainId} ${protocol} pool file is ${serializedPools.length}:${compressedPools.length} (${serializedSizeMB}MB -> ${compressedSizeMB}MB)`
  )
  metric.putMetric(`${metricPrefix}.compression_ratio`, serializedPools.length / compressedPools.length)
  metric.putMetric(`${metricPrefix}.compressed_size_mb`, parseFloat(compressedSizeMB))
  metric.putMetric(`${metricPrefix}.serialized_size_mb`, parseFloat(serializedSizeMB))
})

module.exports = { handler }
