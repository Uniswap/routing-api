import { SubgraphProvider } from '@uniswap/smart-order-router';
import { EventBridgeEvent, ScheduledHandler } from 'aws-lambda';
import { S3 } from 'aws-sdk';
import { default as bunyan, default as Logger } from 'bunyan';

const handler: ScheduledHandler = async (
  event: EventBridgeEvent<string, void>
) => {
  const log: Logger = bunyan.createLogger({
    name: 'RoutingLambda',
    serializers: bunyan.stdSerializers,
    level: 'info',
    requestId: event.id,
  });

  const subgraphProvider = new SubgraphProvider(3, 15000);
  const pools = await subgraphProvider.getPools();

  const s3 = new S3();
  if (!pools || pools.length == 0) {
    return;
  }
  log.info(
    `Got ${pools.length} pools from the subgraph. Saving to ${process.env.POOL_CACHE_BUCKET}/${process.env.POOL_CACHE_KEY}`
  );

  await s3
    .putObject({
      Bucket: process.env.POOL_CACHE_BUCKET!,
      Key: process.env.POOL_CACHE_KEY!,
      Body: JSON.stringify(pools),
    })
    .promise();
};

module.exports = { handler };
