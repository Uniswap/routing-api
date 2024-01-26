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
    }
  ],
  AttributeDefinitions: [
    {
      AttributeName: 'healthScore',
      AttributeType: 'N',
    }
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
  const syncer = new HealthStateSyncer('providerId', 5, log)

  it('write to health score to DB then read from it', async () => {
    const HEALTH_SCORE = -1000
    const timestamp = Date.now()
    try {
      await syncer['writeHealthScoreToDb'](HEALTH_SCORE, timestamp)
    } catch (err: any) {
      assert(false, `Should not throw error ${err}`)
    }


  })
})
