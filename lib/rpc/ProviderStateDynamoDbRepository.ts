import { ProviderStateRepository, ProviderStateWithTimestamp } from './ProviderStateRepository'
import Logger from 'bunyan'
import { DynamoDB } from 'aws-sdk'
import { DocumentClient } from 'aws-sdk/clients/dynamodb'
import { ProviderState } from './ProviderState'

const UPDATE_EXPRESSION = `SET 
  #state = :state,
  #updatedAt = :updatedAtInMs,
  #ttl = :ttl`

const EXPRESSION_ATTRIBUTE_NAMES = {
  '#state': 'state',
  '#updatedAt': 'updatedAt',
  '#ttl': 'ttl',
}

const CONDITION_EXPRESSION = '#updatedAt = :prevUpdatedAtInMs'

export class ProviderStateDynamoDbRepository implements ProviderStateRepository {
  private ddbClient: DynamoDB.DocumentClient
  private DB_TTL_IN_S: number = 300

  constructor(private dbTableName: string, private log: Logger) {
    this.ddbClient = new DynamoDB.DocumentClient()
  }

  async read(providerId: string): Promise<ProviderStateWithTimestamp | null> {
    const getParams = {
      TableName: this.dbTableName,
      Key: { chainIdProviderName: providerId },
    }
    try {
      const result = await this.ddbClient.get(getParams).promise()
      const item = result.Item
      if (item === undefined) {
        this.log.debug(`No health score found for ${providerId}`)
        return null
      }
      if (item.ttl < Math.floor(Date.now() / 1000)) {
        this.log.debug(`Entry has expired at ${item.ttl} for ${providerId}`)
        return null
      }
      return {
        state: item.state,
        updatedAtInMs: item.updatedAt,
      }
    } catch (error: any) {
      this.log.error(`Failed to read health score from DB: ${JSON.stringify(error)}`)
      throw error
    }
  }

  // We use optimistic write strategy to handle READ-WRITE data race. The "updatedAt" field in DB entry serves
  // as the version number which we will check during a DB entry update.
  // This is to prevent ignoring change that's just get written to DB from another writer.
  // If optimistic DB write fails, we stop and will rely on caller to try again later.
  async write(
    providerId: string,
    state: ProviderState,
    updatedAtInMs: number,
    prevUpdatedAtInMs?: number
  ): Promise<void> {
    const ttlInS = Math.floor(updatedAtInMs / 1000) + this.DB_TTL_IN_S

    if (prevUpdatedAtInMs === undefined) {
      const putParams: DocumentClient.PutItemInput = {
        TableName: this.dbTableName,
        Item: {
          chainIdProviderName: providerId,
          updatedAt: updatedAtInMs,
          ttl: ttlInS,
          state: state,
        },
      }
      await this.ddbClient.put(putParams).promise()
      return
    }

    const updateParams: DocumentClient.UpdateItemInput = {
      TableName: this.dbTableName,
      Key: { chainIdProviderName: providerId },
      UpdateExpression: UPDATE_EXPRESSION,
      ExpressionAttributeNames: EXPRESSION_ATTRIBUTE_NAMES,
      ExpressionAttributeValues: this.getExpressionAttributeValues(state, updatedAtInMs, prevUpdatedAtInMs!, ttlInS),
      ConditionExpression: CONDITION_EXPRESSION,
    }
    await this.ddbClient.update(updateParams).promise()
  }

  private getExpressionAttributeValues(
    state: ProviderState,
    updatedAtInMs: number,
    prevUpdatedAtInMs: number,
    ttlInS: number
  ): { [key: string]: any } {
    let attributes: { [key: string]: any } = {}
    attributes[':updatedAtInMs'] = updatedAtInMs
    attributes[':prevUpdatedAtInMs'] = prevUpdatedAtInMs
    attributes[':ttl'] = ttlInS
    attributes[':state'] = state
    return attributes
  }
}
