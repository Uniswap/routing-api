import { setupTables } from '../../dbSetup'
import { HealthStateSyncer } from '../../../../lib/rpc/HealthStateSyncer'
import { default as bunyan } from 'bunyan'
import { assert } from 'chai'

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

describe('HealthStateSyncer', () => {
  process.env = {
    RPC_PROVIDER_HEALTH_TABLE_NAME: 'RpcProviderHealth',
  }
  setupTables(DB_TABLE)
  const syncer = new HealthStateSyncer('providerId', 5, log)

  it('write to health score to DB then read from it', async () => {
    const HEALTH_SCORE = -1000
    const timestamp = Date.now()
    try {
      await syncer['writeHealthScoreToDb'](HEALTH_SCORE, timestamp)
    } catch (err: any) {
      assert(false, `Should not throw error ${err}`)
    }

    try {
      const syncedHealthScore = await syncer['readHealthScoreFromDb']()
      console.log(syncedHealthScore)
    } catch (err: any) {
      assert(false, `Should not throw error ${err}`)
    }
  })
})
