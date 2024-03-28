import { GlobalRpcProviders } from '../../../../lib/rpc/GlobalRpcProviders'
import { default as bunyan, default as Logger } from 'bunyan'
import { ChainId } from '@uniswap/sdk-core'
import { expect } from 'chai'
import { SingleJsonRpcProviderConfig, UniJsonRpcProviderConfig } from '../../../../lib/rpc/config'
import Sinon, { SinonSandbox } from 'sinon'

const log: Logger = bunyan.createLogger({ name: 'test' })

const UNI_PROVIDER_TEST_CONFIG: UniJsonRpcProviderConfig = {
  HEALTH_EVALUATION_WAIT_PERIOD_IN_S: 5,
  ENABLE_SHADOW_LATENCY_EVALUATION: false,
  LATENCY_EVALUATION_WAIT_PERIOD_IN_S: 15,
  DEFAULT_INITIAL_WEIGHT: 1000,
}

const SINGLE_PROVIDER_TEST_CONFIG: SingleJsonRpcProviderConfig = {
  HEALTH_EVALUATION_WAIT_PERIOD_IN_S: 5,
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

const cleanUp = () => {
  GlobalRpcProviders['UNI_RPC_PROVIDERS'] = null
  GlobalRpcProviders['SINGLE_RPC_PROVIDERS'] = null
}

describe('GlobalRpcProviders', () => {
  let sandbox: SinonSandbox

  beforeEach(() => {
    sandbox = Sinon.createSandbox()
  })

  afterEach(() => {
    sandbox.restore()
    cleanUp()
  })

  it('Prepare global UniJsonRpcProvider by reading given config', () => {
    process.env = {
      URL0: 'url0',
      URL1: 'url1',
    }
    const rpcProviderProdConfig = [
      { chainId: 1, useMultiProviderProb: 0 },
      {
        chainId: 43114,
        useMultiProviderProb: 1,
        sessionAllowProviderFallbackWhenUnhealthy: true,
        providerInitialWeights: [2, 1],
        providerUrls: ['URL0', 'URL1'],
      },
    ]

    expect(
      GlobalRpcProviders.getGlobalUniRpcProviders(
        log,
        UNI_PROVIDER_TEST_CONFIG,
        SINGLE_PROVIDER_TEST_CONFIG,
        rpcProviderProdConfig
      ).has(ChainId.MAINNET)
    ).to.be.false

    expect(
      GlobalRpcProviders.getGlobalUniRpcProviders(
        log,
        UNI_PROVIDER_TEST_CONFIG,
        SINGLE_PROVIDER_TEST_CONFIG,
        rpcProviderProdConfig
      ).has(ChainId.BNB)
    ).to.be.false

    expect(
      GlobalRpcProviders.getGlobalUniRpcProviders(
        log,
        UNI_PROVIDER_TEST_CONFIG,
        SINGLE_PROVIDER_TEST_CONFIG,
        rpcProviderProdConfig
      ).has(ChainId.AVALANCHE)
    ).to.be.true

    const avaUniProvider = GlobalRpcProviders.getGlobalUniRpcProviders(
      log,
      UNI_PROVIDER_TEST_CONFIG,
      SINGLE_PROVIDER_TEST_CONFIG,
      rpcProviderProdConfig
    ).get(ChainId.AVALANCHE)!
    expect(avaUniProvider['sessionAllowProviderFallbackWhenUnhealthy']).to.be.true
    expect(avaUniProvider['urlWeight']).to.deep.equal({ url0: 2, url1: 1 })
    expect(avaUniProvider['providers'][0].url).to.equal('url0')
    expect(avaUniProvider['providers'][1].url).to.equal('url1')
  })

  it('Prepare global UniJsonRpcProvider by reading config: Use prob to decide feature switch', () => {
    process.env = {
      URL0: 'url0',
      URL1: 'url1',
    }

    const rpcProviderProdConfig = [
      {
        chainId: 1,
        useMultiProviderProb: 0.3,
        providerUrls: ['URL0', 'URL1'],
      },
      {
        chainId: 43114,
        useMultiProviderProb: 0.7,
        sessionAllowProviderFallbackWhenUnhealthy: true,
        providerInitialWeights: [2, 1],
        providerUrls: ['URL0', 'URL1'],
      },
    ]

    const randStub = sandbox.stub(Math, 'random')
    randStub.returns(0.0)
    expect(
      GlobalRpcProviders.getGlobalUniRpcProviders(
        log,
        UNI_PROVIDER_TEST_CONFIG,
        SINGLE_PROVIDER_TEST_CONFIG,
        rpcProviderProdConfig
      ).has(ChainId.MAINNET)
    ).to.be.true
    expect(
      GlobalRpcProviders.getGlobalUniRpcProviders(
        log,
        UNI_PROVIDER_TEST_CONFIG,
        SINGLE_PROVIDER_TEST_CONFIG,
        rpcProviderProdConfig
      ).has(ChainId.AVALANCHE)
    ).to.be.true
    cleanUp()

    randStub.returns(0.29)
    expect(
      GlobalRpcProviders.getGlobalUniRpcProviders(
        log,
        UNI_PROVIDER_TEST_CONFIG,
        SINGLE_PROVIDER_TEST_CONFIG,
        rpcProviderProdConfig
      ).has(ChainId.MAINNET)
    ).to.be.true
    expect(
      GlobalRpcProviders.getGlobalUniRpcProviders(
        log,
        UNI_PROVIDER_TEST_CONFIG,
        SINGLE_PROVIDER_TEST_CONFIG,
        rpcProviderProdConfig
      ).has(ChainId.AVALANCHE)
    ).to.be.true
    cleanUp()

    randStub.returns(0.3)
    expect(
      GlobalRpcProviders.getGlobalUniRpcProviders(
        log,
        UNI_PROVIDER_TEST_CONFIG,
        SINGLE_PROVIDER_TEST_CONFIG,
        rpcProviderProdConfig
      ).has(ChainId.MAINNET)
    ).to.be.false
    expect(
      GlobalRpcProviders.getGlobalUniRpcProviders(
        log,
        UNI_PROVIDER_TEST_CONFIG,
        SINGLE_PROVIDER_TEST_CONFIG,
        rpcProviderProdConfig
      ).has(ChainId.AVALANCHE)
    ).to.be.true
    cleanUp()

    randStub.returns(0.69)
    expect(
      GlobalRpcProviders.getGlobalUniRpcProviders(
        log,
        UNI_PROVIDER_TEST_CONFIG,
        SINGLE_PROVIDER_TEST_CONFIG,
        rpcProviderProdConfig
      ).has(ChainId.MAINNET)
    ).to.be.false
    expect(
      GlobalRpcProviders.getGlobalUniRpcProviders(
        log,
        UNI_PROVIDER_TEST_CONFIG,
        SINGLE_PROVIDER_TEST_CONFIG,
        rpcProviderProdConfig
      ).has(ChainId.AVALANCHE)
    ).to.be.true
    cleanUp()

    randStub.returns(0.7)
    expect(
      GlobalRpcProviders.getGlobalUniRpcProviders(
        log,
        UNI_PROVIDER_TEST_CONFIG,
        SINGLE_PROVIDER_TEST_CONFIG,
        rpcProviderProdConfig
      ).has(ChainId.MAINNET)
    ).to.be.false
    expect(
      GlobalRpcProviders.getGlobalUniRpcProviders(
        log,
        UNI_PROVIDER_TEST_CONFIG,
        SINGLE_PROVIDER_TEST_CONFIG,
        rpcProviderProdConfig
      ).has(ChainId.AVALANCHE)
    ).to.be.false
    cleanUp()

    randStub.returns(0.9)
    expect(
      GlobalRpcProviders.getGlobalUniRpcProviders(
        log,
        UNI_PROVIDER_TEST_CONFIG,
        SINGLE_PROVIDER_TEST_CONFIG,
        rpcProviderProdConfig
      ).has(ChainId.MAINNET)
    ).to.be.false
    expect(
      GlobalRpcProviders.getGlobalUniRpcProviders(
        log,
        UNI_PROVIDER_TEST_CONFIG,
        SINGLE_PROVIDER_TEST_CONFIG,
        rpcProviderProdConfig
      ).has(ChainId.AVALANCHE)
    ).to.be.false
    cleanUp()
  })
})
