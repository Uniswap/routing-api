import { setupTables } from '../../dbSetup'
import { HealthStateSyncer } from '../../../../lib/rpc/HealthStateSyncer'
import { DynamoDBTableProps } from '../../../../bin/stacks/routing-database-stack'
import { default as bunyan } from 'bunyan'
import { expect, assert } from 'chai'
import Sinon from 'sinon'

const DB_TABLE = {
  TableName: DynamoDBTableProps.RpcProviderHealthDbTable.Name,
  KeySchema: [
    {
      AttributeName: 'chainIdProviderName',
      KeyType: 'HASH',
    },
  ],
  AttributeDefinitions: [
    {
      AttributeName: 'chainIdProviderName',
      AttributeType: 'S',
    },
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 1,
    WriteCapacityUnits: 1,
  },
}

const log = bunyan.createLogger({
  name: 'HealthStateSyncerTest',
  serializers: bunyan.stdSerializers,
  level: bunyan.ERROR,
})

describe('HealthStateSyncer', () => {
  setupTables(DB_TABLE)
  const syncer = new HealthStateSyncer(DynamoDBTableProps.RpcProviderHealthDbTable.Name, 'providerId', 5, log)

  it('write to health score to DB then read from it', async () => {
    const healthScore = -1000
    const timestamp = Date.now()
    try {
      await syncer['writeHealthScoreToDb'](healthScore, 0, timestamp)
    } catch (err: any) {
      assert(false, `Should not throw error ${err}`)
    }

    let readResult
    try {
      readResult = await syncer['readHealthScoreFromDb']()
    } catch (err: any) {
      assert(false, `Should not throw error ${err}`)
    }
    expect(readResult!.healthScore).equals(healthScore)
    expect(readResult!.updatedAtInMs).equals(timestamp)
  })

  it('write to health score to DB then read from it later, but it already expired', async () => {
    const healthScore = -1000
    const timestamp = Date.now()
    const clock = Sinon.useFakeTimers(timestamp)
    try {
      await syncer['writeHealthScoreToDb'](healthScore, 0, timestamp)
    } catch (err: any) {
      assert(false, `Should not throw error ${err}`)
    }

    clock.tick(60000) // Exceed TTL which is 30 seconds

    let readResult
    try {
      readResult = await syncer['readHealthScoreFromDb']()
    } catch (err: any) {
      assert(false, `Should not throw error ${err}`)
    }
    expect(readResult === null)
  })

  it('write to health score to DB then write it again: Timestamp match', async () => {
    const healthScore = -1000
    const timestamp = Date.now()
    try {
      await syncer['writeHealthScoreToDb'](healthScore, 0, timestamp)
    } catch (err: any) {
      assert(false, `Should not throw error ${err}`)
    }

    try {
      await syncer['writeHealthScoreToDb'](healthScore, timestamp, timestamp + 1000)
    } catch (err: any) {
      assert(false, `Should not throw error ${err}`)
    }
  })

  it('write to health score to DB then write it again: Timestamp mismatch', async () => {
    const healthScore = -1000
    const timestamp = Date.now()
    try {
      await syncer['writeHealthScoreToDb'](healthScore, 0, timestamp)
    } catch (err: any) {
      assert(false, `Should not throw error ${err}`)
    }

    try {
      await syncer['writeHealthScoreToDb'](healthScore, timestamp + 100, timestamp + 1000)
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.code).equals('ConditionalCheckFailedException')
    }
  })

  it('sync health score succeeds: no previous DB result', async () => {
    const localHealthScoreDiff = -100
    const localHealthScore = -1100
    const timestamp = Date.now()
    const clock = Sinon.useFakeTimers(timestamp)
    let syncResult
    try {
      syncResult = await syncer.maybeSyncHealthScoreWithDb(localHealthScoreDiff, localHealthScore)
    } catch (err: any) {
      assert(false, `Should not throw error ${err}`)
    } finally {
      clock.restore()
    }
    expect(syncResult.synced).equals(true)
    expect(syncResult.healthScore).equals(localHealthScore)
    expect(syncer['lastSyncTimestampInMs']).equals(timestamp)
  })

  it('sync health score succeeds: optimistic write succeeds', async () => {
    const prevHealthScore = -1000
    const timestamp = Date.now()
    const clock = Sinon.useFakeTimers(timestamp)
    try {
      await syncer['writeHealthScoreToDb'](prevHealthScore, 0, timestamp)
    } catch (err: any) {
      assert(false, `Should not throw error ${err}`)
    }

    // Tick time forward to exceed DB sync interval.
    clock.tick(6000)

    const localHealthScoreDiff = -100
    const localHealthScore = -1100
    let syncResult
    try {
      syncResult = await syncer.maybeSyncHealthScoreWithDb(localHealthScoreDiff, localHealthScore)
    } catch (err: any) {
      console.log(JSON.stringify(err))
      assert(false, `Should not throw error ${err}`)
    } finally {
      clock.restore()
    }
    expect(syncResult.synced).equals(true)
    expect(syncResult.healthScore).equals(-1100)
    expect(syncer['lastSyncTimestampInMs']).equals(timestamp + 6000)
  })
})
