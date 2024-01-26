import { DynamoDB } from 'aws-sdk'
import { DocumentClient } from 'aws-sdk/clients/dynamodb'
import Logger from 'bunyan'

export interface SyncResult {
  synced: boolean,
  healthScore: number,
}

export class HealthStateSyncer {
  private readonly providerId: string
  private readonly dbTableName: string
  private ddbClient: DocumentClient
  private lastSyncTimestampInMs: number = 0
  private sync_interval_in_s: number
  private readonly DB_TTL_IN_S = 30
  private log: Logger

  constructor(providerId: string, sync_interval_in_s: number, log: Logger) {
    const dbTableNameStr = process.env['RPC_PROVIDER_HEALTH_TABLE_NAME']!
    if (dbTableNameStr === undefined) {
      throw new Error('Environment variable RPC_PROVIDER_HEALTH_TABLE_NAME is missing!')
    }

    this.dbTableName = dbTableNameStr
    this.ddbClient = new DynamoDB.DocumentClient()
    this.providerId = providerId
    this.sync_interval_in_s = sync_interval_in_s
    this.log = log
  }

  async maybeSyncHealthScoreWithDb(localHealthScoreDiff: number): Promise<SyncResult> {
    const timestampInMs = Date.now()
    if (timestampInMs - this.lastSyncTimestampInMs < 1000 * this.sync_interval_in_s) {
      return {synced: false, healthScore: 0}
    }

    let dbHealthScore: number
    try {
      dbHealthScore = await this.readHealthScoreFromDb()
    } catch (err: any) {
      this.log.error(`Failed to read from DB: ${JSON.stringify(err)}. Sync failed.`)
      return {synced: false, healthScore: 0}
    }

    const newHealthScore = dbHealthScore + localHealthScoreDiff
    try {
      await this.writeHealthScoreToDb(newHealthScore, timestampInMs)
      this.lastSyncTimestampInMs = timestampInMs
      return { synced: true, healthScore: newHealthScore }
    } catch (err: any) {
      this.log.error(`Failed to write to DB: ${JSON.stringify(err)}. Sync failed.`)
      return { synced: false, healthScore: 0 }
    }
  }

  private async readHealthScoreFromDb(): Promise<number> {
    const getParams = {
      TableName: this.dbTableName,
      Key: { chainIdProviderName: this.providerId }
    }
    const result = await this.ddbClient.get(getParams).promise()
    const item = result.Item
    if (item === undefined) {
      throw new Error('Get empty result.')
    }
    if (item.ttl < Math.floor(Date.now() / 1000)) {
      throw new Error(`Health score has expired: TTL at ${item.ttl}`)
    }
    // TODO: remove
    console.log(JSON.stringify(item))
    return item.healthScore
  }

  private writeHealthScoreToDb(healthScore: number, updatedAtInMs: number) {
    this.log.debug(`Write health score to DB: ${healthScore}`)
    const item = {
      chainIdProviderName: this.providerId,
      healthScore: healthScore,
      updatedAt: updatedAtInMs,
      ttl: Math.floor(updatedAtInMs / 1000) + this.DB_TTL_IN_S,
    }
    const putParams = {
      TableName: this.dbTableName,
      Item: item,
    }
    return this.ddbClient.put(putParams).promise()
  }

}