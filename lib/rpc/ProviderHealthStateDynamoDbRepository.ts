import { ProviderHealthStateRepository } from './ProviderHealthStateRepository'
import Logger from 'bunyan'
import { DynamoDB } from 'aws-sdk'
import { DocumentClient } from 'aws-sdk/clients/dynamodb'
import { ProviderHealthState } from './ProviderHealthState'

// Table item assignment
const UPDATE_EXPRESSION = `SET 
  #healthiness = :healthiness,
  #ongoingAlarms = :ongoingAlarms,
  #version = :version`

// Table column names
const EXPRESSION_ATTRIBUTE_NAMES = {
  '#healthiness': 'healthiness',
  '#ongoingAlarms': 'ongoingAlarms',
  '#version': 'version',
}

const CONDITION_EXPRESSION = '#version = :baseVersion'

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
      return {
        healthiness: item.healthiness,
        ongoingAlarms: item.ongoingAlarms,
        version: item.version,
      }
    } catch (error: any) {
      this.log.error(`Failed to read health state from DB: ${JSON.stringify(error)}`)
      throw error
    }
  }

  async write(providerId: string, state: ProviderHealthState): Promise<void> {
    const putParams: DocumentClient.PutItemInput = {
      TableName: this.dbTableName,
      Item: {
        chainIdProviderName: providerId,
        healthiness: state.healthiness,
        ongoingAlarms: state.ongoingAlarms,
        version: state.version,
      },
    }
    await this.ddbClient.put(putParams).promise()
    return
  }

  async update(providerId: string, state: ProviderHealthState): Promise<void> {
    const updateParams: DocumentClient.UpdateItemInput = {
      TableName: this.dbTableName,
      Key: { chainIdProviderName: providerId },
      UpdateExpression: UPDATE_EXPRESSION,
      ExpressionAttributeNames: EXPRESSION_ATTRIBUTE_NAMES,
      ExpressionAttributeValues: this.getExpressionAttributeValues(state),
      // Use conditional update in combination with increasing version number to detect concurrent write conflicts.
      // If write conflicts is detected, the later write will be dropped. But the invocation of this lambda will be
      // retried for a maximum of 2 times, at 60 seconds delay per retry.
      ConditionExpression: CONDITION_EXPRESSION,
    }
    await this.ddbClient.update(updateParams).promise()
  }

  private getExpressionAttributeValues(state: ProviderHealthState): { [key: string]: any } {
    let attributes: { [key: string]: any } = {}
    attributes[':healthiness'] = state.healthiness
    attributes[':ongoingAlarms'] = state.ongoingAlarms
    attributes[':baseVersion'] = state.version - 1
    attributes[':version'] = state.version
    return attributes
  }
}
