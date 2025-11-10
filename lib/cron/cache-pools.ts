import { Protocol } from '@uniswap/router-sdk'
import {
  setGlobalLogger,
  setGlobalMetric,
  V3SubgraphPool,
  V3SubgraphProvider,
  V4SubgraphPool,
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
import { v4HooksPoolsFiltering } from '../util/v4HooksPoolsFiltering'

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

    if (protocol === Protocol.V4) {
      const manuallyIncludedV4Pools: V4SubgraphPool[] = [
        {
          id: '0xe9eeab9794c33dff3dd8d0951cbe2d36619294af5a3a329f38f91f54be0b6d34',
          feeTier: '10000',
          tickSpacing: '200',
          hooks: '0xc5a48b447f01e9ce3ede71e4c1c2038c38bd9000',
          liquidity: '274563705100803912362733',
          token0: {
            symbol: 'fid:385955',
            id: '0x112cf1cc540eadf234158c0e4044c3b5f2a33e5e',
            name: 'degenfans',
            decimals: '18',
          },
          token1: {
            symbol: 'MOXIE',
            id: '0x8c9037d1ef5c6d1f6816278c7aaf5491d24cd527',
            name: 'Moxie',
            decimals: '18',
          },
          tvlETH: 25.33120577965346308313185954009482,
          tvlUSD: 56627.5525783346590219799350683533,
        } as V4SubgraphPool,
        {
          id: '0x6bac01f0a8fb96eeb56e37506f210628714561113c748d43c6de50dc339edfe9',
          feeTier: '10000',
          tickSpacing: '200',
          hooks: '0xc5a48b447f01e9ce3ede71e4c1c2038c38bd9000',
          liquidity: '621568112474979678301274',
          token0: {
            symbol: 'base-economy',
            id: '0x125490489a27d541e39813c08d260debac071bb7',
            name: 'Base Economy',
            decimals: '18',
          },
          token1: {
            symbol: 'MOXIE',
            id: '0x8c9037d1ef5c6d1f6816278c7aaf5491d24cd527',
            name: 'Moxie',
            decimals: '18',
          },
          tvlETH: 142.7576163222032969740638595951846,
          tvlUSD: 316322.6881520965844428159264274397,
        } as V4SubgraphPool,
        {
          id: '0x31781e65a4bd9ff0161e660f7930beee16026f819cd4d0bc7e17f6c78c29fc27',
          feeTier: '10000',
          tickSpacing: '200',
          hooks: '0xc5a48b447f01e9ce3ede71e4c1c2038c38bd9000',
          liquidity: '482843960670027606548690',
          token0: {
            symbol: 'fid:444067',
            id: '0x15148da22518e40e0d2fabf5d5e6a22269ebcb30',
            name: 'macster',
            decimals: '18',
          },
          token1: {
            symbol: 'MOXIE',
            id: '0x8c9037d1ef5c6d1f6816278c7aaf5491d24cd527',
            name: 'Moxie',
            decimals: '18',
          },
          tvlETH: 44.1795925485023741879813651641809,
          tvlUSD: 95050.95363442908526427214106054717,
        } as V4SubgraphPool,
      ]

      // V4/Euler hooks not supported - entire section disabled
      // This code won't execute for zkEVM V3-only deployment

      if (chainId === ChainId.UNICHAIN) {
        // UNICHAIN ETH/WETH: https://uniscan.xyz/tx/0x935979a7e4a1e3ea92b180009c46242b89a787fb4f2f5799bd53c675d5e0f9fd#eventlog
        manuallyIncludedV4Pools.push({
          id: '0xba246b8420b5aeb13e586cd7cbd32279fa7584d7f4cbc9bd356a6bb6200d16a6',
          feeTier: '0',
          tickSpacing: '1',
          hooks: '0x730b109bad65152c67ecc94eb8b0968603dba888',
          liquidity: '173747248900',
          token0: {
            symbol: 'ETH',
            id: '0x0000000000000000000000000000000000000000',
            name: 'Ethereum',
            decimals: '18',
          },
          token1: {
            symbol: 'WETH',
            id: '0x4200000000000000000000000000000000000006',
            name: 'Wrapped Ether',
            decimals: '18',
          },
          tvlETH: 33482,
          tvlUSD: 60342168,
        } as V4SubgraphPool)
      }

      if (chainId === ChainId.OPTIMISM) {
        // OPTIMISM ETH/WETH: https://optimistic.etherscan.io/tx/0x5f81f2aa19a50a76a94a30d3d2a9540cb3cd8597c94499a50330e4b6acbef5c1#eventlog
        manuallyIncludedV4Pools.push({
          id: '0xbf3d38951e485c811bb1fc7025fcd1ef60c15fda4c4163458facb9bedfe26f83',
          feeTier: '0',
          tickSpacing: '1',
          hooks: '0x480dafdb4d6092ef3217595b75784ec54b52e888',
          liquidity: '173747248900',
          token0: {
            symbol: 'ETH',
            id: '0x0000000000000000000000000000000000000000',
            name: 'Ethereum',
            decimals: '18',
          },
          token1: {
            symbol: 'WETH',
            id: '0x4200000000000000000000000000000000000006',
            name: 'Wrapped Ether',
            decimals: '18',
          },
          tvlETH: 826,
          tvlUSD: 1482475,
        } as V4SubgraphPool)
      }

      if (chainId === ChainId.BASE) {
        // BASE ETH/WETH: https://basescan.org/tx/0x221b6521ee4a19a25a424ecfb36b58b0b68fce7cda106bf4551d1424b0867bcc#eventlog
        manuallyIncludedV4Pools.push({
          id: '0xbb2aefc6c55a0464b944c0478869527ba1a537f05f90a1bb82e1196c6e9403e2',
          feeTier: '0',
          tickSpacing: '1',
          hooks: '0xb08211d57032dd10b1974d4b876851a7f7596888',
          liquidity: '173747248900',
          token0: {
            symbol: 'ETH',
            id: '0x0000000000000000000000000000000000000000',
            name: 'Ethereum',
            decimals: '18',
          },
          token1: {
            symbol: 'WETH',
            id: '0x4200000000000000000000000000000000000006',
            name: 'Wrapped Ether',
            decimals: '18',
          },
          tvlETH: 6992,
          tvlUSD: 12580000,
        } as V4SubgraphPool)
      }

      if (chainId === ChainId.ARBITRUM_ONE) {
        // ARBITRUM ETH/WETH: https://arbiscan.io/tx/0x0b393d141a3770292ae8508626a4443307403b0b958b7d0eff70fca2fb85c106#eventlog
        manuallyIncludedV4Pools.push({
          id: '0xc1c777843809a8e77a398fd79ecddcefbdad6a5676003ae2eedf3a33a56589e9',
          feeTier: '0',
          tickSpacing: '1',
          hooks: '0x2a4adf825bd96598487dbb6b2d8d882a4eb86888',
          liquidity: '173747248900',
          token0: {
            id: '0x0000000000000000000000000000000000000000',
          },
          token1: {
            id: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
          },
          tvlETH: 23183,
          tvlUSD: 41820637,
        } as V4SubgraphPool)
      }

      if (chainId === ChainId.MAINNET) {
        // Mainnet ETH/WETH: https://app.uniswap.org/explore/pools/ethereum/0xf6f2314ac16a878e2bf8ef01ef0a3487e714d397d87f702b9a08603eb3252e92
        manuallyIncludedV4Pools.push({
          id: '0xf6f2314ac16a878e2bf8ef01ef0a3487e714d397d87f702b9a08603eb3252e92',
          feeTier: '0',
          tickSpacing: '1',
          hooks: '0x57991106cb7aa27e2771beda0d6522f68524a888',
          liquidity: '482843960670027606548690',
          token0: {
            symbol: 'ETH',
            id: '0x0000000000000000000000000000000000000000',
            name: 'ETH',
            decimals: '18',
          },
          token1: {
            symbol: 'WETH',
            id: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            name: 'WETH',
            decimals: '18',
          },
          tvlETH: 44000.1795925485023741879813651641809,
          tvlUSD: 95050000.95363442908526427214106054717,
        } as V4SubgraphPool)
      }

      manuallyIncludedV4Pools.forEach((pool) => pools.push(pool))

      pools = v4HooksPoolsFiltering(chainId, pools as Array<V4SubgraphPool>)
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
