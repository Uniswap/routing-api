import { ChainId } from '@uniswap/sdk-core'
import { SingleJsonRpcProvider } from '../../../../lib/rpc/SingleJsonRpcProvider'
import Sinon, { SinonSandbox } from 'sinon'
import chai, { assert, expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { SingleJsonRpcProviderConfig } from '../../../../lib/rpc/config'
import { default as bunyan } from 'bunyan'
import { ProviderStateSyncer } from '../../../../lib/rpc/ProviderStateSyncer'
import { ProviderState } from '../../../../lib/rpc/ProviderState'

chai.use(chaiAsPromised)

const delay = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const config: SingleJsonRpcProviderConfig = {
  HEALTH_EVALUATION_WAIT_PERIOD_IN_S: 5,
  ERROR_PENALTY: -50,
  HIGH_LATENCY_PENALTY: -50,
  HEALTH_SCORE_FALLBACK_THRESHOLD: -70,
  HEALTH_SCORE_RECOVER_THRESHOLD: -10,
  MAX_LATENCY_ALLOWED_IN_MS: 500,
  RECOVER_SCORE_PER_MS: 0.01,
  RECOVER_MAX_WAIT_TIME_TO_ACKNOWLEDGE_IN_MS: 20000,
  ENABLE_DB_SYNC: false,
  DB_SYNC_INTERVAL_IN_S: 5,
  LATENCY_EVALUATION_WAIT_PERIOD_IN_S: 15000,
  LATENCY_STAT_HISTORY_WINDOW_LENGTH_IN_S: 300,
}

const log = bunyan.createLogger({
  name: 'SingleJsonRpcProviderTest',
  serializers: bunyan.stdSerializers,
  level: bunyan.ERROR,
})

describe('SingleJsonRpcProvider', () => {
  let provider: SingleJsonRpcProvider
  let sandbox: SinonSandbox

  beforeEach(() => {
    provider = new SingleJsonRpcProvider(
      {
        chainId: ChainId.MAINNET,
        name: 'mainnet',
      },
      'provider_0_url',
      log,
      config
    )
    sandbox = Sinon.createSandbox()
  })

  afterEach(() => {
    sandbox.restore()
  })

  it('provider call succeeded', async () => {
    const getBlockNumber = sandbox.stub(SingleJsonRpcProvider.prototype, '_getBlockNumber' as any)
    getBlockNumber.resolves(123456)

    const blockNumber = await provider.getBlockNumber()

    expect(blockNumber).equals(123456)
  })

  it('provider call failed', async () => {
    const getBlockNumber = sandbox.stub(SingleJsonRpcProvider.prototype, '_getBlockNumber' as any)
    getBlockNumber.rejects('error')
    const spy = sandbox.spy(SingleJsonRpcProvider.prototype, 'recordError' as any)

    try {
      await provider.getBlockNumber()
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.name).equals('error')
      expect(spy.calledOnce).to.be.true
    }
  })

  it('provider call too high latency', async () => {
    const getBlockNumber = sandbox.stub(SingleJsonRpcProvider.prototype, '_getBlockNumber' as any)
    getBlockNumber.resolves(new Promise((resolve) => setTimeout(() => resolve(123456), 1000)))
    const spy = sandbox.spy(SingleJsonRpcProvider.prototype, 'recordHighLatency' as any)

    const blockNumber = await provider.getBlockNumber()

    expect(blockNumber).equals(123456)
    expect(spy.calledOnce).to.be.true
  })

  it('maybeSyncHealthScore', async () => {
    provider['enableDbSync'] = true
    const DB_HEALTH_SCORE = -1000
    const stubSyncer = sandbox.createStubInstance(ProviderStateSyncer)
    stubSyncer.maybeSyncWithRepository.returns(Promise.resolve({ healthScore: DB_HEALTH_SCORE } as ProviderState))
    provider['providerStateSyncer'] = stubSyncer

    const getBlockNumber = sandbox.stub(SingleJsonRpcProvider.prototype, '_getBlockNumber' as any)
    getBlockNumber.resolves(123456)

    const blockNumber = await provider.getBlockNumber()
    expect(blockNumber).equals(123456)

    // Wait to make sure all callbacks are executed.
    await delay(10)

    expect(provider['healthScore']).equals(DB_HEALTH_SCORE)
    expect(provider['healthScoreAtLastSync']).equals(DB_HEALTH_SCORE)
  })

  it('test updateLatencyStat', async () => {
    const timestampInMs = Date.now()
    const state: ProviderState = {
      healthScore: 0,
      latencies: [
        {
          timestampInMs: timestampInMs,
          latencyInMs: 222,
          apiName: 'api1',
        },
        {
          timestampInMs: timestampInMs - 1000,
          latencyInMs: 444,
          apiName: 'api2',
        },
        {
          timestampInMs: timestampInMs - 350000,
          latencyInMs: 789,
          apiName: 'api3',
        },
      ],
    }
    provider['updateLatencyStat'](state)
    expect(provider.recentAverageLatency()).equals(333)
  })
})
