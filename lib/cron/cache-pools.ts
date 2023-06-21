import { Protocol } from '@uniswap/router-sdk'
import { setGlobalLogger } from '@uniswap/smart-order-router'
import { EventBridgeEvent, ScheduledHandler } from 'aws-lambda'
import { S3 } from 'aws-sdk'
import { ChainId } from '@uniswap/sdk-core'
import { default as bunyan, default as Logger } from 'bunyan'
import { S3_POOL_CACHE_KEY } from '../util/pool-cache-key'
import { chainProtocols } from './cache-config'

const handler: ScheduledHandler = async (event: EventBridgeEvent<string, void>) => {
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

  log.info(`Successfully cached ${chainId} ${protocol} pools to S3`)
}

module.exports = { handler }
