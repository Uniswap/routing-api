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
      INFURA_43114: 'key0',
      QUICKNODE_43114: 'node1,key1',
    }
    const rpcProviderProdConfig = [
      { chainId: 1, useMultiProviderProb: 0 },
      {
        chainId: 43114,
        useMultiProviderProb: 1,
        sessionAllowProviderFallbackWhenUnhealthy: true,
        providerInitialWeights: [2, 1],
        providerUrls: ['INFURA_43114', 'QUICKNODE_43114'],
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
    const url0 = 'https://avalanche-mainnet.infura.io/v3/key0'
    const url1 = 'https://node1.avalanche-mainnet.quiknode.pro/key1/ext/bc/C/rpc/'
    expect(avaUniProvider['sessionAllowProviderFallbackWhenUnhealthy']).to.be.true
    expect(avaUniProvider['urlWeight']).to.deep.equal({ [url0]: 2, [url1]: 1 })
    expect(avaUniProvider['providers'][0].url).to.equal(url0)
    expect(avaUniProvider['providers'][1].url).to.equal(url1)
  })

  it('Prepare global UniJsonRpcProvider by reading config: Use prob to decide feature switch', () => {
    process.env = {
      INFURA_10: 'key0',
      QUICKNODE_10: 'node1,key1',
      INFURA_43114: 'key2',
      QUICKNODE_43114: 'node3,key3',
    }

    const rpcProviderProdConfig = [
      {
        chainId: 10,
        useMultiProviderProb: 0.3,
        providerUrls: ['INFURA_10', 'QUICKNODE_10'],
      },
      {
        chainId: 43114,
        useMultiProviderProb: 0.7,
        sessionAllowProviderFallbackWhenUnhealthy: true,
        providerInitialWeights: [2, 1],
        providerUrls: ['INFURA_43114', 'QUICKNODE_43114'],
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
      ).has(ChainId.OPTIMISM)
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
      ).has(ChainId.OPTIMISM)
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
      ).has(ChainId.OPTIMISM)
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
      ).has(ChainId.OPTIMISM)
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
      ).has(ChainId.OPTIMISM)
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
      ).has(ChainId.OPTIMISM)
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

  it('Prepare global UniJsonRpcProvider by reading config file', () => {
    process.env = {
      INFURA_43114: 'key0',
      QUICKNODE_43114: 'host1,key1',
      NIRVANA_43114: 'host2,key2',
      INFURA_10: 'key3',
      QUICKNODE_10: 'host3,key3',
      NIRVANA_10: 'host4,key4',
      ALCHEMY_10: 'key5',
      INFURA_42220: 'key6',
      QUICKNODE_42220: 'host7,key7',
      QUICKNODE_56: 'host8,key8',
      INFURA_137: 'key9',
      QUICKNODE_137: 'host10,key10',
      ALCHEMY_137: 'key11',
      INFURA_8453: 'key12',
      QUICKNODE_8453: 'host13,key13',
      ALCHEMY_8453: 'key14',
      NIRVANA_8453: 'host15,key15',
    }

    const uniRpcProviderAvalanche = GlobalRpcProviders.getGlobalUniRpcProviders(
      log,
      UNI_PROVIDER_TEST_CONFIG,
      SINGLE_PROVIDER_TEST_CONFIG
    ).get(ChainId.AVALANCHE)!
    expect(uniRpcProviderAvalanche['providers'][0].url).equal('https://avalanche-mainnet.infura.io/v3/key0')
    expect(uniRpcProviderAvalanche['providers'][1].url).equal(
      'https://host1.avalanche-mainnet.quiknode.pro/key1/ext/bc/C/rpc/'
    )
    expect(uniRpcProviderAvalanche['providers'][2].url).equal(
      'https://avax.nirvanalabs.xyz/host2/ext/bc/C/rpc?apikey=key2'
    )

    const uniRpcProviderOptimism = GlobalRpcProviders.getGlobalUniRpcProviders(
      log,
      UNI_PROVIDER_TEST_CONFIG,
      SINGLE_PROVIDER_TEST_CONFIG
    ).get(ChainId.OPTIMISM)!!
    expect(uniRpcProviderOptimism['providers'][0].url).equal('https://optimism-mainnet.infura.io/v3/key3')
    expect(uniRpcProviderOptimism['providers'][1].url).equal('https://host3.optimism.quiknode.pro/key3')
    expect(uniRpcProviderOptimism['providers'][2].url).equal('https://opt-mainnet.g.alchemy.com/v2/key5')

    const uniRpcProviderCelo = GlobalRpcProviders.getGlobalUniRpcProviders(
      log,
      UNI_PROVIDER_TEST_CONFIG,
      SINGLE_PROVIDER_TEST_CONFIG
    ).get(ChainId.CELO)!!
    expect(uniRpcProviderCelo['providers'][0].url).equal('https://celo-mainnet.infura.io/v3/key6')
    expect(uniRpcProviderCelo['providers'][1].url).equal('https://host7.celo-mainnet.quiknode.pro/key7')

    const uniRpcProviderBnb = GlobalRpcProviders.getGlobalUniRpcProviders(
      log,
      UNI_PROVIDER_TEST_CONFIG,
      SINGLE_PROVIDER_TEST_CONFIG
    ).get(ChainId.BNB)!!
    expect(uniRpcProviderBnb['providers'][0].url).equal('https://host8.bsc.quiknode.pro/key8')

    const uniRpcProviderPolygon = GlobalRpcProviders.getGlobalUniRpcProviders(
      log,
      UNI_PROVIDER_TEST_CONFIG,
      SINGLE_PROVIDER_TEST_CONFIG
    ).get(ChainId.POLYGON)!
    expect(uniRpcProviderPolygon['providers'][0].url).equal('https://polygon-mainnet.infura.io/v3/key9')
    expect(uniRpcProviderPolygon['providers'][1].url).equal('https://host10.matic.quiknode.pro/key10')
    expect(uniRpcProviderPolygon['providers'][2].url).equal('https://polygon-mainnet.g.alchemy.com/v2/key11')

    const uniRpcProviderBase = GlobalRpcProviders.getGlobalUniRpcProviders(
      log,
      UNI_PROVIDER_TEST_CONFIG,
      SINGLE_PROVIDER_TEST_CONFIG
    ).get(ChainId.BASE)!
    expect(uniRpcProviderBase['providers'][0].url).equal('https://base-mainnet.infura.io/v3/key12')
    expect(uniRpcProviderBase['providers'][1].url).equal('https://host13.base-mainnet.quiknode.pro/key13')
    expect(uniRpcProviderBase['providers'][2].url).equal('https://base-mainnet.g.alchemy.com/v2/key14')
    expect(uniRpcProviderBase['providers'][3].url).equal('https://base.nirvanalabs.xyz/host15?apikey=key15')

    cleanUp()
  })
})
