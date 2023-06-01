import { DynamoCaching, DynamoCachingProps } from '../cache-dynamo'
import { Pool } from '@uniswap/v3-sdk'
import { log } from '@uniswap/smart-order-router'
import { PoolMarshaller } from '../../../marshalling'
import { DynamoDBTableProps } from '../../../../../bin/stacks/routing-database-stack'

interface DynamoCachingV3PoolProps extends DynamoCachingProps {}

export class DynamoCachingV3Pool extends DynamoCaching<string, number, Pool> {
  constructor({ tableName }: DynamoCachingV3PoolProps) {
    super({ tableName })
  }

  override async get(partitionKey: string, sortKey?: number): Promise<Pool | undefined> {
    if (sortKey) {
      const getParams = {
        TableName: this.tableName,
        Key: {
          [DynamoDBTableProps.V3PoolsDynamoDbTable.PartitionKeyName]: partitionKey,
          [DynamoDBTableProps.V3PoolsDynamoDbTable.SortKeyName]: sortKey,
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
        const cachedPoolBuffer: Buffer = Buffer.from(cachedPoolBinary)
        const marshalledPool = JSON.parse(cachedPoolBuffer.toString())
        return PoolMarshaller.unmarshal(marshalledPool)
      } else {
        return undefined
      }
    } else {
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
          [DynamoDBTableProps.V3PoolsDynamoDbTable.PartitionKeyName]: partitionKey,
          [DynamoDBTableProps.V3PoolsDynamoDbTable.SortKeyName]: sortKey,
          item: binaryCachedPool,
          [DynamoDBTableProps.TTLAttributeName]: ttl,
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
