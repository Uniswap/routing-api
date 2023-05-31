import { DynamoCaching, DynamoCachingProps } from '../../cache-dynamo'
import { Pool } from '@uniswap/v3-sdk'
import { log } from '@uniswap/smart-order-router'

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
        const cachedPoolBuffer: Buffer = Buffer.from(cachedPoolBinary)
        // TODO unmarshall the pool object
        return JSON.parse(cachedPoolBuffer.toString())
      } else {
        return undefined
      }
    } else {
      return undefined
    }
  }

  override async has(partitionKey: string, sortKey?: number): Promise<boolean> {
    return Promise.resolve((await this.get(partitionKey, sortKey)) !== undefined)
  }

  override async set(value: Pool, partitionKey: string, sortKey?: number): Promise<boolean> {
    if (sortKey) {
      // TODO: marshall the pool object
      const binaryCachedPool: Buffer = Buffer.from(JSON.stringify(value))

      const putParams = {
        TableName: this.tableName,
        Item: {
          poolAddress: partitionKey,
          blockNumber: sortKey,
          item: binaryCachedPool,
          ttl: this.ttlMinutes,
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
