import Logger from 'bunyan'
import { ProviderState, ProviderStateStorage, ProviderStateWithTimestamp } from './ProviderStateStorage'
import { ProviderStateDynamoDbStorage } from './ProviderStateDynamoDbStorage'

export interface SyncResult {
  synced: boolean
  state: ProviderState
}

export class ProviderStateSyncer {
  lastSyncTimestampInMs: number = 0
  stateStorage: ProviderStateStorage

  constructor(dbTableName: string, private readonly providerId: string, private readonly syncIntervalInS: number, private readonly log: Logger) {
    this.stateStorage = new ProviderStateDynamoDbStorage(dbTableName, log)
  }

  async maybeSyncProviderState(localHealthScoreDiff: number, localHealthScore: number): Promise<SyncResult> {
    const timestampInMs = Date.now()
    if (timestampInMs - this.lastSyncTimestampInMs < 1000 * this.syncIntervalInS) {
      // Limit sync frequency to at most every syncIntervalInS seconds
      return { synced: false, state: {} }
    }

    let storedState: ProviderStateWithTimestamp | null = null
    try {
      storedState = await this.stateStorage.read(this.providerId)
    } catch (err: any) {
      this.log.error(`Failed to read from DB: ${JSON.stringify(err)}. Sync failed.`)
    }
    this.log.debug({ storedState })

    const newHealthScore = storedState === null ? localHealthScore : storedState.state.healthScore + localHealthScoreDiff
    const prevUpdatedAtInMs = storedState == null ? undefined : storedState.updatedAtInMs
    const newState = { healthScore: newHealthScore }
    try {
      // await this.writeHealthScoreToDb(newHealthScore, oldUpdatedAtInMs, timestampInMs)
      await this.stateStorage.write(this.providerId, newState, timestampInMs, prevUpdatedAtInMs)
      this.lastSyncTimestampInMs = timestampInMs
      return { synced: true, state: newState }
    } catch (err: any) {
      this.log.error(`Failed to write to DB: ${JSON.stringify(err)}. Sync failed.`)
      return { synced: false, state: {} }
    }
  }
}
