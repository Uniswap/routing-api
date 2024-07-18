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
import { ProviderHealthiness } from '../../../../lib/rpc/ProviderHealthState'
import { JsonRpcResponse } from 'hardhat/types'
import { EthFeeHistory } from '../../../../lib/util/eth_feeHistory'

const UNI_PROVIDER_TEST_CONFIG: UniJsonRpcProviderConfig = {
  HEALTH_EVALUATION_WAIT_PERIOD_IN_S: 0,
  ENABLE_SHADOW_LATENCY_EVALUATION: false,
  LATENCY_EVALUATION_WAIT_PERIOD_IN_S: 15,
  DEFAULT_INITIAL_WEIGHT: 1000,
}

const SINGLE_PROVIDER_TEST_CONFIG: SingleJsonRpcProviderConfig = {
  HEALTH_EVALUATION_WAIT_PERIOD_IN_S: 0,
  ERROR_PENALTY: -50,
  HIGH_LATENCY_PENALTY: -50,
  HEALTH_SCORE_FALLBACK_THRESHOLD: -70,
  HEALTH_SCORE_RECOVER_THRESHOLD: -10,
  MAX_LATENCY_ALLOWED_IN_MS: 500,
  RECOVER_SCORE_PER_MS: 0.005,
  RECOVER_MAX_WAIT_TIME_TO_ACKNOWLEDGE_IN_MS: 20000,
  DB_SYNC_INTERVAL_IN_S: 5,
  LATENCY_STAT_HISTORY_WINDOW_LENGTH_IN_S: 300,
  LATENCY_EVALUATION_WAIT_PERIOD_IN_S: 15,
}

const log = bunyan.createLogger({
  name: 'SingleJsonRpcProviderTest',
  serializers: bunyan.stdSerializers,
  level: bunyan.DEBUG,
})

const createNewSingleJsonRpcProviders = () => [
  new SingleJsonRpcProvider(
    { name: 'mainnet', chainId: ChainId.MAINNET },
    `url_0`,
    log,
    SINGLE_PROVIDER_TEST_CONFIG,
    false,
    1.0
  ),
  new SingleJsonRpcProvider(
    { name: 'mainnet', chainId: ChainId.MAINNET },
    `url_1`,
    log,
    SINGLE_PROVIDER_TEST_CONFIG,
    false,
    1.0
  ),
  new SingleJsonRpcProvider(
    { name: 'mainnet', chainId: ChainId.MAINNET },
    `url_2`,
    log,
    SINGLE_PROVIDER_TEST_CONFIG,
    false,
    1.0
  ),
]

const SINGLE_RPC_PROVIDERS = { [ChainId.MAINNET]: createNewSingleJsonRpcProviders() }

const resetRpcProviders = () => {
  SINGLE_RPC_PROVIDERS[ChainId.MAINNET] = createNewSingleJsonRpcProviders()
}

describe('UniJsonRpcProvider', () => {
  let uniProvider: UniJsonRpcProvider
  let sandbox: SinonSandbox

  beforeEach(() => {
    uniProvider = new UniJsonRpcProvider(
      ChainId.MAINNET,
      SINGLE_RPC_PROVIDERS[ChainId.MAINNET],
      log,
      UNI_PROVIDER_TEST_CONFIG,
      1.0,
      1.0
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
    // provider0 is unhealthy
    uniProvider['providers'][0]['healthiness'] = ProviderHealthiness.UNHEALTHY
    const getBlockNumber0 = sandbox.stub(uniProvider['providers'][0], '_getBlockNumber' as any)
    getBlockNumber0.rejects('error')
    const getBlockNumber1 = sandbox.stub(uniProvider['providers'][1], '_getBlockNumber' as any)
    getBlockNumber1.resolves(123)
    const getBlockNumber2 = sandbox.stub(uniProvider['providers'][2], '_getBlockNumber' as any)
    getBlockNumber2.resolves(123)

    uniProvider.logProviderHealthiness()

    expect(uniProvider.currentHealthyUrls).to.have.ordered.members(['url_1', 'url_2'])
    expect(uniProvider.currentUnhealthyUrls).to.have.ordered.members(['url_0'])

    // Now later requests will be served with provider1
    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_1')
    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_1')
    uniProvider.logProviderHealthiness()
  })

  it('unhealthy provider successfully recovered', async () => {
    // provider0 is unhealthy
    uniProvider['providers'][0]['healthiness'] = ProviderHealthiness.UNHEALTHY
    const getBlockNumber0 = sandbox.stub(uniProvider['providers'][0], '_getBlockNumber' as any)
    getBlockNumber0.rejects('error')
    const getBlockNumber1 = sandbox.stub(uniProvider['providers'][1], '_getBlockNumber' as any)
    getBlockNumber1.resolves(123)
    const getBlockNumber2 = sandbox.stub(uniProvider['providers'][2], '_getBlockNumber' as any)
    getBlockNumber2.resolves(123)

    uniProvider.logProviderHealthiness()

    expect(uniProvider.currentHealthyUrls).to.have.ordered.members(['url_1', 'url_2'])
    expect(uniProvider.currentUnhealthyUrls).to.have.ordered.members(['url_0'])

    await uniProvider.getBlockNumber()
    // provider1 is selected.
    expect(uniProvider.lastUsedUrl).equals('url_1')

    // provider0 then recovered.
    uniProvider['providers'][0]['healthiness'] = ProviderHealthiness.HEALTHY
    getBlockNumber0.resolves(123)

    expect(uniProvider.currentHealthyUrls).to.have.ordered.members(['url_0', 'url_1', 'url_2'])
    expect(uniProvider.currentUnhealthyUrls).to.be.empty

    await uniProvider.getBlockNumber()
    // Back to select provider0.
    expect(uniProvider.lastUsedUrl).equals('url_0')
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
      UNI_PROVIDER_TEST_CONFIG,
      1.0,
      1.0,
      [3, 1, 4]
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
      UNI_PROVIDER_TEST_CONFIG,
      1.0,
      1.0,
      [3, ProviderSpecialWeight.NEVER, 4]
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
      UNI_PROVIDER_TEST_CONFIG,
      1.0,
      1.0,
      [ProviderSpecialWeight.NEVER, ProviderSpecialWeight.NEVER, 4]
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
      UNI_PROVIDER_TEST_CONFIG,
      1.0,
      1.0,
      [ProviderSpecialWeight.NEVER, ProviderSpecialWeight.NEVER, 4]
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
      UNI_PROVIDER_TEST_CONFIG,
      1.0,
      1.0,
      [ProviderSpecialWeight.AS_FALLBACK, ProviderSpecialWeight.NEVER, 3]
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
      UNI_PROVIDER_TEST_CONFIG,
      1.0,
      1.0,
      [ProviderSpecialWeight.NEVER, ProviderSpecialWeight.NEVER, ProviderSpecialWeight.AS_FALLBACK]
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
      UNI_PROVIDER_TEST_CONFIG,
      1.0,
      1.0,
      [ProviderSpecialWeight.NEVER, ProviderSpecialWeight.NEVER, ProviderSpecialWeight.NEVER]
    )
    for (const provider of uniProvider['providers']) {
      provider['config'] = SINGLE_PROVIDER_TEST_CONFIG
    }

    // No provider is able to be selected
    expect(function () {
      uniProvider['selectPreferredProvider']()
    }).to.throw(Error)
  })

  it('test selectPreferredProvider: in combination with provider fallback and recover, case 1', async () => {
    uniProvider = new UniJsonRpcProvider(
      ChainId.MAINNET,
      SINGLE_RPC_PROVIDERS[ChainId.MAINNET],
      log,
      UNI_PROVIDER_TEST_CONFIG,
      1.0,
      1.0,
      [1, ProviderSpecialWeight.NEVER, ProviderSpecialWeight.AS_FALLBACK]
    )
    for (const provider of uniProvider['providers']) {
      provider['config'] = SINGLE_PROVIDER_TEST_CONFIG
    }

    // Should always use the primary provider.
    expect(uniProvider['selectPreferredProvider']().url).equals('url_0')

    // Primary provider fails.
    uniProvider['providers'][0]['healthiness'] = ProviderHealthiness.UNHEALTHY

    // Should fallback to the next AS_FALLBACK provider
    expect(uniProvider['selectPreferredProvider']().url).equals('url_2')

    // Primary provider recovers.
    uniProvider['providers'][0]['healthiness'] = ProviderHealthiness.HEALTHY

    // Should resume to the primary provider.
    expect(uniProvider['selectPreferredProvider']().url).equals('url_0')
  })

  it('test selectPreferredProvider: in combination with provider fallback and recover, case 2', async () => {
    uniProvider = new UniJsonRpcProvider(
      ChainId.MAINNET,
      SINGLE_RPC_PROVIDERS[ChainId.MAINNET],
      log,
      UNI_PROVIDER_TEST_CONFIG,
      1.0,
      1.0,
      [1, ProviderSpecialWeight.AS_FALLBACK, ProviderSpecialWeight.AS_FALLBACK]
    )
    for (const provider of uniProvider['providers']) {
      provider['config'] = SINGLE_PROVIDER_TEST_CONFIG
    }

    // Should always use the primary provider.
    expect(uniProvider['selectPreferredProvider']().url).equals('url_0')

    // Primary provider fails.
    uniProvider['providers'][0]['healthiness'] = ProviderHealthiness.UNHEALTHY

    // Should fallback to the next AS_FALLBACK provider.
    expect(uniProvider['selectPreferredProvider']().url).equals('url_1')

    // Fallback provider also fails.
    uniProvider['providers'][1]['healthiness'] = ProviderHealthiness.UNHEALTHY

    // Should fallback to the next AS_FALLBACK provider.
    expect(uniProvider['selectPreferredProvider']().url).equals('url_2')

    // Another fallback provider also fails.
    uniProvider['providers'][2]['healthiness'] = ProviderHealthiness.UNHEALTHY

    // No provider is able to be selected.
    expect(function () {
      uniProvider['selectPreferredProvider']()
    }).to.throw(Error)

    // As provider recovers, we should resume provider selection.
    uniProvider['providers'][2]['healthiness'] = ProviderHealthiness.HEALTHY
    expect(uniProvider['selectPreferredProvider']().url).equals('url_2')
    uniProvider['providers'][1]['healthiness'] = ProviderHealthiness.HEALTHY
    expect(uniProvider['selectPreferredProvider']().url).equals('url_1')
    uniProvider['providers'][0]['healthiness'] = ProviderHealthiness.HEALTHY
    expect(uniProvider['selectPreferredProvider']().url).equals('url_0')
  })

  it('multiple UniJsonRpcProvider share the same instances of SingleJsonRpcProvider', async () => {
    const uniProvider1 = new UniJsonRpcProvider(
      ChainId.MAINNET,
      SINGLE_RPC_PROVIDERS[ChainId.MAINNET],
      log,
      UNI_PROVIDER_TEST_CONFIG,
      1.0,
      1.0
    )
    for (const provider of uniProvider1['providers']) {
      provider['config'] = SINGLE_PROVIDER_TEST_CONFIG
    }

    const uniProvider2 = new UniJsonRpcProvider(
      ChainId.MAINNET,
      SINGLE_RPC_PROVIDERS[ChainId.MAINNET],
      log,
      UNI_PROVIDER_TEST_CONFIG,
      1.0,
      1.0
    )
    for (const provider of uniProvider2['providers']) {
      provider['config'] = SINGLE_PROVIDER_TEST_CONFIG
    }

    // Make provider0 unhealthy
    const getBlockNumber0 = sandbox.stub(uniProvider['providers'][0], '_getBlockNumber' as any)
    getBlockNumber0.rejects('error')
    uniProvider['providers'][0]['healthiness'] = ProviderHealthiness.UNHEALTHY

    expect(uniProvider['selectPreferredProvider']().url).equals('url_1')
    expect(uniProvider1['selectPreferredProvider']().url).equals('url_1')
    expect(uniProvider2['selectPreferredProvider']().url).equals('url_1')

    const getBlockNumber1 = sandbox.stub(uniProvider['providers'][1], '_getBlockNumber' as any)
    getBlockNumber1.rejects('error')

    // Make provider1 unhealthy
    uniProvider['providers'][1]['healthiness'] = ProviderHealthiness.UNHEALTHY

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
      UNI_PROVIDER_TEST_CONFIG,
      1.0,
      1.0,
      [4, 1, 3]
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
      UNI_PROVIDER_TEST_CONFIG,
      1.0,
      1.0
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
    uniProvider['providers'][0]['healthiness'] = ProviderHealthiness.UNHEALTHY

    uniProvider.logProviderHealthiness()

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
      UNI_PROVIDER_TEST_CONFIG,
      1.0,
      1.0
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
    uniProvider['providers'][0]['healthiness'] = ProviderHealthiness.UNHEALTHY

    uniProvider.logProviderHealthiness()

    // Although we pass in a session id, we accept fallback to another provider.
    try {
      await uniProvider.getBlockNumber(sessionId)
    } catch (err: any) {
      expect(err.message).equals(
        'Forced to use the same provider during the session but the provider (UNKNOWN) is unhealthy'
      )
    }
  })

  it('test session support: attached session', async () => {
    uniProvider = new UniJsonRpcProvider(
      ChainId.MAINNET,
      SINGLE_RPC_PROVIDERS[ChainId.MAINNET],
      log,
      UNI_PROVIDER_TEST_CONFIG,
      1.0,
      1.0,
      [4, 1, 3]
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

    uniProvider.forceAttachToNewSession()

    await uniProvider.getBlockNumber()
    const url = uniProvider.lastUsedUrl

    // Will always use the same url for later requests even not specified with the above session id.

    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals(url)
    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals(url)
    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals(url)
    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals(url)
  })

  it('Test do shadow evaluate call for other healthy providers', async () => {
    const CUSTOM_UNI_PROVIDER_CONFIG = UNI_PROVIDER_TEST_CONFIG
    CUSTOM_UNI_PROVIDER_CONFIG.ENABLE_SHADOW_LATENCY_EVALUATION = true
    uniProvider = new UniJsonRpcProvider(
      ChainId.MAINNET,
      SINGLE_RPC_PROVIDERS[ChainId.MAINNET],
      log,
      CUSTOM_UNI_PROVIDER_CONFIG,
      1.0,
      1.0
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

    const spy0 = sandbox.spy(uniProvider['providers'][0], 'evaluateLatency')
    const spy1 = sandbox.spy(uniProvider['providers'][1], 'evaluateLatency')
    const spy2 = sandbox.spy(uniProvider['providers'][2], 'evaluateLatency')

    await uniProvider.getBlockNumber('sessionId')

    // Shadow evaluate call should be made
    expect(spy0.callCount).to.equal(0)
    expect(spy1.callCount).to.equal(1)
    expect(spy1.getCalls()[0].lastArg).to.equal('getBlockNumber')
    expect(spy2.callCount).to.equal(1)
    expect(spy2.getCalls()[0].lastArg).to.equal('getBlockNumber')

    expect(uniProvider['providers'][1]['lastLatencyEvaluationTimestampInMs']).equals(timestamp)
    expect(uniProvider['providers'][2]['lastLatencyEvaluationTimestampInMs']).equals(timestamp)
  })

  it('Test we will not do shadow latency check calls too frequently', async () => {
    const CUSTOM_UNI_PROVIDER_CONFIG = UNI_PROVIDER_TEST_CONFIG
    CUSTOM_UNI_PROVIDER_CONFIG.ENABLE_SHADOW_LATENCY_EVALUATION = true
    uniProvider = new UniJsonRpcProvider(
      ChainId.MAINNET,
      SINGLE_RPC_PROVIDERS[ChainId.MAINNET],
      log,
      CUSTOM_UNI_PROVIDER_CONFIG,
      1.0,
      1.0
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

    const spy0 = sandbox.spy(uniProvider['providers'][0], 'evaluateLatency')
    const spy1 = sandbox.spy(uniProvider['providers'][1], 'evaluateLatency')
    const spy2 = sandbox.spy(uniProvider['providers'][2], 'evaluateLatency')

    await uniProvider.getBlockNumber('sessionId')

    // Shadow evaluate call should be made
    expect(spy0.callCount).to.equal(0)
    expect(spy1.callCount).to.equal(1)
    expect(spy1.getCalls()[0].lastArg).to.equal('getBlockNumber')
    expect(spy2.callCount).to.equal(1)
    expect(spy2.getCalls()[0].lastArg).to.equal('getBlockNumber')

    expect(uniProvider['providers'][1]['lastLatencyEvaluationTimestampInMs']).equals(timestamp)
    expect(uniProvider['providers'][2]['lastLatencyEvaluationTimestampInMs']).equals(timestamp)

    // Advance 1 second.
    sandbox.clock.tick(1000)
    spy0.resetHistory()
    spy1.resetHistory()
    spy2.resetHistory()

    await uniProvider.getBlockNumber('sessionId')

    // 1 second is not long enough to allow another latency evaluation shadow call.
    expect(spy1.callCount).to.equal(1)
    expect(spy2.callCount).to.equal(1)

    // Advance another 15 seconds.
    sandbox.clock.tick(15000)
    spy0.resetHistory()
    spy1.resetHistory()
    spy2.resetHistory()

    await uniProvider.getBlockNumber('sessionId')

    expect(spy1.callCount).to.equal(1)
    expect(spy1.getCalls()[0].lastArg).to.equal('getBlockNumber')
    expect(uniProvider['providers'][1]['lastLatencyEvaluationTimestampInMs']).equals(timestamp + 16000)
    expect(spy2.callCount).to.equal(1)
    expect(spy2.getCalls()[0].lastArg).to.equal('getBlockNumber')
    expect(uniProvider['providers'][2]['lastLatencyEvaluationTimestampInMs']).equals(timestamp + 16000)
  })

  it('Test we will not do shadow latency check calls too frequently, simultaneous multi entry', async () => {
    const CUSTOM_UNI_PROVIDER_CONFIG = UNI_PROVIDER_TEST_CONFIG
    CUSTOM_UNI_PROVIDER_CONFIG.ENABLE_SHADOW_LATENCY_EVALUATION = true
    CUSTOM_UNI_PROVIDER_CONFIG.LATENCY_EVALUATION_WAIT_PERIOD_IN_S = 15
    uniProvider = new UniJsonRpcProvider(
      ChainId.MAINNET,
      SINGLE_RPC_PROVIDERS[ChainId.MAINNET],
      log,
      CUSTOM_UNI_PROVIDER_CONFIG,
      1.0,
      1.0
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

    const spy0 = sandbox.spy(uniProvider['providers'][0], 'evaluateLatency')
    const spy1 = sandbox.spy(uniProvider['providers'][1], 'evaluateLatency')
    const spy2 = sandbox.spy(uniProvider['providers'][2], 'evaluateLatency')

    // Make 5 calls in parallel.
    await Promise.all([
      uniProvider.getBlockNumber('sessionId'),
      uniProvider.getBlockNumber('sessionId'),
      uniProvider.getBlockNumber('sessionId'),
      uniProvider.getBlockNumber('sessionId'),
      uniProvider.getBlockNumber('sessionId'),
    ])

    expect(spy0.callCount).to.equal(0)
    expect(spy1.callCount).to.equal(5)
    expect(spy1.getCalls()[0].lastArg).to.equal('getBlockNumber')
    expect(spy2.callCount).to.equal(5)
    expect(spy2.getCalls()[0].lastArg).to.equal('getBlockNumber')

    expect(uniProvider['providers'][1]['lastLatencyEvaluationTimestampInMs']).equals(timestamp)
    expect(uniProvider['providers'][2]['lastLatencyEvaluationTimestampInMs']).equals(timestamp)

    spy0.resetHistory()
    spy1.resetHistory()
    spy2.resetHistory()

    // Make another 5 calls in parallel.
    await Promise.all([
      uniProvider.getBlockNumber(),
      uniProvider.getBlockNumber(),
      uniProvider.getBlockNumber(),
      uniProvider.getBlockNumber(),
      uniProvider.getBlockNumber(),
    ])

    // No shadow call should be made.
    expect(spy0.callCount).to.equal(0)
    expect(spy1.callCount).to.equal(0)
    expect(spy2.callCount).to.equal(0)

    spy0.resetHistory()
    spy1.resetHistory()
    spy2.resetHistory()

    // Advance 1 second.
    sandbox.clock.tick(1000)

    // Make another 5 calls in parallel.
    await Promise.all([
      uniProvider.getBlockNumber(),
      uniProvider.getBlockNumber(),
      uniProvider.getBlockNumber(),
      uniProvider.getBlockNumber(),
      uniProvider.getBlockNumber(),
    ])

    // 1 second is not long enough to allow another latency evaluation shadow call.
    expect(spy0.callCount).to.equal(0)
    expect(spy1.callCount).to.equal(0)
    expect(spy2.callCount).to.equal(0)

    spy0.resetHistory()
    spy1.resetHistory()
    spy2.resetHistory()

    // Advance another 15 seconds.
    sandbox.clock.tick(15000)

    // Make another 5 calls in parallel.
    await Promise.all([
      uniProvider.getBlockNumber('sessionId'),
      uniProvider.getBlockNumber('sessionId'),
      uniProvider.getBlockNumber('sessionId'),
      uniProvider.getBlockNumber('sessionId'),
      uniProvider.getBlockNumber('sessionId'),
    ])

    // Waited long enough to be able to make shadow calls. However, due to the locking mechanism, only 1 call is made to each shadow provider.
    expect(spy0.callCount).to.equal(0)
    expect(spy1.callCount).to.equal(5)
    expect(spy2.callCount).to.equal(5)

    expect(uniProvider['providers'][1]['lastLatencyEvaluationTimestampInMs']).equals(timestamp + 16000)
    expect(uniProvider['providers'][2]['lastLatencyEvaluationTimestampInMs']).equals(timestamp + 16000)
  })

  it('Test use of latencyEvaluationSampleProb', async () => {
    const CUSTOM_UNI_PROVIDER_CONFIG = UNI_PROVIDER_TEST_CONFIG
    CUSTOM_UNI_PROVIDER_CONFIG.ENABLE_SHADOW_LATENCY_EVALUATION = true
    uniProvider = new UniJsonRpcProvider(
      ChainId.MAINNET,
      SINGLE_RPC_PROVIDERS[ChainId.MAINNET],
      log,
      CUSTOM_UNI_PROVIDER_CONFIG,
      0.5,
      1.0
    )
    for (const provider of uniProvider['providers']) {
      provider['config'] = SINGLE_PROVIDER_TEST_CONFIG
    }

    const getBlockNumber0 = sandbox.stub(uniProvider['providers'][0], '_getBlockNumber' as any)
    getBlockNumber0.resolves(123)
    const getBlockNumber1 = sandbox.stub(uniProvider['providers'][1], '_getBlockNumber' as any)
    getBlockNumber1.resolves(123)
    const getBlockNumber2 = sandbox.stub(uniProvider['providers'][2], '_getBlockNumber' as any)
    getBlockNumber2.resolves(123)

    const spy0 = sandbox.spy(uniProvider['providers'][0], 'evaluateLatency')
    const spy1 = sandbox.spy(uniProvider['providers'][1], 'evaluateLatency')
    const spy2 = sandbox.spy(uniProvider['providers'][2], 'evaluateLatency')

    const randStub = sandbox.stub(Math, 'random')

    randStub.returns(0.6)
    await uniProvider.getBlockNumber('sessionId')
    // 0.6 >= 0.5, Shadow evaluate call should not be made
    expect(spy0.callCount).to.equal(0)
    expect(spy1.callCount).to.equal(0)
    expect(spy2.callCount).to.equal(0)
    spy0.resetHistory()
    spy1.resetHistory()
    spy2.resetHistory()

    randStub.returns(0.5)
    await uniProvider.getBlockNumber('sessionId')
    // 0.5 >= 0.5, Shadow evaluate call should not be made
    expect(spy0.callCount).to.equal(0)
    expect(spy1.callCount).to.equal(0)
    expect(spy2.callCount).to.equal(0)
    spy0.resetHistory()
    spy1.resetHistory()
    spy2.resetHistory()

    randStub.returns(0.4)
    await uniProvider.getBlockNumber('sessionId')
    // 0.4 < 0.5, Shadow evaluate call should be made
    expect(spy0.callCount).to.equal(0)
    expect(spy1.callCount).to.equal(1)
    expect(spy1.getCalls()[0].lastArg).to.equal('getBlockNumber')
    expect(spy2.callCount).to.equal(1)
    expect(spy2.getCalls()[0].lastArg).to.equal('getBlockNumber')
  })

  it('Test use of healthCheckSampleProb', async () => {
    uniProvider = new UniJsonRpcProvider(
      ChainId.MAINNET,
      SINGLE_RPC_PROVIDERS[ChainId.MAINNET],
      log,
      UNI_PROVIDER_TEST_CONFIG,
      1.0,
      0.5
    )
    for (const provider of uniProvider['providers']) {
      provider['config'] = SINGLE_PROVIDER_TEST_CONFIG
    }

    // Make provider1 and provider2 unhealthy
    const getBlockNumber0 = sandbox.stub(uniProvider['providers'][0], '_getBlockNumber' as any)
    getBlockNumber0.resolves(123)

    uniProvider['providers'][1]['healthiness'] = ProviderHealthiness.UNHEALTHY
    const getBlockNumber1 = sandbox.stub(uniProvider['providers'][1], '_getBlockNumber' as any)
    getBlockNumber1.rejects('error')

    uniProvider['providers'][2]['healthiness'] = ProviderHealthiness.UNHEALTHY
    const getBlockNumber2 = sandbox.stub(uniProvider['providers'][2], '_getBlockNumber' as any)
    getBlockNumber2.rejects('error')

    const spy0 = sandbox.spy(uniProvider['providers'][0], 'evaluateHealthiness')
    const spy1 = sandbox.spy(uniProvider['providers'][1], 'evaluateHealthiness')
    const spy2 = sandbox.spy(uniProvider['providers'][2], 'evaluateHealthiness')

    const randStub = sandbox.stub(Math, 'random')

    randStub.returns(0.6)
    await uniProvider.getBlockNumber('sessionId')
    // 0.6 >= 0.5, Shadow evaluate call should not be made
    expect(spy0.callCount).to.equal(0)
    expect(spy1.callCount).to.equal(0)
    expect(spy2.callCount).to.equal(0)
    spy0.resetHistory()
    spy1.resetHistory()
    spy2.resetHistory()

    randStub.returns(0.5)
    await uniProvider.getBlockNumber('sessionId')
    // 0.5 >= 0.5, Shadow evaluate call should not be made
    expect(spy0.callCount).to.equal(0)
    expect(spy1.callCount).to.equal(0)
    expect(spy2.callCount).to.equal(0)
    spy0.resetHistory()
    spy1.resetHistory()
    spy2.resetHistory()

    randStub.returns(0.4)
    await uniProvider.getBlockNumber('sessionId')
    // 0.4 < 0.5, Shadow evaluate call should be made
    expect(spy0.callCount).to.equal(0)
    expect(spy1.callCount).to.equal(1)
    expect(spy2.callCount).to.equal(1)
  })

  it('Test compare RPC result for eth_call with same results', async () => {
    const rpcProviders = createNewSingleJsonRpcProviders()
    const selectedProvider = rpcProviders[0]
    const otherProvider = rpcProviders[1]
    const spy = sandbox.spy(selectedProvider, 'logRpcResponseMatch')

    uniProvider = new UniJsonRpcProvider(ChainId.MAINNET, rpcProviders, log, UNI_PROVIDER_TEST_CONFIG, 1.0, 1)

    uniProvider.compareRpcResponses('0x123', '0x123', selectedProvider, otherProvider, 'call', [])

    expect(spy.callCount).to.equal(1)
  })

  it('Test compare RPC result for eth_call with different results', async () => {
    const rpcProviders = createNewSingleJsonRpcProviders()
    const selectedProvider = rpcProviders[0]
    const otherProvider = rpcProviders[1]
    const spy = sandbox.spy(selectedProvider, 'logRpcResponseMismatch')

    uniProvider = new UniJsonRpcProvider(ChainId.MAINNET, rpcProviders, log, UNI_PROVIDER_TEST_CONFIG, 1.0, 1)

    uniProvider.compareRpcResponses('0x321', '0x123', selectedProvider, otherProvider, 'call', [])

    expect(spy.callCount).to.equal(1)
  })

  it('Test compare RPC result for eth_estimateGas with same results', async () => {
    const rpcProviders = createNewSingleJsonRpcProviders()
    const selectedProvider = rpcProviders[0]
    const otherProvider = rpcProviders[1]
    const spy = sandbox.spy(selectedProvider, 'logRpcResponseMatch')

    uniProvider = new UniJsonRpcProvider(ChainId.MAINNET, rpcProviders, log, UNI_PROVIDER_TEST_CONFIG, 1.0, 1)

    const providerResult: JsonRpcResponse = { jsonrpc: '2.0', result: '0x123', id: 76 }
    const otherProviderResult: JsonRpcResponse = { jsonrpc: '2.0', result: '0x123', id: 76 }
    uniProvider.compareRpcResponses(providerResult, otherProviderResult, selectedProvider, otherProvider, 'send', [
      'eth_call',
    ])

    expect(spy.callCount).to.equal(1)
  })

  it('Test compare RPC result for eth_estimateGas with different results', async () => {
    const rpcProviders = createNewSingleJsonRpcProviders()
    const selectedProvider = rpcProviders[0]
    const otherProvider = rpcProviders[1]
    const spy = sandbox.spy(selectedProvider, 'logRpcResponseMismatch')

    uniProvider = new UniJsonRpcProvider(ChainId.MAINNET, rpcProviders, log, UNI_PROVIDER_TEST_CONFIG, 1.0, 1)

    const providerResult: JsonRpcResponse = { jsonrpc: '2.0', result: '0x123', id: 76 }
    const otherProviderResult: JsonRpcResponse = { jsonrpc: '2.0', result: '0x321', id: 76 }
    uniProvider.compareRpcResponses(providerResult, otherProviderResult, selectedProvider, otherProvider, 'send', [
      'eth_call',
    ])

    expect(spy.callCount).to.equal(1)
  })

  it('Test compare RPC error for eth_estimateGas with same errors', async () => {
    const rpcProviders = createNewSingleJsonRpcProviders()
    const selectedProvider = rpcProviders[0]
    const otherProvider = rpcProviders[1]
    const spy = sandbox.spy(selectedProvider, 'logRpcResponseMatch')

    uniProvider = new UniJsonRpcProvider(ChainId.MAINNET, rpcProviders, log, UNI_PROVIDER_TEST_CONFIG, 1.0, 1)

    const providerError = { code: '123', data: '0x123', error: 'CALL_EXCEPTION' }
    const otherProviderError = { code: '123', data: '0x123', error: 'CALL_EXCEPTION' }
    uniProvider.compareRpcResponses(providerError, otherProviderError, selectedProvider, otherProvider, 'send', [
      'eth_call',
    ])

    expect(spy.callCount).to.equal(1)
  })

  it('Test compare RPC error for eth_estimateGas with different errors', async () => {
    const rpcProviders = createNewSingleJsonRpcProviders()
    const selectedProvider = rpcProviders[0]
    const otherProvider = rpcProviders[1]
    const spy = sandbox.spy(selectedProvider, 'logRpcResponseMatch')

    uniProvider = new UniJsonRpcProvider(ChainId.MAINNET, rpcProviders, log, UNI_PROVIDER_TEST_CONFIG, 1.0, 1)

    const providerError = { code: '123', data: '0x321', error: 'CALL_EXCEPTION' }
    const otherProviderError = { code: '123', data: '0x123', error: 'CALL_EXCEPTION' }
    uniProvider.compareRpcResponses(providerError, otherProviderError, selectedProvider, otherProvider, 'send', [
      'eth_call',
    ])

    expect(spy.callCount).to.equal(1)
  })

  it('Test compare RPC result for eth_feeHistory with different results, but one is a number and the other is a string', async () => {
    const rpcProviders = createNewSingleJsonRpcProviders()
    const selectedProvider = rpcProviders[0]
    const otherProvider = rpcProviders[1]
    const spy = sandbox.spy(selectedProvider, 'logRpcResponseMatch')

    uniProvider = new UniJsonRpcProvider(ChainId.MAINNET, rpcProviders, log, UNI_PROVIDER_TEST_CONFIG, 1.0, 1)

    const ethFeeHistory: EthFeeHistory = {
      oldestBlock: '0x1347665',
      reward: ['0x21f43815'],
      baseFeePerGas: ['0x7750ad57'],
      gasUsedRatio: [0.4496709],
      baseFeePerBlobGas: ['0x1'],
      blobGasUsedRatio: [0.4496709],
    }
    const providerResult: JsonRpcResponse = { jsonrpc: '2.0', result: ethFeeHistory, id: 76 }
    const otherProviderResult: JsonRpcResponse = { jsonrpc: '2.0', result: ethFeeHistory, id: 76 }
    uniProvider.compareRpcResponses(providerResult, otherProviderResult, selectedProvider, otherProvider, 'send', [
      'eth_feeHistory',
    ])

    expect(spy.callCount).to.equal(1)
  })

  it('Test compare RPC result for eth_feeHistory with different results', async () => {
    const rpcProviders = createNewSingleJsonRpcProviders()
    const selectedProvider = rpcProviders[0]
    const otherProvider = rpcProviders[1]
    const spy = sandbox.spy(selectedProvider, 'logRpcResponseMismatch')

    uniProvider = new UniJsonRpcProvider(ChainId.MAINNET, rpcProviders, log, UNI_PROVIDER_TEST_CONFIG, 1.0, 1)

    const ethFeeHistory: EthFeeHistory = {
      oldestBlock: '0x1347665',
      reward: ['0x21f43815'],
      baseFeePerGas: ['0x7750ad57'],
      gasUsedRatio: [0.4496709],
      baseFeePerBlobGas: ['0x1'],
      blobGasUsedRatio: [0.4496709],
    }
    const ethFeeHistory2: EthFeeHistory = {
      oldestBlock: '0x1347661',
      reward: ['0x21f43815'],
      baseFeePerGas: ['0x7750ad57'],
      gasUsedRatio: [0.4496709],
      baseFeePerBlobGas: ['0x1'],
      blobGasUsedRatio: [0.4496709],
    }
    const providerResult: JsonRpcResponse = { jsonrpc: '2.0', result: ethFeeHistory, id: 76 }
    const otherProviderResult: JsonRpcResponse = { jsonrpc: '2.0', result: ethFeeHistory2, id: 76 }
    uniProvider.compareRpcResponses(providerResult, otherProviderResult, selectedProvider, otherProvider, 'send', [
      'eth_feeHistory',
    ])

    expect(spy.callCount).to.equal(1)
  })
})
