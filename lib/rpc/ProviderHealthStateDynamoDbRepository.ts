import { ProviderHealthStateRepository } from './ProviderHealthStateRepository'
import Logger from 'bunyan'
import { DynamoDB } from 'aws-sdk'
import { DocumentClient } from 'aws-sdk/clients/dynamodb'
import { ProviderHealthState } from './ProviderHealthState'

export class ProviderHealthStateDynamoDbRepository implements ProviderHealthStateRepository {
  private ddbClient: DynamoDB.DocumentClient

  constructor(private dbTableName: string, private log: Logger) {
    this.ddbClient = new DynamoDB.DocumentClient()
  }

  async read(providerId: string): Promise<ProviderHealthState | null> {
    const getParams = {
      TableName: this.dbTableName,
      Key: { chainIdProviderName: providerId },
    }
    try {
      const result = await this.ddbClient.get(getParams).promise()
      const item = result.Item
      if (item === undefined) {
        this.log.debug(`No health state found for ${providerId}`)
        return null
      }
      return item.state
    } catch (error: any) {
      this.log.error(`Failed to read health state from DB: ${JSON.stringify(error)}`)
      throw error
    }
  }

  async write(
    providerId: string,
    state: ProviderHealthState
  ): Promise<void> {
    const putParams: DocumentClient.PutItemInput = {
      TableName: this.dbTableName,
      Item: {
        chainIdProviderName: providerId,
        state: state
      }
    }
    await this.ddbClient.put(putParams).promise()
    return
  }
}
