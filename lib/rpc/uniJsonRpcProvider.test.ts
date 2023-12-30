import { assert, expect } from 'chai'

import UniJsonRpcProvider from './uniJsonRpcProvider'
import { ChainId } from '@uniswap/sdk-core'
// import { SingleJsonRpcProvider } from './singleJsonRpcProvider'
import Sinon, { SinonSandbox } from 'sinon'
import { Config } from './config'
// import { SingleJsonRpcProvider } from './singleJsonRpcProvider'
// import { StaticJsonRpcProvider } from '@ethersproject/providers'

const TEST_CONFIG: Config = {
  ERROR_PENALTY: -50,
  HIGH_LATENCY_PENALTY: -50,
  HEALTH_SCORE_FALLBACK_THRESHOLD: -70,
  HEALTH_SCORE_RECOVER_THRESHOLD: -10,
  MAX_LATENCY_ALLOWED_IN_MS: 500,
  RECOVER_SCORE_PER_MS: 0.005,
  RECOVER_EVALUATION_THRESHOLD: -20,
  RECOVER_EVALUATION_WAIT_PERIOD_IN_MS: 5000,
}

describe('UniJsonRpcProvider', () => {
  let uniProvider: UniJsonRpcProvider
  let sandbox: SinonSandbox

  beforeEach(() => {
    uniProvider = new UniJsonRpcProvider(ChainId.MAINNET,
      ['url_0', 'url_1', 'url_2'], undefined, TEST_CONFIG)
    sandbox = Sinon.createSandbox()
  })

  afterEach(() => {
    sandbox.restore()
  })

  it('all provider healthy', async () => {
    const perform0 = sandbox.stub(uniProvider['healthyProviders'][0], '_perform' as any)
    perform0.resolves(123)
    const perform1 = sandbox.stub(uniProvider['healthyProviders'][1], '_perform' as any)
    perform1.resolves(123)
    const perform2 = sandbox.stub(uniProvider['healthyProviders'][2], '_perform' as any)
    perform2.resolves(123)

    expect(uniProvider.lastUsedUrl).undefined
    const blockNumber = await uniProvider.getBlockNumber()
    expect(blockNumber).equals(123)
    expect(uniProvider.lastUsedUrl).equals('url_0')
  })

  it('fallback when first provider becomes unhealthy', async () => {
    const perform0 = sandbox.stub(uniProvider['healthyProviders'][0], '_perform' as any)
    perform0.throws('error')
    const perform1 = sandbox.stub(uniProvider['healthyProviders'][1], '_perform' as any)
    perform1.resolves(123)
    const perform2 = sandbox.stub(uniProvider['healthyProviders'][2], '_perform' as any)
    perform2.resolves(123)

    uniProvider['debugPrintProviderHealthScores']()

    // Two failed calls makes provider0 unhealthy
    try {
      await uniProvider.getBlockNumber()
      assert(false)  // Should not reach.
    } catch (err: any) {
      expect(err.name).equals('error')
    }
    uniProvider['debugPrintProviderHealthScores']()
    try {
      await uniProvider.getBlockNumber()
      assert(false)  // Should not reach.
    } catch (err: any) {
      expect(err.name).equals('error')
    }

    expect(uniProvider.lastUsedUrl).equals('url_0')
    // uniProvider['debugPrintProviderHealthScores']()
    expect(uniProvider.currentHealthyUrls).to.have.ordered.members(['url_1', 'url_2'])
    expect(uniProvider.currentUnhealthyUrls).to.have.ordered.members(['url_0'])

    // Now later requests will be served with provider1
    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_1')
    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_1')
  })

  it('unhealthy provider successfully recovered', async () => {
    const perform0 = sandbox.stub(uniProvider['healthyProviders'][0], '_perform' as any)
    perform0.throws('error')
    const perform1 = sandbox.stub(uniProvider['healthyProviders'][1], '_perform' as any)
    perform1.resolves(123)
    const perform2 = sandbox.stub(uniProvider['healthyProviders'][2], '_perform' as any)
    perform2.resolves(123)

    const clock = Sinon.useFakeTimers(Date.now())

    uniProvider['debugPrintProviderHealthScores']()

    // Two failed calls makes provider0 unhealthy
    try {
      await uniProvider.getBlockNumber()
      assert(false)  // Should not reach.
    } catch (err: any) {
      expect(err.name).equals('error')
    }
    uniProvider['debugPrintProviderHealthScores']()
    try {
      await uniProvider.getBlockNumber()
      assert(false)  // Should not reach.
    } catch (err: any) {
      expect(err.name).equals('error')
    }

    expect(uniProvider.lastUsedUrl).equals('url_0')
    expect(uniProvider.currentHealthyUrls).to.have.ordered.members(['url_1', 'url_2'])
    expect(uniProvider.currentUnhealthyUrls).to.have.ordered.members(['url_0'])
    uniProvider['debugPrintProviderHealthScores']()

    // We advance some time. During this the failed provider starts recovering.
    clock.tick(10 * 1000)  // Advance 10 seconds
    perform0.resolves(123)

    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_1')
    uniProvider['debugPrintProviderHealthScores']()
    // Provider0 hasn't been considered fully recovered yet.
    expect(uniProvider.currentHealthyUrls).to.have.ordered.members(['url_1', 'url_2'])
    expect(uniProvider.currentUnhealthyUrls).to.have.ordered.members(['url_0'])

    clock.tick(10 * 1000)  // Advance 10 seconds

    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_1')
    uniProvider['debugPrintProviderHealthScores']()
    // Provider0 is considered fully recovered, but healthy provider list hasn't been updated yet (because only when
    // serving a new request can we update the healthy provider list)
    expect(uniProvider.currentHealthyUrls).to.have.ordered.members(['url_1', 'url_2'])
    expect(uniProvider.currentUnhealthyUrls).to.have.ordered.members(['url_0'])
    // but a shadow the failed provider has been evaluated and resumed to healthy score.

    clock.tick(1000)

    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_1')
    // Healthy provider list is updated.
    expect(uniProvider.currentHealthyUrls).to.have.ordered.members(['url_0', 'url_1', 'url_2'])
    expect(uniProvider.currentUnhealthyUrls).to.be.empty
    uniProvider['debugPrintProviderHealthScores']()

    // From now on, we go back to use the original preferred provider (provider0)
    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_0')
    expect(uniProvider.currentHealthyUrls).to.have.ordered.members(['url_0', 'url_1', 'url_2'])
    expect(uniProvider.currentUnhealthyUrls).to.be.empty
    uniProvider['debugPrintProviderHealthScores']()

    // Now later requests will be served with provider0
    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_0')
    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_0')

    clock.restore()
  })

  it('unhealthy provider has some challenge during recovering', async () => {
    const perform0 = sandbox.stub(uniProvider['healthyProviders'][0], '_perform' as any)
    perform0.throws('error')
    const perform1 = sandbox.stub(uniProvider['healthyProviders'][1], '_perform' as any)
    perform1.resolves(123)
    const perform2 = sandbox.stub(uniProvider['healthyProviders'][2], '_perform' as any)
    perform2.resolves(123)

    const clock = Sinon.useFakeTimers(Date.now())

    uniProvider['debugPrintProviderHealthScores']()

    // Two failed calls makes provider0 unhealthy
    try {
      await uniProvider.getBlockNumber()
      assert(false)  // Should not reach.
    } catch (err: any) {
      expect(err.name).equals('error')
    }
    uniProvider['debugPrintProviderHealthScores']()
    try {
      await uniProvider.getBlockNumber()
      assert(false)  // Should not reach.
    } catch (err: any) {
      expect(err.name).equals('error')
    }

    expect(uniProvider.lastUsedUrl).equals('url_0')
    expect(uniProvider.currentHealthyUrls).to.have.ordered.members(['url_1', 'url_2'])
    expect(uniProvider.currentUnhealthyUrls).to.have.ordered.members(['url_0'])
    uniProvider['debugPrintProviderHealthScores']()

    // We advance some time. During this the failed provider starts recovering.
    const unhealthyProvider = uniProvider['unhealthyProviders'][0]
    const scoreBeforeRecovering = unhealthyProvider['healthScore']
    clock.tick(1000)  // Advance 1 seconds
    perform0.resolves(123)

    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_1')
    uniProvider['debugPrintProviderHealthScores']()
    expect(uniProvider.currentHealthyUrls).to.have.ordered.members(['url_1', 'url_2'])
    expect(uniProvider.currentUnhealthyUrls).to.have.ordered.members(['url_0'])
    // 1 second isn't enough to start re-evaluate the failed provider.
    expect(unhealthyProvider['healthScore']).equals(scoreBeforeRecovering)

    clock.tick(10 * 1000)  // Advance 10 seconds

    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_1')
    uniProvider['debugPrintProviderHealthScores']()
    // Provider0 has recovered quite a bit. But still not enough to be considered as fully recovered.
    expect(uniProvider.currentHealthyUrls).to.have.ordered.members(['url_1', 'url_2'])
    expect(uniProvider.currentUnhealthyUrls).to.have.ordered.members(['url_0'])
    expect(unhealthyProvider['healthScore']).equals(-45)

    clock.tick(10 * 1000)  // Advance 10 seconds
    perform0.throws('error during recovery evaluation')

    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_1')
    uniProvider['debugPrintProviderHealthScores']()
    expect(uniProvider.currentHealthyUrls).to.have.ordered.members(['url_1', 'url_2'])
    expect(uniProvider.currentUnhealthyUrls).to.have.ordered.members(['url_0'])
    // Provider0 failed again during recovery evaluation.
    expect(unhealthyProvider['healthScore']).equals(-95)
  })

  it('no healthy provider available', async () => {
    uniProvider['healthyProviders'] = []

    try {
      await uniProvider.getBlockNumber()
      assert(false)  // Should not reach.
    } catch (err: any) {
      expect(err.message).equals('No healthy providers available')
    }
  })

  it('test selectPreferredProvider: without weights', async () => {
    expect(uniProvider['selectPreferredProvider']().url).equals('url_0')
  })

  it('test selectPreferredProvider: with weights', async () => {
    uniProvider = new UniJsonRpcProvider(ChainId.MAINNET,
      ['url_0', 'url_1', 'url_2'], [4, 1, 3], TEST_CONFIG)

    expect(uniProvider['urlWeightSum']).equals(8)

    uniProvider['updateHealthyProviderUrlWeightSum']()
    expect(uniProvider['urlWeightSum']).equals(8)

    const randStub = Sinon.stub(Math, 'random')
    randStub.returns(0.0)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_0')
    randStub.returns(0.1)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_0')
    randStub.returns(0.5)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_0')
    randStub.returns(0.51)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_1')
    randStub.returns(0.62)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_1')
    randStub.returns(0.63)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_2')
    randStub.returns(0.99)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_2')
  })

  // it('basic test', () => {
  //   const rpcProvider = new UniJsonRpcProvider(ChainId.MAINNET, ['url1', 'url2'])
  //   rpcProvider['checkProviderHealthStatus']()
  // })

  // it('test reorderHealthyProviders()', () => {
  //   uniProvider['healthyProviders'].reverse()
  //   uniProvider['reorderHealthyProviders']()
  //   expect(uniProvider['healthyProviders'][0].url).to.be.equal('url_0')
  //   expect(uniProvider['healthyProviders'][1].url).to.be.equal('url_1')
  //   expect(uniProvider['healthyProviders'][2].url).to.be.equal('url_2')
  // })

  // it('test with real endpoint, single', async () => {
  //   const provider = new SingleJsonRpcProvider(ChainId.MAINNET, 'https://mainnet.infura.io/v3/1251f92fb3044883b08bd8913471ba6e')
  //   const blockNumber = await provider.getBlockNumber()
  //   console.log(blockNumber)
  //   console.log(`${JSON.stringify(provider['perf'])}`)
  // })

  // it('test with real endpoint, uni', async () => {
  //   const provider = new UniJsonRpcProvider(ChainId.MAINNET, [
  //     'https://mainnet.infura.io/v3/1251f92fb3044883b08bd8913471ba6e',
  //     'https://eth-mainnet.g.alchemy.com/v2/PC1uzrHueA8AdsD8jdQPcXFt4IUKSm-g',
  //   ])
  //   const blockNumber = await provider.getBlockNumber()
  //   console.log(blockNumber)
  // })
})
