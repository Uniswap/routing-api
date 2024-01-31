import { ProviderStateSyncer } from '../../../../lib/rpc/ProviderStateSyncer'
import { DynamoDBTableProps } from '../../../../bin/stacks/routing-database-stack'
import { ProviderState } from '../../../../lib/rpc/ProviderState'
import { default as bunyan } from 'bunyan'
import { expect } from 'chai'
import Sinon, { SinonSandbox } from 'sinon'

const log = bunyan.createLogger({
  name: 'ProviderStateSyncerTest',
  serializers: bunyan.stdSerializers,
  level: bunyan.ERROR,
})

describe('ProviderStateSyncer', () => {
  const syncer = new ProviderStateSyncer(DynamoDBTableProps.RpcProviderStateDbTable.Name, 'providerId', 5, 300, log)
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

    const timestamp = Date.now()
    const clock = Sinon.useFakeTimers(timestamp)

    const localHealthScoreDiff = -100
    const localHealthScore = -1100
    const lastEvaluatedLatencyInMs = 222
    const lastLatencyEvaluationTimestampInMs = timestamp - 1000

    let syncResult: ProviderState | null
    try {
      syncResult = await syncer.maybeSyncWithRepository(
        localHealthScoreDiff,
        localHealthScore,
        lastEvaluatedLatencyInMs,
        lastLatencyEvaluationTimestampInMs
      )
    } finally {
      clock.restore()
    }

    expect(syncResult !== null)
    expect(syncResult!.healthScore).equals(localHealthScore)
    expect(syncer.lastSyncTimestampInMs).equals(timestamp)

    const writeArg = writeStub.getCall(0).args[1]
    console.log(writeArg)
    expect(writeStub.getCall(0).args[1]).deep.equals({
      healthScore: -1100,
      latencies: [{ timestampInMs: lastLatencyEvaluationTimestampInMs, latencyInMs: 222 }],
    })
  })
})
