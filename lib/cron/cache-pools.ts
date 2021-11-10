import { ChainId, V2SubgraphProvider, V3SubgraphProvider } from '@uniswap/smart-order-router'
import { Protocol } from '@uniswap/smart-order-router/build/main/util/protocols'
import { EventBridgeEvent, ScheduledHandler } from 'aws-lambda'
import { S3 } from 'aws-sdk'
import { default as bunyan, default as Logger } from 'bunyan'
import { S3_POOL_CACHE_KEY } from '../util/pool-cache-key'

const handler: ScheduledHandler = async (event: EventBridgeEvent<string, void>) => {
  const log: Logger = bunyan.createLogger({
    name: 'RoutingLambda',
    serializers: bunyan.stdSerializers,
    level: 'info',
    requestId: event.id,
  })

  for (const chain of [ChainId.MAINNET, ChainId.RINKEBY]) {
    const v3SubgraphProvider = new V3SubgraphProvider(chain, 3, 15000)
    const v3Pools = await v3SubgraphProvider.getPools()

    const s3 = new S3()
    if (!v3Pools || v3Pools.length == 0) {
      log.info(`No V3 pools found from the subgraph for ${chain.toString()}`)
      continue
    }

    const v3Key = S3_POOL_CACHE_KEY(process.env.POOL_CACHE_KEY!, chain, Protocol.V3)

    log.info(`Got ${v3Pools.length} v3 pools from the subgraph for ${chain.toString()}. Saving to ${v3Key}`)

    const v3Result = await s3
      .putObject({
        Bucket: process.env.POOL_CACHE_BUCKET!,
        Key: v3Key,
        Body: JSON.stringify(v3Pools),
      })
      .promise()

    log.info({ v3Result }, `Done V3 for ${chain.toString()}`)

    const v2SubgraphProvider = new V2SubgraphProvider(chain)
    const v2Pools = await v2SubgraphProvider.getPools()

    if (!v2Pools || v2Pools.length == 0) {
      log.info(`No V2 pools found from the subgraph for ${chain.toString()}`)
      continue
    }

    const v2Key = S3_POOL_CACHE_KEY(process.env.POOL_CACHE_KEY!, chain, Protocol.V2)

    log.info(`Got ${v2Pools.length} v2 pools from the subgraph for ${chain.toString()}. Saving to ${v2Key}`)

    const v2Result = await s3
      .putObject({
        Bucket: process.env.POOL_CACHE_BUCKET!,
        Key: v2Key,
        Body: JSON.stringify(v2Pools),
      })
      .promise()

    log.info({ v2Result }, `Done V2 for ${chain.toString()}`)
  }
}

module.exports = { handler }
