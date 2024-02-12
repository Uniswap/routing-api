import { GlobalRpcProviders } from '../../../../lib/rpc/GlobalRpcProviders'
import { default as bunyan, default as Logger } from 'bunyan'
import { ChainId } from '@uniswap/sdk-core'
import { expect } from 'chai'
import { Config } from '../../../../lib/rpc/config'

const log: Logger = bunyan.createLogger({ name: 'test' })

const TEST_CONFIG: Config = {
  ERROR_PENALTY: -50,
  HIGH_LATENCY_PENALTY: -50,
  HEALTH_SCORE_FALLBACK_THRESHOLD: -70,
  HEALTH_SCORE_RECOVER_THRESHOLD: -10,
  MAX_LATENCY_ALLOWED_IN_MS: 500,
  RECOVER_SCORE_PER_MS: 0.005,
  RECOVER_EVALUATION_WAIT_PERIOD_IN_MS: 5000,
  RECOVER_MAX_WAIT_TIME_TO_ACKNOWLEDGE_IN_MS: 20000,
  DB_SYNC_INTERVAL_IN_S: 5,
  ENABLE_DB_SYNC: false,
}

describe('GlobalRpcProviders', () => {
  it('Prepare global UniJsonRpcProvider by reading config', () => {
    process.env = {
      UNI_RPC_PROVIDER_CONFIG: '{"1": "false", "43114": "true"}',
      WEB3_RPC_1: 'url_1',
      WEB3_RPC_43114: 'url_43114',
    }

    expect(GlobalRpcProviders.getGlobalUniRpcProviders(log, TEST_CONFIG).has(ChainId.MAINNET)).to.be.false

    expect(GlobalRpcProviders.getGlobalUniRpcProviders(log, TEST_CONFIG).has(ChainId.AVALANCHE)).to.be.true
    expect(GlobalRpcProviders.getGlobalUniRpcProviders(log, TEST_CONFIG).get(ChainId.AVALANCHE)?.chainId).to.be.equal(
      ChainId.AVALANCHE
    )
  })
})
