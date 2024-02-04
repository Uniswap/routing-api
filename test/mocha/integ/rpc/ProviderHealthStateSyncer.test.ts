import { ProviderStateSyncer } from '../../../../lib/rpc/ProviderStateSyncer'
import { DynamoDBTableProps } from '../../../../bin/stacks/routing-database-stack'
import { default as bunyan } from 'bunyan'
import { expect } from 'chai'
import Sinon, { SinonSandbox } from 'sinon'

const log = bunyan.createLogger({
  name: 'HealthStateSyncerTest',
  serializers: bunyan.stdSerializers,
  level: bunyan.ERROR,
})

describe('HealthStateSyncer', () => {
  const syncer = new ProviderStateSyncer(DynamoDBTableProps.RpcProviderHealthDbTable.Name, 'providerId', 5, log)
  let sandbox: SinonSandbox

  beforeEach(() => {
    sandbox = Sinon.createSandbox()
  })

  afterEach(() => {
    sandbox.restore()
  })

  it('sync health score succeeds: no previous DB result', async () => {
    const readStub = sandbox.stub(syncer.stateStorage, 'read')
    readStub.resolves(null)

    const writeStub = sandbox.stub(syncer.stateStorage, 'write')
    writeStub.resolves({})

    const localHealthScoreDiff = -100
    const localHealthScore = -1100
    const timestamp = Date.now()
    const clock = Sinon.useFakeTimers(timestamp)
    let syncResult
    try {
      syncResult = await syncer.maybeSyncProviderState(localHealthScoreDiff, localHealthScore)
    } finally {
      clock.restore()
    }
    expect(syncResult.synced).equals(true)
    expect(syncResult.state.healthScore).equals(localHealthScore)
    expect(syncer['lastSyncTimestampInMs']).equals(timestamp)
  })

  // it('sync health score succeeds: optimistic write succeeds', async () => {
  //   const prevHealthScore = -1000
  //   const timestamp = Date.now()
  //
  //   const readStub = sandbox.stub(syncer.stateStorage, 'read')
  //   readStub.resolves({
  //     state: {
  //       healthScore: prevHealthScore
  //     },
  //     updatedAtInMs: timestamp
  //   })
  //
  //
  //   const clock = Sinon.useFakeTimers(timestamp)
  //   // await syncer['writeHealthScoreToDb'](prevHealthScore, 0, timestamp)
  //   await syncer.stateStorage.write('providerId', { healthScore: prevHealthScore}, timestamp);
  //
  //   // Tick time forward to exceed DB sync interval.
  //   clock.tick(6000)
  //
  //   const localHealthScoreDiff = -100
  //   const localHealthScore = -1100
  //   let syncResult
  //   try {
  //     syncResult = await syncer.maybeSyncProviderState(localHealthScoreDiff, localHealthScore)
  //   } finally {
  //     clock.restore()
  //   }
  //   expect(syncResult.synced).equals(true)
  //   expect(syncResult.state.healthScore).equals(-1100)
  //   expect(syncer.lastSyncTimestampInMs).equals(timestamp + 6000)
  // })
})
