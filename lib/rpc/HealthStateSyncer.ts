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
  private lastSyncTimestampInMs: number
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

  public maybeSyncHealthScoreWithDB(localHealthScoreDiff: number): Promise<SyncResult> {
    const timestampInMs = Date.now()
    if (timestampInMs - this.lastSyncTimestampInMs < 1000 * this.sync_interval_in_s) {
      return Promise.resolve({synced: false, healthScore: 0})
    }
    const dbHealthScore = this.readHealthScoreFromDB()
    const newHealthScore = dbHealthScore + localHealthScoreDiff
    return this.writeHealthScoreToDB(newHealthScore, timestampInMs)
      .then(() => {
        this.lastSyncTimestampInMs = timestampInMs
        return Promise.resolve({synced: true, healthScore: newHealthScore})
      })
      .catch((err: any) => {
        this.log.error(`Failed to write to DB ${JSON.stringify(err)}`)
        // Error is swallowed.
        return Promise.resolve({ synced: false, healthScore: 0 })
      })
  }

  private readHealthScoreFromDB(): number {
    this.log.debug(`Read health score from DB: 123`)
    return 123;
  }

  private writeHealthScoreToDB(healthScore: number, updateAt: number) {
    this.log.debug(`Write health score to DB: ${healthScore}`)
    const putParams = {
      TableName: this.dbTableName,
      Item: {
        chainIdProviderName: this.providerId,
        healthScore: healthScore,
        updateAt: updateAt,
        ttl: Math.floor(Date.now() / 1000) + this.DB_TTL_IN_S,
      }
    }
    return this.ddbClient.put(putParams).promise()
  }

}