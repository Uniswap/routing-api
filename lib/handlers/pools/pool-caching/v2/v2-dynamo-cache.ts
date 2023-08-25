import { ICache } from '@uniswap/smart-order-router/build/main/providers/cache'
import { Pair } from '@uniswap/v2-sdk'
import { DocumentClient } from 'aws-sdk/clients/dynamodb'
import { log } from '@uniswap/smart-order-router'
import { PairMarshaller } from '../../../marshalling'

export class V2DynamoCache implements ICache<{ pair: Pair; block?: number }> {
  private readonly ddbClient: DocumentClient
  private readonly DEFAULT_TTL = 60 // 1 minute
  constructor(private readonly tableName: string) {
    this.ddbClient = new DocumentClient({
      maxRetries: 1,
      retryDelayOptions: {
        base: 20,
      },
      httpOptions: {
        timeout: 100,
      },
    })
  }
  async get(key: string): Promise<{ pair: Pair; block?: number } | undefined> {
    try {
      const queryParams = {
        TableName: this.tableName,
        // Since we don't know what's the latest block that we have in cache, we make a query with a partial sort key
        KeyConditionExpression: '#pk = :pk',
        ExpressionAttributeNames: {
          '#pk': 'cacheKey',
        },
        ExpressionAttributeValues: {
          ':pk': key,
        },
        ScanIndexForward: false, // Reverse order to retrieve most recent item first
        Limit: Math.max(1),
      }

      const result = await this.ddbClient.query(queryParams).promise()

      if (result.Items && result.Items.length > 0) {
        const record = result.Items[0]
        // If we got a response with more than 1 item, we extract the binary field from the response
        const itemBinary = record.item
        // Then we convert it into a Buffer
        const pairBuffer = Buffer.from(itemBinary)
        // We convert that buffer into string and parse as JSON (it was encoded as JSON when it was inserted into cache)
        const pairJson = JSON.parse(pairBuffer.toString())
        // Finally we unmarshal that JSON into a `Pair` object
        return {
          pair: PairMarshaller.unmarshal(pairJson),
          block: record.block,
        }
      } else {
        log.info('[V2DynamoCache] No V2Pair found in cache')
        return
      }
    } catch (e) {
      log.error({ e }, '[V2DynamoCache] Error calling dynamoDB')
    }
    return Promise.resolve(undefined)
  }

  has(key: string): Promise<boolean> {
    return this.get(key).then((value) => value != undefined)
  }

  async set(key: string, value: { pair: Pair; block?: number }): Promise<boolean> {
    if (value.block == undefined) {
      log.error('[V2DynamoCache] We can only cache values with a block number')
      return false
    } else {
      // Marshal the Pair object in preparation for storing in DynamoDB
      const marshalledPair = PairMarshaller.marshal(value.pair)
      // Convert the marshalledPair to JSON string
      const jsonPair = JSON.stringify(marshalledPair)
      // Encode the jsonPair into Binary
      const binaryPair = Buffer.from(jsonPair)

      const putParams = {
        TableName: this.tableName,
        Item: {
          cacheKey: key,
          block: value.block,
          item: binaryPair,
          ttl: Math.floor(Date.now() / 1000) + this.DEFAULT_TTL,
        },
      }

      try {
        await this.ddbClient.put(putParams).promise()
        log.info(`[V2DynamoCache] Pair inserted to cache`)

        return true
      } catch (error) {
        log.error({ error, putParams }, `[V2DynamoCache] Pair failed to insert`)

        return false
      }
    }
  }
}
