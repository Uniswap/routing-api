import { ProviderStateSyncer } from '../../../../lib/rpc/ProviderStateSyncer'
import { DynamoDBTableProps } from '../../../../bin/stacks/routing-database-stack'
import { default as bunyan } from 'bunyan'
import { expect } from 'chai'
import Sinon, { SinonSandbox } from 'sinon'

const log = bunyan.createLogger({
  name: 'ProviderStateSyncerTest',
  serializers: bunyan.stdSerializers,
  level: bunyan.ERROR,
})

describe('ProviderStateSyncer', () => {
  const syncer = new ProviderStateSyncer(DynamoDBTableProps.RpcProviderStateDbTable.Name, 'providerId', 5, log)
  let sandbox: SinonSandbox

  beforeEach(() => {
    sandbox = Sinon.createSandbox()
  })

  afterEach(() => {
    sandbox.restore()
  })

  it('sync health score succeeds: no previous DB result', async () => {
    const readStub = sandbox.stub(syncer.stateRepository, 'read')
    readStub.resolves(null)

    const writeStub = sandbox.stub(syncer.stateRepository, 'write')
    writeStub.resolves()

    const localHealthScoreDiff = -100
    const localHealthScore = -1100
    const timestamp = Date.now()
    const clock = Sinon.useFakeTimers(timestamp)
    let syncResult
    try {
      syncResult = await syncer.maybeSyncWithRepository(localHealthScoreDiff, localHealthScore)
    } finally {
      clock.restore()
    }
    expect(syncResult.synced).equals(true)
    expect(syncResult.state.healthScore).equals(localHealthScore)
    expect(syncer['lastSyncTimestampInMs']).equals(timestamp)
  })
})
