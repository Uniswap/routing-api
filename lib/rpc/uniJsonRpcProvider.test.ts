import { assert, expect } from 'chai'

import UniJsonRpcProvider from './uniJsonRpcProvider'
import { ChainId } from '@uniswap/sdk-core'
import Sinon, { SinonSandbox } from 'sinon'
import { Config } from './config'
import { SingleJsonRpcProvider } from './singleJsonRpcProvider'

const TEST_CONFIG: Config = {
  ERROR_PENALTY: -50,
  HIGH_LATENCY_PENALTY: -50,
  HEALTH_SCORE_FALLBACK_THRESHOLD: -70,
  HEALTH_SCORE_RECOVER_THRESHOLD: -10,
  MAX_LATENCY_ALLOWED_IN_MS: 500,
  RECOVER_SCORE_PER_MS: 0.005,
  RECOVER_EVALUATION_WAIT_PERIOD_IN_MS: 5000
}

const SINGLE_RPC_PROVIDERS = {
  [ChainId.MAINNET]: [
    new SingleJsonRpcProvider(ChainId.MAINNET, `url_0`),
    new SingleJsonRpcProvider(ChainId.MAINNET, `url_1`),
    new SingleJsonRpcProvider(ChainId.MAINNET, `url_2`)
  ]
}

const resetRpcProviders = () => {
  SINGLE_RPC_PROVIDERS[ChainId.MAINNET] = [
    new SingleJsonRpcProvider(ChainId.MAINNET, `url_0`),
    new SingleJsonRpcProvider(ChainId.MAINNET, `url_1`),
    new SingleJsonRpcProvider(ChainId.MAINNET, `url_2`)
  ]
}

describe('UniJsonRpcProvider', () => {
  let uniProvider: UniJsonRpcProvider
  let sandbox: SinonSandbox

  beforeEach(() => {
    uniProvider = new UniJsonRpcProvider(ChainId.MAINNET, SINGLE_RPC_PROVIDERS[ChainId.MAINNET])
    for (const provider of uniProvider['providers']) {
      provider['config'] = TEST_CONFIG
    }
    sandbox = Sinon.createSandbox()
  })

  afterEach(() => {
    resetRpcProviders()
    sandbox.restore()
  })

  it('all provider healthy', async () => {
    const perform0 = sandbox.stub(uniProvider['providers'][0], '_perform' as any)
    perform0.resolves(123)
    const perform1 = sandbox.stub(uniProvider['providers'][1], '_perform' as any)
    perform1.resolves(123)
    const perform2 = sandbox.stub(uniProvider['providers'][2], '_perform' as any)
    perform2.resolves(123)

    expect(uniProvider.lastUsedUrl).undefined
    const blockNumber = await uniProvider.getBlockNumber()
    expect(blockNumber).equals(123)
    expect(uniProvider.lastUsedUrl).equals('url_0')
  })

  it('fallback when first provider becomes unhealthy', async () => {
    const perform0 = sandbox.stub(uniProvider['providers'][0], '_perform' as any)
    perform0.throws('error')
    const perform1 = sandbox.stub(uniProvider['providers'][1], '_perform' as any)
    perform1.resolves(123)
    const perform2 = sandbox.stub(uniProvider['providers'][2], '_perform' as any)
    perform2.resolves(123)

    uniProvider.debugPrintProviderHealthScores()

    // Two failed calls makes provider0 unhealthy
    try {
      await uniProvider.getBlockNumber()
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.name).equals('error')
    }
    uniProvider.debugPrintProviderHealthScores()
    try {
      await uniProvider.getBlockNumber()
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.name).equals('error')
    }
    uniProvider.debugPrintProviderHealthScores()

    expect(uniProvider.lastUsedUrl).equals('url_0')
    // uniProvider.debugPrintProviderHealthScores()
    expect(uniProvider.currentHealthyUrls).to.have.ordered.members(['url_1', 'url_2'])
    expect(uniProvider.currentUnhealthyUrls).to.have.ordered.members(['url_0'])

    // Now later requests will be served with provider1
    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_1')
    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_1')
    uniProvider.debugPrintProviderHealthScores()
  })

  it('unhealthy provider successfully recovered', async () => {
    const perform0 = sandbox.stub(uniProvider['providers'][0], '_perform' as any)
    perform0.throws('error')
    const perform1 = sandbox.stub(uniProvider['providers'][1], '_perform' as any)
    perform1.resolves(123)
    const perform2 = sandbox.stub(uniProvider['providers'][2], '_perform' as any)
    perform2.resolves(123)

    const clock = Sinon.useFakeTimers(Date.now())

    uniProvider.debugPrintProviderHealthScores

    // Two failed calls makes provider0 unhealthy
    try {
      await uniProvider.getBlockNumber()
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.name).equals('error')
    }
    uniProvider.debugPrintProviderHealthScores()
    try {
      await uniProvider.getBlockNumber()
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.name).equals('error')
    }

    expect(uniProvider.lastUsedUrl).equals('url_0')
    expect(uniProvider.currentHealthyUrls).to.have.ordered.members(['url_1', 'url_2'])
    expect(uniProvider.currentUnhealthyUrls).to.have.ordered.members(['url_0'])
    uniProvider.debugPrintProviderHealthScores()

    // We advance some time. During this the failed provider starts recovering.
    clock.tick(10 * 1000)  // Advance 10 seconds
    perform0.resolves(123)

    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_1')
    uniProvider.debugPrintProviderHealthScores()
    // Provider0 hasn't been considered fully recovered yet.
    expect(uniProvider.currentHealthyUrls).to.have.ordered.members(['url_1', 'url_2'])
    expect(uniProvider.currentUnhealthyUrls).to.have.ordered.members(['url_0'])

    clock.tick(10 * 1000)  // Advance 10 seconds

    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_1')
    uniProvider.debugPrintProviderHealthScores()
    // Provider0 is fully recovered.
    expect(uniProvider.currentHealthyUrls).to.have.ordered.members(['url_0', 'url_1', 'url_2'])
    expect(uniProvider.currentUnhealthyUrls).to.be.empty

    clock.tick(1000)

    // From now on, we go back to use the original preferred provider (provider0)
    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_0')
    // Healthy provider list is updated.
    expect(uniProvider.currentHealthyUrls).to.have.ordered.members(['url_0', 'url_1', 'url_2'])
    expect(uniProvider.currentUnhealthyUrls).to.be.empty
    uniProvider.debugPrintProviderHealthScores()

    // Now later requests will be served with provider0
    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_0')
    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_0')

    clock.restore()
  })

  it('unhealthy provider has some challenge during recovering', async () => {
    const perform0 = sandbox.stub(uniProvider['providers'][0], '_perform' as any)
    perform0.throws('error')
    const perform1 = sandbox.stub(uniProvider['providers'][1], '_perform' as any)
    perform1.resolves(123)
    const perform2 = sandbox.stub(uniProvider['providers'][2], '_perform' as any)
    perform2.resolves(123)

    const clock = Sinon.useFakeTimers(Date.now())

    uniProvider.debugPrintProviderHealthScores()

    // Two failed calls makes provider0 unhealthy
    try {
      await uniProvider.getBlockNumber()
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.name).equals('error')
    }
    uniProvider.debugPrintProviderHealthScores()
    try {
      await uniProvider.getBlockNumber()
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.name).equals('error')
    }

    expect(uniProvider.lastUsedUrl).equals('url_0')
    expect(uniProvider.currentHealthyUrls).to.have.ordered.members(['url_1', 'url_2'])
    expect(uniProvider.currentUnhealthyUrls).to.have.ordered.members(['url_0'])
    uniProvider.debugPrintProviderHealthScores()

    // We advance some time. During this the failed provider starts recovering.
    const unhealthyProvider = uniProvider['providers'][0]
    const scoreBeforeRecovering = unhealthyProvider['healthScore']
    clock.tick(1000)  // Advance 1 seconds
    perform0.resolves(123)

    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_1')
    uniProvider.debugPrintProviderHealthScores()
    expect(uniProvider.currentHealthyUrls).to.have.ordered.members(['url_1', 'url_2'])
    expect(uniProvider.currentUnhealthyUrls).to.have.ordered.members(['url_0'])
    // 1 second isn't enough to start re-evaluate the failed provider.
    expect(unhealthyProvider['healthScore']).equals(scoreBeforeRecovering)

    clock.tick(10 * 1000)  // Advance 10 seconds

    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_1')
    uniProvider.debugPrintProviderHealthScores()
    // Provider0 has recovered quite a bit. But still not enough to be considered as fully recovered.
    expect(uniProvider.currentHealthyUrls).to.have.ordered.members(['url_1', 'url_2'])
    expect(uniProvider.currentUnhealthyUrls).to.have.ordered.members(['url_0'])
    expect(unhealthyProvider['healthScore']).equals(-45)

    clock.tick(10 * 1000)  // Advance 10 seconds
    perform0.throws('error during recovery evaluation')

    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_1')
    uniProvider.debugPrintProviderHealthScores()
    expect(uniProvider.currentHealthyUrls).to.have.ordered.members(['url_1', 'url_2'])
    expect(uniProvider.currentUnhealthyUrls).to.have.ordered.members(['url_0'])
    // Provider0 failed again during recovery evaluation.
    expect(unhealthyProvider['healthScore']).equals(-95)
  })

  it('healthy provider can also drop score and resume score', async () => {
    const perform0 = sandbox.stub(uniProvider['providers'][0], '_perform' as any)
    perform0.throws('error')
    const perform1 = sandbox.stub(uniProvider['providers'][1], '_perform' as any)
    perform1.resolves(123)
    const perform2 = sandbox.stub(uniProvider['providers'][2], '_perform' as any)
    perform2.resolves(123)

    const clock = Sinon.useFakeTimers(Date.now())

    uniProvider.debugPrintProviderHealthScores()

    // One failed call reduce provider0's score, but it's still considered as healthy
    try {
      await uniProvider.getBlockNumber()
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.name).equals('error')
    }
    uniProvider.debugPrintProviderHealthScores()
    const healthyProvider = uniProvider['providers'][0]
    expect(healthyProvider['healthScore']).equals(-50)

    clock.tick(1000 * 2)  // Advance 2 seconds
    perform0.resolves(123)

    await uniProvider.getBlockNumber()
    uniProvider.debugPrintProviderHealthScores()
    expect(healthyProvider['healthScore']).equals(-40)

    clock.tick(1000 * 2)  // Advance 2 seconds

    await uniProvider.getBlockNumber()
    uniProvider.debugPrintProviderHealthScores()
    expect(healthyProvider['healthScore']).equals(-30)

    // Score deduct and resume doesn't make it a less-preferred provider, as long as it's considered as healthy
    expect(uniProvider.currentHealthyUrls).to.have.ordered.members(['url_0', 'url_1', 'url_2'])
    expect(uniProvider.currentUnhealthyUrls).to.be.empty
  })

  it('no healthy provider available', async () => {
    uniProvider['providers'][0]['isRecovering'] = true
    uniProvider['providers'][1]['isRecovering'] = true
    uniProvider['providers'][2]['isRecovering'] = true

    try {
      await uniProvider.getBlockNumber()
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.message).equals('No healthy provider available')
    }
  })

  it('test selectPreferredProvider: without custom ranking nor weights', async () => {
    expect(uniProvider['selectPreferredProvider']().url).equals('url_0')
  })

  it('test selectPreferredProvider: with custom ranking', async () => {
    uniProvider = new UniJsonRpcProvider(ChainId.MAINNET, SINGLE_RPC_PROVIDERS[ChainId.MAINNET], [2, 1, 0], undefined)
    for (const provider of uniProvider['providers']) {
      provider['config'] = TEST_CONFIG
    }

    expect(uniProvider['selectPreferredProvider']().url).equals('url_2')

    // Two failed calls makes provider2 unhealthy
    const perform2 = sandbox.stub(uniProvider['providers'][2], '_perform' as any)
    perform2.throws('error')
    try {
      await uniProvider.getBlockNumber()
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.name).equals('error')
    }
    uniProvider.debugPrintProviderHealthScores()
    try {
      await uniProvider.getBlockNumber()
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.name).equals('error')
    }
    uniProvider.debugPrintProviderHealthScores()

    expect(uniProvider['selectPreferredProvider']().url).equals('url_1')

    // Two failed calls makes provider1 unhealthy
    const perform1 = sandbox.stub(uniProvider['providers'][1], '_perform' as any)
    perform1.throws('error')
    try {
      await uniProvider.getBlockNumber()
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.name).equals('error')
    }
    uniProvider.debugPrintProviderHealthScores()
    try {
      await uniProvider.getBlockNumber()
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.name).equals('error')
    }
    uniProvider.debugPrintProviderHealthScores()

    expect(uniProvider['selectPreferredProvider']().url).equals('url_0')
  })

  it('test selectPreferredProvider: with weights', async () => {
    uniProvider = new UniJsonRpcProvider(ChainId.MAINNET, SINGLE_RPC_PROVIDERS[ChainId.MAINNET], undefined, [4, 1, 3])
    for (const provider of uniProvider['providers']) {
      provider['config'] = TEST_CONFIG
    }

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

  it('enable disable provider switch', async () => {
    const perform0 = sandbox.stub(uniProvider['providers'][0], '_perform' as any)
    perform0.throws('error')

    // Two failed calls makes provider0 unhealthy
    try {
      await uniProvider.getBlockNumber()
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.name).equals('error')
    }
    try {
      await uniProvider.getBlockNumber()
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.name).equals('error')
    }
    uniProvider.debugPrintProviderHealthScores()
    uniProvider.disableProviderAutoSwitch()

    try {
      await uniProvider.getBlockNumber()
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.message).equals('Forced to use last used provider which is unhealthy')
    }
  })

  it('test reorderHealthyProviders()', () => {
    uniProvider = new UniJsonRpcProvider(ChainId.MAINNET, SINGLE_RPC_PROVIDERS[ChainId.MAINNET], [2, 0, 1])
    for (const provider of uniProvider['providers']) {
      provider['config'] = TEST_CONFIG
    }
    const providers = uniProvider['providers']
    uniProvider['reorderProviders'](providers)
    expect(providers[0].url).to.be.equal('url_1')
    expect(providers[1].url).to.be.equal('url_2')
    expect(providers[2].url).to.be.equal('url_0')
  })

  it('multiple UniJsonRpcProvider share the same instances of SingleJsonRpcProvider', async () => {
    const uniProvider1 = new UniJsonRpcProvider(ChainId.MAINNET, SINGLE_RPC_PROVIDERS[ChainId.MAINNET])
    for (const provider of uniProvider1['providers']) {
      provider['config'] = TEST_CONFIG
    }

    const uniProvider2 = new UniJsonRpcProvider(ChainId.MAINNET, SINGLE_RPC_PROVIDERS[ChainId.MAINNET])
    for (const provider of uniProvider2['providers']) {
      provider['config'] = TEST_CONFIG
    }

    const perform0 = sandbox.stub(uniProvider['providers'][0], '_perform' as any)
    perform0.throws('error')

    // Two failed calls makes provider0 unhealthy
    try {
      await uniProvider.getBlockNumber()
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.name).equals('error')
    }
    try {
      await uniProvider.getBlockNumber()
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.name).equals('error')
    }

    expect(uniProvider['selectPreferredProvider']().url).equals('url_1')
    expect(uniProvider1['selectPreferredProvider']().url).equals('url_1')
    expect(uniProvider2['selectPreferredProvider']().url).equals('url_1')

    const perform1 = sandbox.stub(uniProvider['providers'][1], '_perform' as any)
    perform1.throws('error')

    // Two failed calls makes provider1 unhealthy
    try {
      await uniProvider.getBlockNumber()
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.name).equals('error')
    }
    try {
      await uniProvider.getBlockNumber()
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.name).equals('error')
    }

    expect(uniProvider['selectPreferredProvider']().url).equals('url_2')
    expect(uniProvider1['selectPreferredProvider']().url).equals('url_2')
    expect(uniProvider2['selectPreferredProvider']().url).equals('url_2')
  })

  it('multiple UniJsonRpcProvider share the same instances of SingleJsonRpcProvider, but with different rankings', async () => {
    const uniProvider1 = new UniJsonRpcProvider(ChainId.MAINNET, SINGLE_RPC_PROVIDERS[ChainId.MAINNET], [0, 2, 1])
    for (const provider of uniProvider1['providers']) {
      provider['config'] = TEST_CONFIG
    }

    const perform0 = sandbox.stub(uniProvider['providers'][0], '_perform' as any)
    perform0.throws('error')

    // Two failed calls makes provider0 unhealthy
    try {
      await uniProvider.getBlockNumber()
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.name).equals('error')
    }
    try {
      await uniProvider.getBlockNumber()
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.name).equals('error')
    }

    expect(uniProvider['selectPreferredProvider']().url).equals('url_1')
    expect(uniProvider1['selectPreferredProvider']().url).equals('url_2')

    const perform1 = sandbox.stub(uniProvider['providers'][1], '_perform' as any)
    perform1.throws('error')

    // Two failed calls makes provider1 unhealthy
    try {
      await uniProvider.getBlockNumber()
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.name).equals('error')
    }
    try {
      await uniProvider.getBlockNumber()
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.name).equals('error')
    }

    expect(uniProvider['selectPreferredProvider']().url).equals('url_2')
    expect(uniProvider1['selectPreferredProvider']().url).equals('url_2')
  })
})
