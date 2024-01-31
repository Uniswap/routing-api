import Logger from 'bunyan'
import { ProviderStateRepository, ProviderStateWithTimestamp } from './ProviderStateRepository'
import { ProviderStateDynamoDbRepository } from './ProviderStateDynamoDbRepository'
import { LatencyEvaluation, ProviderState, ProviderStateDiff } from './ProviderState'

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
    private readonly latencyStatHistoryWindowLengthInS: number,
    private readonly log: Logger
  ) {
    this.stateRepository = new ProviderStateDynamoDbRepository(dbTableName, log)
  }

  // Each sync with DB has the following process:
  // 1. Read the DB to get DB stored health score for this provider
  // 2. Add local accumulated health score diff to the DB stored health score to get new health score
  // 3. Write back new health score to DB
  // 4. Update local health score with the new health score and refresh healthy state accordingly
  async maybeSyncWithRepository(
    localHealthScoreDiff: number,
    localHealthScore: number,
    lastEvaluatedLatencyInMs: number,
    lastLatencyEvaluationTimestampInMs: number
  ): Promise<ProviderState | null> {
    const timestampInMs = Date.now()

    if (!this.shouldSync(timestampInMs)) {
      return null
    }

    let storedState: ProviderStateWithTimestamp | null = null
    try {
      storedState = await this.stateRepository.read(this.providerId)
    } catch (err: any) {
      this.log.error(`Failed to read from sync storage: ${JSON.stringify(err)}. Sync failed.`)
    }
    this.log.debug({ storedState })

    const stateDiff: ProviderStateDiff = {
      healthScore: localHealthScore,
      healthScoreDiff: localHealthScoreDiff,
      latency: {
        timestampInMs: lastLatencyEvaluationTimestampInMs,
        latencyInMs: lastEvaluatedLatencyInMs,
      },
    }

    let newState: ProviderState
    let prevUpdatedAtInMs: number | undefined
    if (storedState === null) {
      newState = this.calculateNewState(null, stateDiff)
      prevUpdatedAtInMs = undefined
    } else {
      newState = this.calculateNewState(storedState.state, stateDiff)
      prevUpdatedAtInMs = storedState.updatedAtInMs
    }

    try {
      await this.stateRepository.write(this.providerId, newState, timestampInMs, prevUpdatedAtInMs)
      this.lastSyncTimestampInMs = timestampInMs
      return newState
    } catch (err: any) {
      this.log.error(`Failed to write to sync storage: ${JSON.stringify(err)}. Sync failed.`)
      return null
    }
  }

  private calculateNewState(oldState: ProviderState | null, stateDiff: ProviderStateDiff): ProviderState {
    const newHealthScore = oldState === null ? stateDiff.healthScore : oldState.healthScore + stateDiff.healthScoreDiff

    const timestampInMs = Date.now()
    const latencies: LatencyEvaluation[] = []
    if (oldState !== null && oldState) {
      for (const latency of oldState.latencies) {
        if (latency.timestampInMs > timestampInMs - 1000 * this.latencyStatHistoryWindowLengthInS) {
          latencies.push(latency)
        }
      }
    }
    if (stateDiff.latency.timestampInMs > timestampInMs - 1000 * this.latencyStatHistoryWindowLengthInS) {
      latencies.push(stateDiff.latency)
    }

    return {
      healthScore: newHealthScore,
      latencies: latencies,
    }
  }

  private shouldSync(timestampInMs: number): boolean {
    // Limit sync frequency to at most every syncIntervalInS seconds
    return timestampInMs - this.lastSyncTimestampInMs >= 1000 * this.syncIntervalInS
  }
}
