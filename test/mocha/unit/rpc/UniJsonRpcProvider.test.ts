import { assert, expect } from 'chai'

import { UniJsonRpcProvider } from '../../../../lib/rpc/UniJsonRpcProvider'
import { ChainId } from '@uniswap/sdk-core'
import Sinon, { SinonSandbox } from 'sinon'
import {
  ProviderSpecialWeight,
  SingleJsonRpcProviderConfig,
  UniJsonRpcProviderConfig,
} from '../../../../lib/rpc/config'
import { SingleJsonRpcProvider } from '../../../../lib/rpc/SingleJsonRpcProvider'
import { default as bunyan } from 'bunyan'

const UNI_PROVIDER_TEST_CONFIG: UniJsonRpcProviderConfig = {
  RECOVER_EVALUATION_WAIT_PERIOD_IN_MS: 5000,
  ENABLE_SHADOW_LATENCY_EVALUATION: false,
  LATENCY_EVALUATION_WAIT_PERIOD_IN_S: 15,
  DEFAULT_INITIAL_WEIGHT: 1000,
}

const SINGLE_PROVIDER_TEST_CONFIG: SingleJsonRpcProviderConfig = {
  ERROR_PENALTY: -50,
  HIGH_LATENCY_PENALTY: -50,
  HEALTH_SCORE_FALLBACK_THRESHOLD: -70,
  HEALTH_SCORE_RECOVER_THRESHOLD: -10,
  MAX_LATENCY_ALLOWED_IN_MS: 500,
  RECOVER_SCORE_PER_MS: 0.005,
  RECOVER_MAX_WAIT_TIME_TO_ACKNOWLEDGE_IN_MS: 20000,
  ENABLE_DB_SYNC: false,
  DB_SYNC_INTERVAL_IN_S: 5,
  LATENCY_STAT_HISTORY_WINDOW_LENGTH_IN_S: 300,
  LATENCY_EVALUATION_WAIT_PERIOD_IN_S: 15,
}

const log = bunyan.createLogger({
  name: 'SingleJsonRpcProviderTest',
  serializers: bunyan.stdSerializers,
  level: bunyan.ERROR,
})

const createNewSingleJsonRpcProviders = () => [
  new SingleJsonRpcProvider({ name: 'mainnet', chainId: ChainId.MAINNET }, `url_0`, log, SINGLE_PROVIDER_TEST_CONFIG),
  new SingleJsonRpcProvider({ name: 'mainnet', chainId: ChainId.MAINNET }, `url_1`, log, SINGLE_PROVIDER_TEST_CONFIG),
  new SingleJsonRpcProvider({ name: 'mainnet', chainId: ChainId.MAINNET }, `url_2`, log, SINGLE_PROVIDER_TEST_CONFIG),
]

const SINGLE_RPC_PROVIDERS = { [ChainId.MAINNET]: createNewSingleJsonRpcProviders() }

const resetRpcProviders = () => {
  SINGLE_RPC_PROVIDERS[ChainId.MAINNET] = createNewSingleJsonRpcProviders()
}

const delay = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('UniJsonRpcProvider', () => {
  let uniProvider: UniJsonRpcProvider
  let sandbox: SinonSandbox

  beforeEach(() => {
    uniProvider = new UniJsonRpcProvider(
      ChainId.MAINNET,
      SINGLE_RPC_PROVIDERS[ChainId.MAINNET],
      log,
      undefined,
      undefined,
      UNI_PROVIDER_TEST_CONFIG
    )
    for (const provider of uniProvider['providers']) {
      provider['config'] = SINGLE_PROVIDER_TEST_CONFIG
    }
    sandbox = Sinon.createSandbox()
  })

  afterEach(() => {
    resetRpcProviders()
    sandbox.restore()
  })

  it('all provider healthy', async () => {
    const getBlockNumber0 = sandbox.stub(uniProvider['providers'][0], '_getBlockNumber' as any)
    getBlockNumber0.resolves(123)
    const getBlockNumber1 = sandbox.stub(uniProvider['providers'][1], '_getBlockNumber' as any)
    getBlockNumber1.resolves(123)
    const getBlockNumber2 = sandbox.stub(uniProvider['providers'][2], '_getBlockNumber' as any)
    getBlockNumber2.resolves(123)

    expect(uniProvider.lastUsedUrl).undefined
    const blockNumber = await uniProvider.getBlockNumber()
    expect(blockNumber).equals(123)
    expect(uniProvider.lastUsedUrl).equals('url_0')
  })

  it('fallback when first provider becomes unhealthy', async () => {
    const getBlockNumber0 = sandbox.stub(uniProvider['providers'][0], '_getBlockNumber' as any)
    getBlockNumber0.rejects('error')
    const getBlockNumber1 = sandbox.stub(uniProvider['providers'][1], '_getBlockNumber' as any)
    getBlockNumber1.resolves(123)
    const getBlockNumber2 = sandbox.stub(uniProvider['providers'][2], '_getBlockNumber' as any)
    getBlockNumber2.resolves(123)

    uniProvider.logProviderHealthScores()

    // Two failed calls makes provider0 unhealthy
    try {
      await uniProvider.getBlockNumber()
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.name).equals('error')
    }
    uniProvider.logProviderHealthScores()
    try {
      await uniProvider.getBlockNumber()
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.name).equals('error')
    }
    uniProvider.logProviderHealthScores()

    expect(uniProvider.lastUsedUrl).equals('url_0')
    expect(uniProvider.currentHealthyUrls).to.have.ordered.members(['url_1', 'url_2'])
    expect(uniProvider.currentUnhealthyUrls).to.have.ordered.members(['url_0'])

    // Now later requests will be served with provider1
    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_1')
    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_1')
    uniProvider.logProviderHealthScores()
  })

  it('unhealthy provider successfully recovered', async () => {
    const getBlockNumber0 = sandbox.stub(uniProvider['providers'][0], '_getBlockNumber' as any)
    getBlockNumber0.rejects('error')
    const getBlockNumber1 = sandbox.stub(uniProvider['providers'][1], '_getBlockNumber' as any)
    getBlockNumber1.resolves(123)
    const getBlockNumber2 = sandbox.stub(uniProvider['providers'][2], '_getBlockNumber' as any)
    getBlockNumber2.resolves(123)

    uniProvider.logProviderHealthScores()

    // Two failed calls makes provider0 unhealthy
    try {
      await uniProvider.getBlockNumber()
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.name).equals('error')
    }
    uniProvider.logProviderHealthScores()
    try {
      await uniProvider.getBlockNumber()
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.name).equals('error')
    }

    expect(uniProvider.lastUsedUrl).equals('url_0')
    expect(uniProvider.currentHealthyUrls).to.have.ordered.members(['url_1', 'url_2'])
    expect(uniProvider.currentUnhealthyUrls).to.have.ordered.members(['url_0'])
    uniProvider.logProviderHealthScores()

    // This the failed provider starts recovering.
    getBlockNumber0.resolves(123)

    // Dial back provider's last call time to simulate that it has some period of recovery.
    uniProvider['providers'][0]['lastCallTimestampInMs'] -= 10000

    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_1')
    uniProvider.logProviderHealthScores()
    // Give it some time for finishing async evaluation for unhealthy providers.
    await delay(10)

    // Provider0's health score has been up, but it's not considered fully recovered yet
    expect(uniProvider.currentHealthyUrls).to.have.ordered.members(['url_1', 'url_2'])
    expect(uniProvider.currentUnhealthyUrls).to.have.ordered.members(['url_0'])

    // Dial back provider's last call time to simulate that it has some period of recovery.
    uniProvider['providers'][0]['lastCallTimestampInMs'] -= 10000

    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_1')
    uniProvider.logProviderHealthScores()

    // Give it some time for finishing async evaluation for unhealthy providers.
    await delay(10)

    // Provider0 is fully recovered.
    expect(uniProvider.currentHealthyUrls).to.have.ordered.members(['url_0', 'url_1', 'url_2'])
    expect(uniProvider.currentUnhealthyUrls).to.be.empty

    // From now on, we go back to use the original preferred provider (provider0)
    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_0')
    expect(uniProvider.currentHealthyUrls).to.have.ordered.members(['url_0', 'url_1', 'url_2'])
    expect(uniProvider.currentUnhealthyUrls).to.be.empty
    uniProvider.logProviderHealthScores()

    // Now later requests will be served with provider0
    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_0')
    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_0')
  })

  it('unhealthy provider has some challenge during recovering', async () => {
    const getBlockNumber0 = sandbox.stub(uniProvider['providers'][0], '_getBlockNumber' as any)
    getBlockNumber0.rejects('error')
    const getBlockNumber1 = sandbox.stub(uniProvider['providers'][1], '_getBlockNumber' as any)
    getBlockNumber1.resolves(123)
    const getBlockNumber2 = sandbox.stub(uniProvider['providers'][2], '_getBlockNumber' as any)
    getBlockNumber2.resolves(123)

    uniProvider.logProviderHealthScores()

    // Two failed calls makes provider0 unhealthy
    try {
      await uniProvider.getBlockNumber()
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.name).equals('error')
    }
    uniProvider.logProviderHealthScores()
    try {
      await uniProvider.getBlockNumber()
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.name).equals('error')
    }

    expect(uniProvider.lastUsedUrl).equals('url_0')
    expect(uniProvider.currentHealthyUrls).to.have.ordered.members(['url_1', 'url_2'])
    expect(uniProvider.currentUnhealthyUrls).to.have.ordered.members(['url_0'])
    uniProvider.logProviderHealthScores()

    // We advance some time. During this the failed provider starts recovering.
    const unhealthyProvider = uniProvider['providers'][0]
    const scoreBeforeRecovering = unhealthyProvider['healthScore']
    getBlockNumber0.resolves(123)
    // Dial back provider's last call time to simulate that it has some period of recovery.
    unhealthyProvider['lastCallTimestampInMs'] -= 1000

    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_1')
    // Give it some time for finishing async evaluation for unhealthy providers.
    await delay(10)

    uniProvider.logProviderHealthScores()
    // 1 second isn't enough to start re-evaluate the failed provider.
    expect(uniProvider.currentHealthyUrls).to.have.ordered.members(['url_1', 'url_2'])
    expect(uniProvider.currentUnhealthyUrls).to.have.ordered.members(['url_0'])
    expect(unhealthyProvider['healthScore']).equals(scoreBeforeRecovering)

    // Dial back provider's last call time to simulate that it has some period of recovery.
    unhealthyProvider['lastCallTimestampInMs'] -= 10000

    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_1')
    // Give it some time for finishing async evaluation for unhealthy providers.
    await delay(10)

    uniProvider.logProviderHealthScores()
    // Provider0 has recovered quite a bit. But still not enough to be considered as fully recovered.
    expect(uniProvider.currentHealthyUrls).to.have.ordered.members(['url_1', 'url_2'])
    expect(uniProvider.currentUnhealthyUrls).to.have.ordered.members(['url_0'])
    expect(unhealthyProvider['healthScore']).gt(-50)
    expect(unhealthyProvider['healthScore']).lt(-40)

    getBlockNumber0.rejects('error during recovery evaluation')
    // Dial back provider's last call time to simulate that it has some period of recovery.
    unhealthyProvider['lastCallTimestampInMs'] -= 10000

    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_1')
    // Give it some time for finishing async evaluation for unhealthy providers.
    await delay(10)

    uniProvider.logProviderHealthScores()
    expect(uniProvider.currentHealthyUrls).to.have.ordered.members(['url_1', 'url_2'])
    expect(uniProvider.currentUnhealthyUrls).to.have.ordered.members(['url_0'])
    // Provider0 failed again during recovery evaluation.
    expect(unhealthyProvider['healthScore']).gt(-100)
    expect(unhealthyProvider['healthScore']).lt(-90)
  })

  it('healthy provider can also drop score and resume score', async () => {
    const getBlockNumber0 = sandbox.stub(uniProvider['providers'][0], '_getBlockNumber' as any)
    getBlockNumber0.rejects('error')
    const getBlockNumber1 = sandbox.stub(uniProvider['providers'][1], '_getBlockNumber' as any)
    getBlockNumber1.resolves(123)
    const getBlockNumber2 = sandbox.stub(uniProvider['providers'][2], '_getBlockNumber' as any)
    getBlockNumber2.resolves(123)

    uniProvider.logProviderHealthScores()

    // One failed call reduce provider0's score, but it's still considered as healthy
    try {
      await uniProvider.getBlockNumber()
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.name).equals('error')
    }
    uniProvider.logProviderHealthScores()
    const healthyProvider = uniProvider['providers'][0]
    expect(healthyProvider['healthScore']).gte(-50)
    expect(healthyProvider['healthScore']).lt(-49)

    // Dial back provider's last call time to simulate that it has some period of recovery.
    healthyProvider['lastCallTimestampInMs'] -= 2000
    getBlockNumber0.resolves(123)

    await uniProvider.getBlockNumber()
    uniProvider.logProviderHealthScores()
    expect(healthyProvider['healthScore']).gte(-40)
    expect(healthyProvider['healthScore']).lt(-39)

    // Dial back provider's last call time to simulate that it has some period of recovery.
    healthyProvider['lastCallTimestampInMs'] -= 2000

    await uniProvider.getBlockNumber()
    uniProvider.logProviderHealthScores()
    expect(healthyProvider['healthScore']).gte(-30)
    expect(healthyProvider['healthScore']).lt(-29)

    // Score deduct and resume doesn't make it a less-preferred provider, as long as it's considered as healthy
    expect(uniProvider.currentHealthyUrls).to.have.ordered.members(['url_0', 'url_1', 'url_2'])
    expect(uniProvider.currentUnhealthyUrls).to.be.empty
  })

  it('no healthy provider available', async () => {
    sandbox.stub(uniProvider['providers'][0], 'isHealthy' as any).returns(false)
    sandbox.stub(uniProvider['providers'][1], 'isHealthy' as any).returns(false)
    sandbox.stub(uniProvider['providers'][2], 'isHealthy' as any).returns(false)

    try {
      await uniProvider.getBlockNumber()
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.message).equals('No healthy provider available')
    }
  })

  it('test selectPreferredProvider: without weights', async () => {
    // If no weights is provided, it's the same as using -1 for all weights,
    // Always select the first healthy provider.
    expect(uniProvider['selectPreferredProvider']().url).equals('url_0')
    expect(uniProvider['selectPreferredProvider']().url).equals('url_0')
    expect(uniProvider['selectPreferredProvider']().url).equals('url_0')
  })

  it('test selectPreferredProvider: with non-zero weights', async () => {
    uniProvider = new UniJsonRpcProvider(
      ChainId.MAINNET,
      SINGLE_RPC_PROVIDERS[ChainId.MAINNET],
      log,
      [3, 1, 4],
      undefined,
      UNI_PROVIDER_TEST_CONFIG
    )
    for (const provider of uniProvider['providers']) {
      provider['config'] = SINGLE_PROVIDER_TEST_CONFIG
    }

    const randStub = sandbox.stub(Math, 'random')
    // [0.0, 0.5] -> url_2, probability of being selected = 4 / 8
    randStub.returns(0.0)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_2')
    randStub.returns(0.1)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_2')
    randStub.returns(0.5)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_2')

    // (0.5, 0.875] -> url_, probability of being selected = 3 / 8
    randStub.returns(0.51)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_0')
    randStub.returns(0.63)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_0')
    randStub.returns(0.875)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_0')

    // (0.875, 1) -> url_1, probability of being selected = 1 / 8
    randStub.returns(0.876)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_1')
    randStub.returns(0.99)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_1')
  })

  it('test selectPreferredProvider: with weights that can be 0, case 1', async () => {
    uniProvider = new UniJsonRpcProvider(
      ChainId.MAINNET,
      SINGLE_RPC_PROVIDERS[ChainId.MAINNET],
      log,
      [3, ProviderSpecialWeight.NEVER, 4],
      undefined,
      UNI_PROVIDER_TEST_CONFIG
    )
    for (const provider of uniProvider['providers']) {
      provider['config'] = SINGLE_PROVIDER_TEST_CONFIG
    }

    const randStub = sandbox.stub(Math, 'random')
    // [0.0, 4/7(0.571)] -> url_2, probability of being selected = 4 / 7
    randStub.returns(0.0)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_2')
    randStub.returns(0.1)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_2')
    randStub.returns(0.57)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_2')

    // (4/7(0.571), 1) -> url_0, probability of being selected = 3 / 7
    randStub.returns(0.572)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_0')
    randStub.returns(0.8)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_0')
    randStub.returns(0.99)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_0')

    // url_1 will never be selected
  })

  it('test selectPreferredProvider: with weights that can be 0, case 2', async () => {
    uniProvider = new UniJsonRpcProvider(
      ChainId.MAINNET,
      SINGLE_RPC_PROVIDERS[ChainId.MAINNET],
      log,
      [ProviderSpecialWeight.NEVER, ProviderSpecialWeight.NEVER, 4],
      undefined,
      UNI_PROVIDER_TEST_CONFIG
    )
    for (const provider of uniProvider['providers']) {
      provider['config'] = SINGLE_PROVIDER_TEST_CONFIG
    }

    // Only url_2 is able to be selected
    const randStub = sandbox.stub(Math, 'random')
    randStub.returns(0.0)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_2')
    randStub.returns(0.1)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_2')
    randStub.returns(0.5)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_2')
    randStub.returns(0.8)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_2')
    randStub.returns(0.99)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_2')
  })

  it('test selectPreferredProvider: with weights that can be zero, case 3', async () => {
    uniProvider = new UniJsonRpcProvider(
      ChainId.MAINNET,
      SINGLE_RPC_PROVIDERS[ChainId.MAINNET],
      log,
      [ProviderSpecialWeight.NEVER, ProviderSpecialWeight.NEVER, 4],
      undefined,
      UNI_PROVIDER_TEST_CONFIG
    )
    for (const provider of uniProvider['providers']) {
      provider['config'] = SINGLE_PROVIDER_TEST_CONFIG
    }

    const randStub = sandbox.stub(Math, 'random')
    // [0.0, 1) -> url_2, probability of being selected = 4 / 4
    randStub.returns(0.0)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_2')
    randStub.returns(0.1)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_2')
    randStub.returns(0.57)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_2')
    randStub.returns(0.8)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_2')
    randStub.returns(0.99)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_2')

    // url_0 and url_1 will never be selected
  })

  it('test selectPreferredProvider: with weights that can be 0 or -1, case 1', async () => {
    uniProvider = new UniJsonRpcProvider(
      ChainId.MAINNET,
      SINGLE_RPC_PROVIDERS[ChainId.MAINNET],
      log,
      [ProviderSpecialWeight.AS_FALLBACK, ProviderSpecialWeight.NEVER, 3],
      undefined,
      UNI_PROVIDER_TEST_CONFIG
    )
    for (const provider of uniProvider['providers']) {
      provider['config'] = SINGLE_PROVIDER_TEST_CONFIG
    }

    // Only url_2 is able to be selected
    const randStub = sandbox.stub(Math, 'random')
    randStub.returns(0.0)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_2')
    randStub.returns(0.1)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_2')
    randStub.returns(0.5)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_2')
    randStub.returns(0.8)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_2')
    randStub.returns(0.99)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_2')
  })

  it('test selectPreferredProvider: with weights that can be 0 or -1, case 2', async () => {
    uniProvider = new UniJsonRpcProvider(
      ChainId.MAINNET,
      SINGLE_RPC_PROVIDERS[ChainId.MAINNET],
      log,
      [ProviderSpecialWeight.NEVER, ProviderSpecialWeight.NEVER, ProviderSpecialWeight.AS_FALLBACK],
      undefined,
      UNI_PROVIDER_TEST_CONFIG
    )
    for (const provider of uniProvider['providers']) {
      provider['config'] = SINGLE_PROVIDER_TEST_CONFIG
    }

    // Only url_2 is able to be selected
    const randStub = sandbox.stub(Math, 'random')
    randStub.returns(0.0)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_2')
    randStub.returns(0.1)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_2')
    randStub.returns(0.5)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_2')
    randStub.returns(0.8)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_2')
    randStub.returns(0.99)
    expect(uniProvider['selectPreferredProvider']().url).equals('url_2')
  })

  it('test selectPreferredProvider: with weights that can be 0 or -1, case 3', async () => {
    uniProvider = new UniJsonRpcProvider(
      ChainId.MAINNET,
      SINGLE_RPC_PROVIDERS[ChainId.MAINNET],
      log,
      [ProviderSpecialWeight.NEVER, ProviderSpecialWeight.NEVER, ProviderSpecialWeight.NEVER],
      undefined,
      UNI_PROVIDER_TEST_CONFIG
    )
    for (const provider of uniProvider['providers']) {
      provider['config'] = SINGLE_PROVIDER_TEST_CONFIG
    }

    // No provider is able to be selected
    expect(function () {
      uniProvider['selectPreferredProvider']()
    }).to.throw(Error)
  })

  it('multiple UniJsonRpcProvider share the same instances of SingleJsonRpcProvider', async () => {
    const uniProvider1 = new UniJsonRpcProvider(
      ChainId.MAINNET,
      SINGLE_RPC_PROVIDERS[ChainId.MAINNET],
      log,
      undefined,
      undefined,
      UNI_PROVIDER_TEST_CONFIG
    )
    for (const provider of uniProvider1['providers']) {
      provider['config'] = SINGLE_PROVIDER_TEST_CONFIG
    }

    const uniProvider2 = new UniJsonRpcProvider(
      ChainId.MAINNET,
      SINGLE_RPC_PROVIDERS[ChainId.MAINNET],
      log,
      undefined,
      undefined,
      UNI_PROVIDER_TEST_CONFIG
    )
    for (const provider of uniProvider2['providers']) {
      provider['config'] = SINGLE_PROVIDER_TEST_CONFIG
    }

    const getBlockNumber0 = sandbox.stub(uniProvider['providers'][0], '_getBlockNumber' as any)
    getBlockNumber0.rejects('error')

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

    const getBlockNumber1 = sandbox.stub(uniProvider['providers'][1], '_getBlockNumber' as any)
    getBlockNumber1.rejects('error')

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

  it('test session support: with provider weights', async () => {
    const sessionId = uniProvider.createNewSessionId()

    uniProvider = new UniJsonRpcProvider(
      ChainId.MAINNET,
      SINGLE_RPC_PROVIDERS[ChainId.MAINNET],
      log,
      [4, 1, 3],
      undefined,
      UNI_PROVIDER_TEST_CONFIG
    )
    for (const provider of uniProvider['providers']) {
      provider['config'] = SINGLE_PROVIDER_TEST_CONFIG
    }
    const getBlockNumber0 = sandbox.stub(uniProvider['providers'][0], '_getBlockNumber' as any)
    const getBlockNumber1 = sandbox.stub(uniProvider['providers'][1], '_getBlockNumber' as any)
    const getBlockNumber2 = sandbox.stub(uniProvider['providers'][2], '_getBlockNumber' as any)
    getBlockNumber0.resolves(123)
    getBlockNumber1.resolves(123)
    getBlockNumber2.resolves(123)

    const randStub = sandbox.stub(Math, 'random')
    randStub.returns(0.9)
    await uniProvider.getBlockNumber(sessionId)
    expect(uniProvider.lastUsedUrl).equals('url_1')

    // Will always use url_1 for later requests if specified with the above session id.

    randStub.returns(0.1)
    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_0')
    await uniProvider.getBlockNumber(sessionId)
    expect(uniProvider.lastUsedUrl).equals('url_1')

    randStub.returns(0.6)
    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_2')
    await uniProvider.getBlockNumber(sessionId)
    expect(uniProvider.lastUsedUrl).equals('url_1')
  })

  it('test session support: allow provider auto switch', async () => {
    const sessionId = uniProvider.createNewSessionId()

    uniProvider = new UniJsonRpcProvider(
      ChainId.MAINNET,
      SINGLE_RPC_PROVIDERS[ChainId.MAINNET],
      log,
      undefined,
      undefined,
      UNI_PROVIDER_TEST_CONFIG
    )
    for (const provider of uniProvider['providers']) {
      provider['config'] = SINGLE_PROVIDER_TEST_CONFIG
    }
    const getBlockNumber0 = sandbox.stub(uniProvider['providers'][0], '_getBlockNumber' as any)
    const getBlockNumber1 = sandbox.stub(uniProvider['providers'][1], '_getBlockNumber' as any)
    const getBlockNumber2 = sandbox.stub(uniProvider['providers'][2], '_getBlockNumber' as any)
    getBlockNumber0.resolves(123)
    getBlockNumber1.resolves(123)
    getBlockNumber2.resolves(123)

    // This session will use provider0.
    await uniProvider.getBlockNumber(sessionId)
    expect(uniProvider.lastUsedUrl).equals('url_0')

    // However, now provider0 throws error.
    getBlockNumber0.rejects('error')

    // Two failed calls makes provider0 unhealthy.
    try {
      await uniProvider.getBlockNumber(sessionId)
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.name).equals('error')
    }
    uniProvider.logProviderHealthScores()
    try {
      await uniProvider.getBlockNumber(sessionId)
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.name).equals('error')
    }

    uniProvider.logProviderHealthScores()

    // Although we pass in a session id, we accept fallback to another provider.
    await uniProvider.getBlockNumber(sessionId)
    expect(uniProvider.lastUsedUrl).equals('url_1')
  })

  it('test session support: forbid provider auto switch', async () => {
    const sessionId = uniProvider.createNewSessionId()

    uniProvider = new UniJsonRpcProvider(
      ChainId.MAINNET,
      SINGLE_RPC_PROVIDERS[ChainId.MAINNET],
      log,
      undefined,
      false,
      UNI_PROVIDER_TEST_CONFIG
    )
    for (const provider of uniProvider['providers']) {
      provider['config'] = SINGLE_PROVIDER_TEST_CONFIG
    }
    const getBlockNumber0 = sandbox.stub(uniProvider['providers'][0], '_getBlockNumber' as any)
    const getBlockNumber1 = sandbox.stub(uniProvider['providers'][1], '_getBlockNumber' as any)
    const getBlockNumber2 = sandbox.stub(uniProvider['providers'][2], '_getBlockNumber' as any)
    getBlockNumber0.resolves(123)
    getBlockNumber1.resolves(123)
    getBlockNumber2.resolves(123)

    // This session will use provider0.
    await uniProvider.getBlockNumber(sessionId)
    expect(uniProvider.lastUsedUrl).equals('url_0')

    // However, now provider0 throws error.
    getBlockNumber0.rejects('error')

    // Two failed calls makes provider0 unhealthy.
    try {
      await uniProvider.getBlockNumber(sessionId)
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.name).equals('error')
    }
    uniProvider.logProviderHealthScores()
    try {
      await uniProvider.getBlockNumber(sessionId)
      assert(false, 'Should not reach')
    } catch (err: any) {
      expect(err.name).equals('error')
    }
    uniProvider.logProviderHealthScores()

    // Although we pass in a session id, we accept fallback to another provider.
    try {
      await uniProvider.getBlockNumber(sessionId)
    } catch (err: any) {
      expect(err.message).equals(
        'Forced to use the same provider during the session but the provider (UNKNOWN) is unhealthy'
      )
    }
  })

  it('Test do shadow evaluate call for other healthy providers', async () => {
    const CUSTOM_UNI_PROVIDER_CONFIG = UNI_PROVIDER_TEST_CONFIG
    CUSTOM_UNI_PROVIDER_CONFIG.ENABLE_SHADOW_LATENCY_EVALUATION = true
    uniProvider = new UniJsonRpcProvider(
      ChainId.MAINNET,
      SINGLE_RPC_PROVIDERS[ChainId.MAINNET],
      log,
      undefined,
      undefined,
      CUSTOM_UNI_PROVIDER_CONFIG
    )
    for (const provider of uniProvider['providers']) {
      provider['config'] = SINGLE_PROVIDER_TEST_CONFIG
    }

    const timestamp = Date.now()
    sandbox.useFakeTimers(timestamp)

    const getBlockNumber0 = sandbox.stub(uniProvider['providers'][0], '_getBlockNumber' as any)
    getBlockNumber0.resolves(123)
    const getBlockNumber1 = sandbox.stub(uniProvider['providers'][1], '_getBlockNumber' as any)
    getBlockNumber1.resolves(123)
    const getBlockNumber2 = sandbox.stub(uniProvider['providers'][2], '_getBlockNumber' as any)
    getBlockNumber2.resolves(123)

    const spy1 = sandbox.spy(uniProvider['providers'][1], 'evaluateLatency')
    const spy2 = sandbox.spy(uniProvider['providers'][2], 'evaluateLatency')

    await uniProvider.getBlockNumber()

    // Shadow evaluate call should be made
    expect(spy1.callCount).to.equal(1)
    expect(spy1.getCalls()[0].firstArg).to.equal('getBlockNumber')
    expect(spy2.callCount).to.equal(1)
    expect(spy2.getCalls()[0].firstArg).to.equal('getBlockNumber')

    expect(uniProvider['providers'][1]['lastEvaluatedLatencyInMs']).equal(0)
    expect(uniProvider['providers'][1]['lastLatencyEvaluationTimestampInMs']).equals(timestamp)
    expect(uniProvider['providers'][2]['lastEvaluatedLatencyInMs']).equal(0)
    expect(uniProvider['providers'][2]['lastLatencyEvaluationTimestampInMs']).equals(timestamp)
  })
})
