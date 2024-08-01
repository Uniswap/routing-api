import { DynamoCaching, DynamoCachingProps } from '../cache-dynamo'
import { Pool } from '@uniswap/v3-sdk'
import { log, metric, MetricLoggerUnit } from '@uniswap/smart-order-router'
import { PoolMarshaller } from '../../../marshalling/v3/pool-marshaller'

interface DynamoCachingV3PoolProps extends DynamoCachingProps {}

export class DynamoCachingV3Pool extends DynamoCaching<string, number, Pool> {
  constructor({ tableName, ttlMinutes }: DynamoCachingV3PoolProps) {
    super({ tableName, ttlMinutes })
  }

  override async get(partitionKey: string, sortKey?: number): Promise<Pool | undefined> {
    if (sortKey) {
      const getParams = {
        TableName: this.tableName,
        Key: {
          poolAddress: partitionKey,
          blockNumber: sortKey,
        },
      }

      const cachedPoolBinary: Buffer | undefined = (
        await this.ddbClient
          .get(getParams)
          .promise()
          .catch((error) => {
            log.error({ error, getParams }, `[DynamoCachingV3Pool] Cached pool failed to get`)
            return undefined
          })
      )?.Item?.item

      if (cachedPoolBinary) {
        metric.putMetric('V3_DYNAMO_CACHING_POOL_HIT_IN_TABLE', 1, MetricLoggerUnit.None)
        const cachedPoolBuffer: Buffer = Buffer.from(cachedPoolBinary)
        const marshalledPool = JSON.parse(cachedPoolBuffer.toString())
        return PoolMarshaller.unmarshal(marshalledPool)
      } else {
        metric.putMetric('V3_DYNAMO_CACHING_POOL_MISS_NOT_IN_TABLE', 1, MetricLoggerUnit.None)
        return undefined
      }
    } else {
      metric.putMetric('V3_DYNAMO_CACHING_POOL_MISS_NO_BLOCK_NUMBER', 1, MetricLoggerUnit.None)
      return undefined
    }
  }

  override async set(pool: Pool, partitionKey: string, sortKey?: number): Promise<boolean> {
    if (sortKey) {
      const marshalledPool = PoolMarshaller.marshal(pool)
      const binaryCachedPool: Buffer = Buffer.from(JSON.stringify(marshalledPool))
      // TTL is minutes from now. multiply ttlMinutes times 60 to convert to seconds, since ttl is in seconds.
      const ttl = Math.floor(Date.now() / 1000) + 60 * this.ttlMinutes

      const putParams = {
        TableName: this.tableName,
        Item: {
          poolAddress: partitionKey,
          blockNumber: sortKey,
          item: binaryCachedPool,
          ttl: ttl,
        },
      }

      await this.ddbClient
        .put(putParams)
        .promise()
        .catch((error) => {
          log.error({ error, putParams }, `[DynamoCachingV3Pool] Cached pool failed to insert`)
          return false
        })

      return true
    } else {
      return false
    }
  }
}
