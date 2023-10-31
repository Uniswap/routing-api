import { ICache } from '@uniswap/smart-order-router/build/main/providers/cache'
import { Pair } from '@uniswap/v2-sdk'
import { BatchGetItemInput, DocumentClient } from 'aws-sdk/clients/dynamodb'
import { log, metric, MetricLoggerUnit } from '@uniswap/smart-order-router'
import { MarshalledPair, PairMarshaller } from '../../../marshalling'

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

  // TODO: ROUTE-81 & ROUTE-84 - once smart-order-router updates the ICache.batchGet API to take in
  // composite key as part of ROUTE-83, then we can leverage the batchGet Dynamo call
  // for both caching-pool-provider and token-properties-provider
  // Prior to completion of ROUTE-81 & ROUTE-84, this function is not being called anywhere.
  async batchGet(keys: Set<string>): Promise<Record<string, { pair: Pair; block?: number | undefined } | undefined>> {
    const records: Record<string, { pair: Pair; block?: number | undefined } | undefined> = {}
    const batchGetParams: BatchGetItemInput = {
      RequestItems: {
        [this.tableName]: {
          Keys: Array.from(keys).map((key) => {
            // TODO: ROUTE-83 fix the ICache.batchGet to allow passing in composite key type
            // instead of a simple string type
            // then fix the key destructuring here
            const [cacheKey, block] = key.split(':', 2)
            return {
              cacheKey: { S: cacheKey },
              block: { N: block },
            }
          }),
        },
      },
    }

    const result = await this.ddbClient.batchGet(batchGetParams).promise()
    const unprocessedKeys = result?.UnprocessedKeys?.[this.tableName]?.Keys

    if (unprocessedKeys && unprocessedKeys.length > 0) {
      metric.putMetric('V2_PAIRS_DYNAMO_CACHING_UNPROCESSED_KEYS', unprocessedKeys.length, MetricLoggerUnit.None)
    }

    return (
      result.Responses?.[this.tableName]
        ?.map((item) => {
          const key = item.cacheKey.S!
          const block = parseInt(item.block.N!)
          const itemBinary = item.item.B!
          const pairBuffer = Buffer.from(itemBinary)
          const pairJson: MarshalledPair = JSON.parse(pairBuffer.toString())

          return {
            [key]: {
              pair: PairMarshaller.unmarshal(pairJson),
              block,
            },
          }
        })
        ?.reduce((accumulatedRecords, currentRecord) => ({ ...accumulatedRecords, ...currentRecord }), records) ??
      records
    )
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
