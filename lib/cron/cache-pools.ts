import { Protocol } from '@uniswap/router-sdk'
import { setGlobalLogger, setGlobalMetric, V2SubgraphProvider, V3SubgraphProvider } from '@uniswap/smart-order-router'
import { EventBridgeEvent, ScheduledHandler } from 'aws-lambda'
import { S3 } from 'aws-sdk'
import { ChainId } from '@uniswap/sdk-core'
import { default as bunyan, default as Logger } from 'bunyan'
import { S3_POOL_CACHE_KEY } from '../util/pool-cache-key'
import {
  chainProtocols,
  v2SubgraphUrlOverride,
  v2TrackedEthThreshold,
  v3SubgraphUrlOverride,
  v3TrackedEthThreshold,
} from './cache-config'
import { AWSMetricsLogger } from '../handlers/router-entities/aws-metrics-logger'
import { metricScope } from 'aws-embedded-metrics'
import * as zlib from 'zlib'
import dotenv from 'dotenv'

// Needed for local stack dev, not needed for staging or prod
// But it still doesn't work on the local cdk stack update,
// so we will manually populate ALCHEMY_QUERY_KEY env var in the cron job lambda in cache-config.ts
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

    if (protocol === Protocol.V2 && chainId === ChainId.MAINNET) {
      const v2MainnetSubgraphProvider = new V2SubgraphProvider(
        ChainId.MAINNET,
        5,
        900000,
        true,
        1000,
        v2TrackedEthThreshold,
        0, // wstETH/DOG reserveUSD is 0, but the pool balance (https://app.uniswap.org/explore/pools/ethereum/0x801c868ce08fb5b396e6911eac351beb259d386c) is sufficiently hight
        v2SubgraphUrlOverride(ChainId.MAINNET)
      )
      const additionalPools = await v2MainnetSubgraphProvider.getPools()
      const filteredPools = additionalPools.filter(
        (pool) => pool.id.toLowerCase() === '0x801c868ce08fb5b396e6911eac351beb259d386c'
      )
      log.info({ filteredPools }, `Additional filtered pool for ${protocol} on ${chainId}`)

      filteredPools.forEach((pool) => pools.push(pool))
    }

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
      const filteredPools = additionalPools.filter(
        (pool) => pool.id.toLowerCase() === '0x4622df6fb2d9bee0dcdacf545acdb6a2b2f4f863'
      )
      log.info({ filteredPools }, `Additional filtered pool for ${protocol} on ${chainId}`)

      filteredPools.forEach((pool) => pools.push(pool))
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
  const key = S3_POOL_CACHE_KEY(process.env.POOL_CACHE_KEY!, chainId, protocol)
  const compressedKey = S3_POOL_CACHE_KEY(process.env.POOL_CACHE_GZIP_KEY!, chainId, protocol)
  log.info(
    `Got ${
      pools.length
    } ${protocol} pools from the subgraph for ${chainId.toString()}. Saving to ${key} and ${compressedKey}`
  )

  const serializedPools = JSON.stringify(pools)
  const compressedPools = zlib.deflateSync(serializedPools)
  const result = await s3
    .putObject({
      Bucket: process.env.POOL_CACHE_BUCKET_3!,
      Key: compressedKey,
      Body: compressedPools,
    })
    .promise()

  metric.putMetric(`${metricPrefix}.s3.latency`, Date.now() - beforeS3)

  log.info({ result }, `Done ${protocol} for ${chainId.toString()}`)

  log.info(
    `Successfully cached ${chainId} ${protocol} pools to S3 bucket ${process.env.POOL_CACHE_BUCKET_2} ${process.env.POOL_CACHE_BUCKET_3}`
  )
  metric.putMetric(`${metricPrefix}.latency`, Date.now() - beforeAll)

  log.info(
    `compression ratio for ${chainId} ${protocol} pool file is ${serializedPools.length}:${compressedPools.length}`
  )
  metric.putMetric(`${metricPrefix}.compression_ratio`, serializedPools.length / compressedPools.length)
})

module.exports = { handler }
