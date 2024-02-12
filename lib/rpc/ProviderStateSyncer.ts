import Logger from 'bunyan'
import { ProviderState, ProviderStateRepository, ProviderStateWithTimestamp } from './ProviderStateRepository'
import { ProviderStateDynamoDbRepository } from './ProviderStateDynamoDbRepository'

export interface SyncResult {
  synced: boolean
  state: ProviderState
}

// Periodically sync provider state (health, performance, etc.) to a storage backend.
// The frequency of sync is controlled by syncInterval.
// If lambda is recycled before the next successful sync, the unsynced data may be lost.
export class ProviderStateSyncer {
  lastSyncTimestampInMs: number = 0
  stateRepository: ProviderStateRepository

  constructor(
    dbTableName: string,
    private readonly providerId: string,
    private readonly syncIntervalInS: number,
    private readonly log: Logger
  ) {
    this.stateRepository = new ProviderStateDynamoDbRepository(dbTableName, log)
  }

  // Each sync with DB has the following process:
  // 1. Read the DB to get DB stored health score for this provider
  // 2. Add local accumulated health score diff to the DB stored health score to get new health score
  // 3. Write back new health score to DB
  // 4. Update local health score with the new health score and refresh healthy state accordingly
  async maybeSyncWithRepository(localHealthScoreDiff: number, localHealthScore: number): Promise<SyncResult> {
    const timestampInMs = Date.now()
    if (timestampInMs - this.lastSyncTimestampInMs < 1000 * this.syncIntervalInS) {
      // Limit sync frequency to at most every syncIntervalInS seconds
      return { synced: false, state: {} }
    }

    let storedState: ProviderStateWithTimestamp | null = null
    try {
      storedState = await this.stateRepository.read(this.providerId)
    } catch (err: any) {
      this.log.error(`Failed to read from DB: ${JSON.stringify(err)}. Sync failed.`)
    }
    this.log.debug({ storedState })

    const newHealthScore =
      storedState === null ? localHealthScore : storedState.state.healthScore + localHealthScoreDiff
    const prevUpdatedAtInMs = storedState === null ? undefined : storedState.updatedAtInMs
    const newState = { healthScore: newHealthScore }

    try {
      await this.stateRepository.write(this.providerId, newState, timestampInMs, prevUpdatedAtInMs)
      this.lastSyncTimestampInMs = timestampInMs
      return { synced: true, state: newState }
    } catch (err: any) {
      this.log.error(`Failed to write to DB: ${JSON.stringify(err)}. Sync failed.`)
      return { synced: false, state: {} }
    }
  }
}
