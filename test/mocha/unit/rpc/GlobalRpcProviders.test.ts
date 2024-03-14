import { GlobalRpcProviders } from '../../../../lib/rpc/GlobalRpcProviders'
import { default as bunyan, default as Logger } from 'bunyan'
import { ChainId } from '@uniswap/sdk-core'
import { expect } from 'chai'
import { SingleJsonRpcProviderConfig, UniJsonRpcProviderConfig } from '../../../../lib/rpc/config'
import Sinon, { SinonSandbox } from 'sinon'

const log: Logger = bunyan.createLogger({ name: 'test' })

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

  // You may need to update this test if you modified rpcProviderProdConfig.json
  it('Prepare global UniJsonRpcProvider by reading config file', () => {
    process.env = {
      WEB3_RPC_43114_INFURA: 'infura_43114',
      WEB3_RPC_43114_QUICKNODE: 'quicknode_43114',
      WEB3_RPC_43114_NIRVANA: 'nirvana_43114',
      WEB3_RPC_10_INFURA: 'infura_10',
      WEB3_RPC_10_QUICKNODE: 'quicknode_10',
      WEB3_RPC_10_NIRVANA: 'nirvana_10',
      WEB3_RPC_10_ALCHEMY: 'alchemy_10',
      WEB3_RPC_42220_INFURA: 'infura_42220',
      WEB3_RPC_42220_QUICKNODE: 'quicknode_42220',
      WEB3_RPC_56_QUICKNODE: 'quicknode_56',
      WEB3_RPC_137_INFURA: 'infura_137',
      WEB3_RPC_137_QUICKNODE: 'quicknode_137',
      WEB3_RPC_137_ALCHEMY: 'alchemy_137',
      WEB3_RPC_8453_INFURA: 'infura_8453',
      WEB3_RPC_8453_QUICKNODE: 'quicknode_8453',
      WEB3_RPC_8453_ALCHEMY: 'alchemy_8453',
      WEB3_RPC_8453_NIRVANA: 'nirvana_8453',
    }

    const randStub = sandbox.stub(Math, 'random')
    randStub.returns(0.9)

    expect(
      GlobalRpcProviders.getGlobalUniRpcProviders(log, UNI_PROVIDER_TEST_CONFIG, SINGLE_PROVIDER_TEST_CONFIG).has(
        ChainId.AVALANCHE
      )
    ).to.be.true

    expect(
      GlobalRpcProviders.getGlobalUniRpcProviders(log, UNI_PROVIDER_TEST_CONFIG, SINGLE_PROVIDER_TEST_CONFIG).has(
        ChainId.OPTIMISM
      )
    ).to.be.true

    const uniRpcProviderAvalanche = GlobalRpcProviders.getGlobalUniRpcProviders(
      log,
      UNI_PROVIDER_TEST_CONFIG,
      SINGLE_PROVIDER_TEST_CONFIG
    ).get(ChainId.AVALANCHE)!
    expect(uniRpcProviderAvalanche['providers'][0].url).equal('infura_43114')
    expect(uniRpcProviderAvalanche['providers'][1].url).equal('quicknode_43114')
    expect(uniRpcProviderAvalanche['providers'][2].url).equal('nirvana_43114')

    const uniRpcProviderOptimism = GlobalRpcProviders.getGlobalUniRpcProviders(
      log,
      UNI_PROVIDER_TEST_CONFIG,
      SINGLE_PROVIDER_TEST_CONFIG
    ).get(ChainId.OPTIMISM)!!
    expect(uniRpcProviderOptimism['providers'][0].url).equal('infura_10')
    expect(uniRpcProviderOptimism['providers'][1].url).equal('quicknode_10')
    expect(uniRpcProviderOptimism['providers'][2].url).equal('nirvana_10')
    expect(uniRpcProviderOptimism['providers'][3].url).equal('alchemy_10')

    const uniRpcProviderCelo = GlobalRpcProviders.getGlobalUniRpcProviders(
      log,
      UNI_PROVIDER_TEST_CONFIG,
      SINGLE_PROVIDER_TEST_CONFIG
    ).get(ChainId.CELO)!!
    expect(uniRpcProviderCelo['providers'][0].url).equal('infura_42220')
    expect(uniRpcProviderCelo['providers'][1].url).equal('quicknode_42220')

    const uniRpcProviderBnb = GlobalRpcProviders.getGlobalUniRpcProviders(
      log,
      UNI_PROVIDER_TEST_CONFIG,
      SINGLE_PROVIDER_TEST_CONFIG
    ).get(ChainId.BNB)!!
    expect(uniRpcProviderBnb['providers'][0].url).equal('quicknode_56')

    const uniRpcProviderPolygon = GlobalRpcProviders.getGlobalUniRpcProviders(
      log,
      UNI_PROVIDER_TEST_CONFIG,
      SINGLE_PROVIDER_TEST_CONFIG
    ).get(ChainId.POLYGON)!
    expect(uniRpcProviderPolygon['providers'][0].url).equal('infura_137')
    expect(uniRpcProviderPolygon['providers'][1].url).equal('quicknode_137')
    expect(uniRpcProviderPolygon['providers'][2].url).equal('alchemy_137')

    const uniRpcProviderBase = GlobalRpcProviders.getGlobalUniRpcProviders(
      log,
      UNI_PROVIDER_TEST_CONFIG,
      SINGLE_PROVIDER_TEST_CONFIG
    ).get(ChainId.BASE)!
    expect(uniRpcProviderBase['providers'][0].url).equal('infura_8453')
    expect(uniRpcProviderBase['providers'][1].url).equal('quicknode_8453')
    expect(uniRpcProviderBase['providers'][2].url).equal('alchemy_8453')
    expect(uniRpcProviderBase['providers'][3].url).equal('nirvana_8453')

    cleanUp()

    randStub.returns(1.0)
    expect(
      GlobalRpcProviders.getGlobalUniRpcProviders(log, UNI_PROVIDER_TEST_CONFIG, SINGLE_PROVIDER_TEST_CONFIG).has(
        ChainId.AVALANCHE
      )
    ).to.be.false
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
