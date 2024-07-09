import { Protocol } from '@uniswap/router-sdk'
import {
  setGlobalLogger,
  setGlobalMetric,
  V2SubgraphPool,
  V2SubgraphProvider,
  V3SubgraphPool,
  V3SubgraphProvider,
} from '@uniswap/smart-order-router'
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
      const filteredPools = additionalPools.filter((pool) => {
        const shouldFilter = pool.id.toLowerCase() === '0x801c868ce08fb5b396e6911eac351beb259d386c'

        if (shouldFilter) {
          log.info(`Filtering pool ${pool.id} from ${protocol} on ${chainId}`)
        }
        return shouldFilter
      })
      filteredPools.forEach((pool) => pools.push(pool))

      const manuallyIncludedPools: V2SubgraphPool[] = [
        {
          id: '0x801c868ce08fb5b396e6911eac351beb259d386c',
          token0: {
            id: '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0',
            symbol: 'wstETH',
          },
          token1: {
            id: '0xbaac2b4491727d78d2b78815144570b9f2fe8899',
            symbol: 'DOG',
          },
          supply: 706196.651729130972764273,
          reserve: 818.040429522105562858,
          reserveUSD: 5890000,
        } as V2SubgraphPool,
      ]
      manuallyIncludedPools.forEach((pool) => pools.push(pool))

      const filterOutPoolAddresses = [
        // filter out AMPL-token pools with low liquidity
        '0x029c9f16d219486305716f8c623739f9c75ceabd',
        '0x037555fd11f9ba25b8b2240cac45c340023c0e3e',
        '0x04a3e942702d67f694397d5bbd6d3a724a59bb83',
        '0x08a564924c26d8289503bbaa18714b9c366df9a5',
        '0x0b30c6e9873f6b0611ff322e2a7cc692566059cb',
        '0x10cb5745dbc1a9d40e56b87a89443b7ee5685700',
        '0x1781c9e087b14a59137a13a2fb77b8706c076f8e',
        '0x18027ee162e26aa7dd62d8aa3e863114e123485f',
        '0x20b68e4ebbcf8f4213f2520bd933a9f77fe2ba5c',
        '0x2647b944831091a5e015760d50a5369da1358477',
        '0x2bffdeea4076afd9468488cc2d483b0d9bf390e2',
        '0x39fb8d79d23f338a503d7dfeb22af035465ce6da',
        '0x3db198710c1fd80710a5b95a2f73e347236c2d20',
        '0x3e8c428e378c2ea06db5090ee7484072ee1405e4',
        '0x3f35b1627bfedead1657849544bc94ee907dfc9d',
        '0x419a0d9598a8219990242fcd5ec321a78ade9292',
        '0x53b784d0fb88f53c6af76839a7eaec8e95729375',
        '0x53f364a28e749d3757a61c3bc5529bf5bac4bb76',
        '0x565fb96239c6feed741d5aa351b80bed5aa395b4',
        '0x5ad1445d48b6cc75bc944a42096a67f5e2f89f38',
        '0x5dfdd30458cf9103913876e2babbc0cf8e2ae332',
        '0x60877a93d2c4e6c94efa0c90a10f1279e02052f3',
        '0x6277155437e494b5061dbfa0a4f13516e2cbcb93',
        '0x670dac2a5fb900d799798cb170b0d2517aa410a4',
        '0x6b102aee00ee84e9f2761dae6f7af4cabbd5fc60',
        '0x6d0e791003b16e0b9b970eb9b7c5f2729b3fb4ef',
        '0x730c0867dd268bcb7f2f6618abb82763c2a0cae6',
        '0x758e5020abd493d163e70e30fd70d767dd440e73',
        '0x77552f5f1029c2759c6f250f64d7276bf53c6de1',
        '0x7dd337d3451472e6c94dec8f7c65e41e200f135f',
        '0x7fa64a4be88f9a66401c4a9cce6b0560e5503f17',
        '0x7fe29551bfb700d3ee801eea1a689525d1ea4f58',
        '0x802f1179efade88371ab49bdc5847fa0f45d3fd7',
        '0x81145516ba64c6555f600d7b32e050ea235a7b1e',
        '0x8124adde003aceb997270f936606cfa91c18ae59',
        '0x83503be303ff0e05a5d6dcd1c2a3bd589fb0ded4',
        '0x942fd99c4cbc0d17fea386d6435e4ee977f429af',
        '0x95f8ea94c3b5ad4a30a2ccdd393641843e91fde4',
        '0x99e2bd6f2fd5086dc18f5b25a97770d1c407f812',
        '0x9bbb33186788d575cb97ee1b20080f7c56c01a24',
        '0x9c1ceadc487969a9e48eea7222206c6b9514a35c',
        '0xa0a44777b4b95364990fbb29c42990ac24bb9c43',
        '0xa5e7beb5ed26b3e5cd5b5a9e869556cf9d7f772b',
        '0xab7b749a56322e15ecd685077ccb69ac9fc5dc0e',
        '0xabc7d601982b1ff279965a2d0db19b39db4f39ca',
        '0xacb74201fe556ce4b01df104aba3666855d10d09',
        '0xae2a5b2b2a07cc434e95b08a4e2022b1bd42fd4d',
        '0xb360ebbeba4c74eb7c960757127b830091e2567a',
        '0xb450e654e1853dc49fe1d1fa9a94c898d6c5b07f',
        '0xb91224f6b496f9718f92c3a6a8f85f93fa2be78a',
        '0xc27286b35101db690aa48fca4a21a2a5cb109fca',
        '0xc2e0e4eb1fcea463ef20dd0098b745ab5cbd795d',
        '0xc623fcddccc150ff9f4fe12836396fc33d57cd59',
        '0xca5f42c8c500e0b7ea6ea8a97bd43f937daf7aeb',
        '0xcb16c4d61a054db33c73a23125239fffe71c92b4',
        '0xcdc3d2c8c79091b9b63a70a98716e3b40d1299d4',
        '0xd0dfae74a235590bcd10511b7f63222bac772098',
        '0xd18b6f4a4f9f9e5a77514ccf25478b351a95de40',
        '0xd206892ec46a663f5f49ddc7f3761f65aed6fd57',
        '0xda9f285925f96aa8b0deda6607617849b74e1b7a',
        '0xdb4441a35256b270c369ced5ba95aa99ec4623a2',
        '0xe104385168da45bed811d76d2d804e445a891d67',
        '0xe28a8c5227e50157d69c3916b95495307129494f',
        '0xef08deb6fe642b1145e010d3fc08d517d4af1986',
        '0xf0dbd8d468248a9f01690858a421a437f4b99ce1',
        '0xf6735b081f9a0feac40f7689db24ed7e11bff429',
        '0xfa545ce38d18ea4350adb899f380058afad7619e',
        '0xfaa7e98e633a10e90b71a84200e10562e5302a92',
        '0xfdce1a334e5e33167709c5d9c60798a5b7884576',
        '0xfe2aa6db37531042bc4fdcad1fea3f6616a5bd54',
      ].map((address) => address.toLowerCase())

      pools = (pools as Array<V2SubgraphPool>).filter((pool: V2SubgraphPool) => {
        const shouldFilterOut = filterOutPoolAddresses.includes(pool.id.toLowerCase())

        if (shouldFilterOut) {
          log.info(`Filtering out pool ${pool.id} from ${protocol} on ${chainId}`)
        }

        return !shouldFilterOut
      })
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
          pool.token1.id.toLowerCase() === '0xd46ba6d942050d489dbd938a2c909a5d5039a161'

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
    `compression ratio for ${chainId} ${protocol} pool file is ${serializedPools.length}:${compressedPools.length}`
  )
  metric.putMetric(`${metricPrefix}.compression_ratio`, serializedPools.length / compressedPools.length)
})

module.exports = { handler }
