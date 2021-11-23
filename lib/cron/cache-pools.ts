import { Protocol } from '@uniswap/router-sdk'
import { ChainId, StaticV2SubgraphProvider, V2SubgraphProvider, V3SubgraphProvider } from '@uniswap/smart-order-router'
import { EventBridgeEvent, ScheduledHandler } from 'aws-lambda'
import { S3 } from 'aws-sdk'
import { default as bunyan, default as Logger } from 'bunyan'
import _ from 'lodash'
import { S3_POOL_CACHE_KEY } from '../util/pool-cache-key'

const handler: ScheduledHandler = async (event: EventBridgeEvent<string, void>) => {
  const log: Logger = bunyan.createLogger({
    name: 'RoutingLambda',
    serializers: bunyan.stdSerializers,
    level: 'info',
    requestId: event.id,
  })

  const chainProtocols = [
    { protocol: Protocol.V3, chainId: ChainId.MAINNET, provider: new V3SubgraphProvider(ChainId.MAINNET, 3, 90000) },
    { protocol: Protocol.V3, chainId: ChainId.RINKEBY, provider: new V3SubgraphProvider(ChainId.RINKEBY, 3, 90000) },
    { protocol: Protocol.V2, chainId: ChainId.MAINNET, provider: new V2SubgraphProvider(ChainId.MAINNET, 2) },
    {
      protocol: Protocol.V2,
      chainId: ChainId.RINKEBY,
      provider: new StaticV2SubgraphProvider(ChainId.RINKEBY),
    },
  ]

  const s3 = new S3()

  await Promise.all(
    _.map(chainProtocols, async ({ protocol, chainId, provider }) => {
      log.info(`Getting pools for ${protocol} on ${chainId}`)

      let pools
      try {
        pools = await provider.getPools()
      } catch (err) {
        log.error({ err }, `Failed to get pools for ${protocol} on ${chainId}`)
        throw new Error(`Failed to get pools for ${protocol} on ${chainId}`)
      }

      if (!pools || pools.length == 0) {
        log.info(`No ${protocol} pools found from the subgraph for ${chainId.toString()}`)
        return
      }

      const key = S3_POOL_CACHE_KEY(process.env.POOL_CACHE_KEY!, chainId, protocol)

      log.info(`Got ${pools.length} ${protocol} pools from the subgraph for ${chainId.toString()}. Saving to ${key}`)

      const result = await s3
        .putObject({
          Bucket: process.env.POOL_CACHE_BUCKET_2!,
          Key: key,
          Body: JSON.stringify(pools),
        })
        .promise()

      log.info({ result }, `Done ${protocol} for ${chainId.toString()}`)
    })
  )
}

module.exports = { handler }
