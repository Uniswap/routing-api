import { setupTables } from '../../dbSetup'
import Sinon from 'sinon'
import { HealthStateSyncer } from '../../../../lib/rpc/HealthStateSyncer'
import { default as bunyan } from 'bunyan'
import { expect, assert } from 'chai'

const DB_TABLE = {
  TableName: 'RpcProviderHealth',
  KeySchema: [
    {
      AttributeName: 'chainIdProviderName',
      KeyType: 'HASH'
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


// TODO(jie): Add TTL related test case
describe('HealthStateSyncer', () => {
  process.env = {
    RPC_PROVIDER_HEALTH_TABLE_NAME: 'RpcProviderHealth',
  }
  setupTables(DB_TABLE)
  const syncer = new HealthStateSyncer('providerId', 5, log)

  it('write to health score to DB then read from it', async () => {
    const healthScore = -1000
    const timestamp = Date.now()
    try {
      await syncer['writeHealthScoreToDb'](healthScore, 0, timestamp)
    } catch (err: any) {
      assert(false, `Should not throw error ${err}`)
    }

    try {
      const readResult = await syncer['readHealthScoreFromDb']()
      expect(readResult!.healthScore).equals(healthScore)
      expect(readResult!.updatedAtInMs).equals(timestamp)
    } catch (err: any) {
      assert(false, `Should not throw error ${err}`)
    }
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
    try {
      const syncResult = await syncer.maybeSyncHealthScoreWithDb(localHealthScoreDiff, localHealthScore)
      expect(syncResult.synced).equals(true)
      expect(syncResult.healthScore).equals(localHealthScore)
    } catch (err: any) {
      assert(false, `Should not throw error ${err}`)
    }
  })

  it('sync health score succeeds: optimistic write succeeds', async () => {
    const prevHealthScore = -1000
    const timestamp = Date.now()
    const clock = Sinon.useFakeTimers(timestamp);
    try {
      await syncer['writeHealthScoreToDb'](prevHealthScore, 0, timestamp)
    } catch (err: any) {
      assert(false, `Should not throw error ${err}`)
    }

    clock.tick(1000)

    const localHealthScoreDiff = -100
    const localHealthScore = -1100
    try {
      const syncResult = await syncer.maybeSyncHealthScoreWithDb(localHealthScoreDiff, localHealthScore)
      expect(syncResult.synced).equals(true)
      expect(syncResult.healthScore).equals(-1100)
    } catch (err: any) {
      assert(false, `Should not throw error ${err}`)
    } finally {
      clock.restore()
    }
  })
})

