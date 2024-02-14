import { ProviderStateSyncer } from '../../../../lib/rpc/ProviderStateSyncer'
import { DynamoDBTableProps } from '../../../../bin/stacks/routing-database-stack'
import { ProviderState, ProviderStateDiff } from '../../../../lib/rpc/ProviderState'
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
    const lastLatencyEvaluationApiName = 'someApi'

    let syncResult: ProviderState | null
    try {
      syncResult = await syncer.maybeSyncWithRepository(
        localHealthScoreDiff,
        localHealthScore,
        lastEvaluatedLatencyInMs,
        lastLatencyEvaluationTimestampInMs,
        lastLatencyEvaluationApiName
      )
    } finally {
      clock.restore()
    }

    expect(syncResult !== null)
    expect(syncResult!.healthScore).equals(localHealthScore)
    expect(syncer.lastSyncTimestampInMs).equals(timestamp)

    expect(writeStub.getCall(0).args[1]).deep.equals({
      healthScore: -1100,
      latencies: [
        {
          timestampInMs: lastLatencyEvaluationTimestampInMs,
          latencyInMs: 222,
          apiName: 'someApi',
        },
      ],
    })
  })

  it('test calculateNewState: old state is null', async () => {
    const timestamp = Date.now()
    const stateDiff: ProviderStateDiff = {
      healthScore: 0,
      healthScoreDiff: -100,
      latency: {
        timestampInMs: timestamp,
        latencyInMs: 1000,
        apiName: 'api1',
      },
    }
    const newState = syncer['calculateNewState'](null, stateDiff)
    expect(newState).deep.equals({
      healthScore: 0,
      latencies: [
        {
          timestampInMs: timestamp,
          latencyInMs: 1000,
          apiName: 'api1',
        },
      ],
    })
  })

  it('test calculateNewState: old state is not null', async () => {
    const timestamp = Date.now()
    const oldState: ProviderState = {
      healthScore: -500,
      latencies: [
        {
          timestampInMs: timestamp - 2000,
          latencyInMs: 2000,
          apiName: 'api1',
        },
        {
          timestampInMs: timestamp - 1000,
          latencyInMs: 1000,
          apiName: 'api2',
        },
      ],
    }
    const stateDiff: ProviderStateDiff = {
      healthScore: 0,
      healthScoreDiff: -100,
      latency: {
        timestampInMs: timestamp,
        latencyInMs: 100,
        apiName: 'api3',
      },
    }
    const newState = syncer['calculateNewState'](oldState, stateDiff)
    expect(newState).deep.equals({
      healthScore: -600,
      latencies: [
        {
          timestampInMs: timestamp - 2000,
          latencyInMs: 2000,
          apiName: 'api1',
        },
        {
          timestampInMs: timestamp - 1000,
          latencyInMs: 1000,
          apiName: 'api2',
        },
        {
          timestampInMs: timestamp,
          latencyInMs: 100,
          apiName: 'api3',
        },
      ],
    })
  })

  it('test calculateNewState: old state is not null and duplicates with new diff', async () => {
    const timestamp = Date.now()
    const oldState: ProviderState = {
      healthScore: -500,
      latencies: [
        {
          timestampInMs: timestamp - 2000,
          latencyInMs: 2000,
          apiName: 'api1',
        },
        {
          timestampInMs: timestamp - 1000,
          latencyInMs: 1000,
          apiName: 'api2',
        },
      ],
    }
    const stateDiff: ProviderStateDiff = {
      healthScore: 0,
      healthScoreDiff: -100,
      latency: {
        timestampInMs: timestamp - 1000,
        latencyInMs: 100,
        apiName: 'api3',
      },
    }
    const newState = syncer['calculateNewState'](oldState, stateDiff)
    // Diff is not included.
    expect(newState).deep.equals({
      healthScore: -600,
      latencies: [
        {
          timestampInMs: timestamp - 2000,
          latencyInMs: 2000,
          apiName: 'api1',
        },
        {
          timestampInMs: timestamp - 1000,
          latencyInMs: 1000,
          apiName: 'api2',
        },
      ],
    })
  })
})
