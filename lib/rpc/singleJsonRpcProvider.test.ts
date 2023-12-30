import { ChainId } from '@uniswap/sdk-core'
import { SingleJsonRpcProvider } from './singleJsonRpcProvider'
import Sinon, { SinonSandbox } from 'sinon'
import chai, { assert, expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Config } from './config'

// TODO(jie): 可以考虑删掉chaiAsPromised
chai.use(chaiAsPromised)

const config: Config = {
  ERROR_PENALTY: -50,
  HIGH_LATENCY_PENALTY: -50,
  HEALTH_SCORE_FALLBACK_THRESHOLD: -70,
  HEALTH_SCORE_RECOVER_THRESHOLD: -10,
  MAX_LATENCY_ALLOWED_IN_MS: 500,
  RECOVER_SCORE_PER_MS: 0.01,
  RECOVER_EVALUATION_THRESHOLD: -20,
  RECOVER_EVALUATION_WAIT_PERIOD_IN_MS: 5000,
}

// TODO(jie): 怎么才能让 provider._perform() 花掉指定的时间？
describe('SingleJsonRpcProvider', () => {
  let provider: SingleJsonRpcProvider
  let sandbox: SinonSandbox

  beforeEach(() => {
    provider = new SingleJsonRpcProvider(ChainId.MAINNET, 'provider_0_url', config)
    sandbox = Sinon.createSandbox()
    // provider = new SingleJsonRpcProvider(ChainId.MAINNET, 'https://mainnet.infura.io/v3/1251f92fb3044883b08bd8913471ba6e')
  })

  afterEach(() => {
    sandbox.restore()
  })

  // it('basic test', () => {
  //   const rpcProvider = new UniJsonRpcProvider(ChainId.MAINNET, ['url1', 'url2'])
  //   rpcProvider['checkProviderHealthStatus']()
  // })

  // it('test with real endpoint, single', async () => {
  //   const blockNumber = await provider.getBlockNumber()
  //   console.log(blockNumber)
  //   console.log(`${JSON.stringify(provider['perf'])}`)
  // })

  it('provider call succeeded', async () => {
    const performCall = sandbox.stub(SingleJsonRpcProvider.prototype, '_perform' as any)
    performCall.resolves(123456)

    const blockNumber = await provider.getBlockNumber()

    expect(blockNumber).equals(123456)
    expect(provider['perf'].lastCallSucceed).to.be.true
  })

  it('provider call failed', async () => {
    const performCall = sandbox.stub(SingleJsonRpcProvider.prototype, '_perform' as any)
    performCall.throws('error')
    const spy = sandbox.spy(SingleJsonRpcProvider.prototype, 'recordError' as any)

    try {
      await provider.getBlockNumber()
      assert(false)  // Should not reach.
    } catch (err: any) {
      expect(err.name).equals('error')
      expect(provider['perf'].lastCallSucceed).to.be.false
      expect(spy.calledOnce).to.be.true
    }
  })

  it('provider call too high latency', async () => {
    const performCall = sandbox.stub(SingleJsonRpcProvider.prototype, '_perform' as any)
    performCall.resolves(new Promise(resolve => setTimeout(() => resolve(123456), 1000)))
    const spy = sandbox.spy(SingleJsonRpcProvider.prototype, 'recordHighLatency' as any)

    const blockNumber = await provider.getBlockNumber()

    expect(blockNumber).equals(123456)
    expect(provider['perf'].lastCallSucceed).to.be.true
    expect(spy.calledOnce).to.be.true
  })

})
