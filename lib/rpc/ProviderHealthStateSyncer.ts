import { DynamoDB } from 'aws-sdk'
import { DocumentClient } from 'aws-sdk/clients/dynamodb'
import Logger from 'bunyan'

export interface SyncResult {
  synced: boolean
  healthScore: number
}

interface ReadResult {
  healthScore: number
  updatedAtInMs: number
}

export class HealthStateSyncer {
  private readonly providerId: string
  private readonly dbTableName: string
  private ddbClient: DocumentClient
  private lastSyncTimestampInMs: number = 0
  private syncIntervalInS: number
  private readonly DB_TTL_IN_S = 30
  private log: Logger

  constructor(dbTableName: string, providerId: string, syncIntervalInS: number, log: Logger) {
    this.dbTableName = dbTableName
    this.ddbClient = new DynamoDB.DocumentClient()
    this.providerId = providerId
    this.syncIntervalInS = syncIntervalInS
    this.log = log
  }

  async maybeSyncHealthScoreWithDb(localHealthScoreDiff: number, localHealthScore: number): Promise<SyncResult> {
    // TODO(jie): Reduce the amount of debug logging?
    this.log.debug(
      {
        localHealthScore,
        localHealthScoreDiff,
      },
      'maybeSyncHealthScoreWithDB'
    )
    const timestampInMs = Date.now()
    if (timestampInMs - this.lastSyncTimestampInMs < 1000 * this.syncIntervalInS) {
      return { synced: false, healthScore: localHealthScore }
    }

    let readResult: ReadResult | null = null
    try {
      readResult = await this.readHealthScoreFromDb()
    } catch (err: any) {
      this.log.error(`Failed to read from DB: ${JSON.stringify(err)}. Sync failed.`)
    }
    this.log.debug({ readResult })

    const newHealthScore = readResult === null ? localHealthScore : readResult.healthScore + localHealthScoreDiff
    const oldUpdatedAtInMs = readResult == null ? 0 : readResult.updatedAtInMs
    try {
      await this.writeHealthScoreToDb(newHealthScore, oldUpdatedAtInMs, timestampInMs)
      this.lastSyncTimestampInMs = timestampInMs
      return { synced: true, healthScore: newHealthScore }
    } catch (err: any) {
      this.log.error(`Failed to write to DB: ${JSON.stringify(err)}. Sync failed.`)
      return { synced: false, healthScore: localHealthScore }
    }
  }

  private async readHealthScoreFromDb(): Promise<ReadResult | null> {
    const getParams = {
      TableName: this.dbTableName,
      Key: { chainIdProviderName: this.providerId },
    }
    try {
      const result = await this.ddbClient.get(getParams).promise()
      const item = result.Item
      if (item === undefined) {
        this.log.info(`No health score found for ${this.providerId}`)
        return null
      }
      if (item.ttl < Math.floor(Date.now() / 1000)) {
        this.log.info(`Health score has expired: TTL at ${item.ttl} for ${this.providerId}`)
        return null
      }
      return { healthScore: item.healthScore, updatedAtInMs: item.updatedAt }
    } catch (error: any) {
      this.log.error(`Failed to read health score from DB: ${JSON.stringify(error)}`)
      throw error
    }
  }

  private writeHealthScoreToDb(healthScore: number, oldUpdatedAtInMs: number, newUpdatedAtInMs: number) {
    this.log.debug(`Write health score to DB: ${healthScore}`)
    const ttl = Math.floor(newUpdatedAtInMs / 1000) + this.DB_TTL_IN_S
    let updateParams: DocumentClient.UpdateItemInput
    if (oldUpdatedAtInMs === 0) {
      const putParams = {
        TableName: this.dbTableName,
        Item: {
          chainIdProviderName: this.providerId,
          healthScore: healthScore,
          updatedAt: newUpdatedAtInMs,
          ttl: ttl,
        },
      }
      return this.ddbClient.put(putParams).promise()
    } else {
      updateParams = {
        TableName: this.dbTableName,
        Key: { chainIdProviderName: this.providerId },
        UpdateExpression: `SET 
          #healthScore = :healthScore,
          #updatedAt = :newUpdatedAtInMs,
          #ttl = :ttl`,
        ExpressionAttributeNames: {
          '#updatedAt': 'updatedAt',
          '#healthScore': 'healthScore',
          '#ttl': 'ttl',
        },
        ExpressionAttributeValues: {
          ':healthScore': healthScore,
          ':newUpdatedAtInMs': newUpdatedAtInMs,
          ':oldUpdatedAtInMs': oldUpdatedAtInMs,
          ':ttl': ttl,
        },
        ConditionExpression: '#updatedAt = :oldUpdatedAtInMs',
      }
      return this.ddbClient.update(updateParams).promise()
    }
  }
}
