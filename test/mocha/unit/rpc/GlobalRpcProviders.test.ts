import { GlobalRpcProviders } from '../../../../lib/rpc/GlobalRpcProviders'
import { default as bunyan, default as Logger } from 'bunyan'
import { ChainId } from '@uniswap/sdk-core'
import { expect } from 'chai'
import { SingleJsonRpcProviderConfig, UniJsonRpcProviderConfig } from '../../../../lib/rpc/config'

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

describe('GlobalRpcProviders', () => {
  it('Prepare global UniJsonRpcProvider by reading config', () => {
    process.env = {
      UNI_RPC_PROVIDER_PROD_CONFIG:
        '[{"chainId":1,"useMultiProvider":false},{"chainId":43114,"useMultiProvider":true,"sessionAllowProviderFallbackWhenUnhealthy":true,"providerInitialWeights":[2,1],"providerUrls":["url0","url1"]}]',
    }

    expect(
      GlobalRpcProviders.getGlobalUniRpcProviders(log, UNI_PROVIDER_TEST_CONFIG, SINGLE_PROVIDER_TEST_CONFIG).has(
        ChainId.MAINNET
      )
    ).to.be.false

    expect(
      GlobalRpcProviders.getGlobalUniRpcProviders(log, UNI_PROVIDER_TEST_CONFIG, SINGLE_PROVIDER_TEST_CONFIG).has(
        ChainId.BNB
      )
    ).to.be.false

    expect(
      GlobalRpcProviders.getGlobalUniRpcProviders(log, UNI_PROVIDER_TEST_CONFIG, SINGLE_PROVIDER_TEST_CONFIG).has(
        ChainId.AVALANCHE
      )
    ).to.be.true

    const avaUniProvider = GlobalRpcProviders.getGlobalUniRpcProviders(
      log,
      UNI_PROVIDER_TEST_CONFIG,
      SINGLE_PROVIDER_TEST_CONFIG
    ).get(ChainId.AVALANCHE)!
    expect(avaUniProvider['sessionAllowProviderFallbackWhenUnhealthy']).to.be.true
    expect(avaUniProvider['urlWeight']).to.deep.equal({ url0: 2, url1: 1 })
    expect(avaUniProvider['providers'][0].url).to.equal('url0')
    expect(avaUniProvider['providers'][1].url).to.equal('url1')
  })
})
