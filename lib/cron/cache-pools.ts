import { ChainId, SubgraphProvider } from '@uniswap/smart-order-router'
import { EventBridgeEvent, ScheduledHandler } from 'aws-lambda'
import { S3 } from 'aws-sdk'
import { default as bunyan, default as Logger } from 'bunyan'

const handler: ScheduledHandler = async (event: EventBridgeEvent<string, void>) => {
  const log: Logger = bunyan.createLogger({
    name: 'RoutingLambda',
    serializers: bunyan.stdSerializers,
    level: 'info',
    requestId: event.id,
  })

  for (const chain of [ChainId.MAINNET, ChainId.RINKEBY]) {
    const subgraphProvider = new SubgraphProvider(chain, 3, 15000)
    const pools = await subgraphProvider.getPools()

    const s3 = new S3()
    if (!pools || pools.length == 0) {
      return
    }

    const key = `${process.env.POOL_CACHE_KEY}${chain != ChainId.MAINNET ? `-${chain}` : ''}`

    log.info(`Got ${pools.length} pools from the subgraph. Saving to ${process.env.POOL_CACHE_BUCKET}/${key}`)

    await s3
      .putObject({
        Bucket: process.env.POOL_CACHE_BUCKET!,
        Key: key,
        Body: JSON.stringify(pools),
      })
      .promise()
  }
}

module.exports = { handler }
