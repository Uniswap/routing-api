import { ChainId } from '@uniswap/sdk-core'
import { SingleJsonRpcProvider } from '../../../../lib/rpc/SingleJsonRpcProvider'
import Sinon, { SinonSandbox } from 'sinon'
import chai, { assert, expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Config } from '../../../../lib/rpc/config'
import { default as bunyan } from 'bunyan'
import { dbConnectionSetup } from '../../dynamoDBLocalFixture'
import { deleteAllTables, setupTables } from '../../dbSetup'

chai.use(chaiAsPromised)

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

const config: Config = {
  ERROR_PENALTY: -50,
  HIGH_LATENCY_PENALTY: -50,
  HEALTH_SCORE_FALLBACK_THRESHOLD: -70,
  HEALTH_SCORE_RECOVER_THRESHOLD: -10,
  MAX_LATENCY_ALLOWED_IN_MS: 500,
  RECOVER_SCORE_PER_MS: 0.01,
  RECOVER_EVALUATION_WAIT_PERIOD_IN_MS: 5000,
  RECOVER_MAX_WAIT_TIME_TO_ACKNOWLEDGE_IN_MS: 20000,
  DB_SYNC_INTERVAL_IN_S: 5,
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
    provider = new SingleJsonRpcProvider({
      chainId: ChainId.MAINNET,
      name: 'mainnet'
    }, 'provider_0_url', log, 'RpcProviderHealth', config)
    sandbox = Sinon.createSandbox()
    dbConnectionSetup()
    setupTables(DB_TABLE)
  })

  afterEach(() => {
    sandbox.restore()
    deleteAllTables()
  })

  it('provider call succeeded', async () => {
    const getBlockNumber = sandbox.stub(SingleJsonRpcProvider.prototype, '_getBlockNumber' as any)
    getBlockNumber.resolves(123456)

    const blockNumber = await provider.getBlockNumber()

    expect(blockNumber).equals(123456)
  })

  it('provider call failed', async () => {
    const getBlockNumber = sandbox.stub(SingleJsonRpcProvider.prototype, '_getBlockNumber' as any)
    getBlockNumber.resolves()
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
})
