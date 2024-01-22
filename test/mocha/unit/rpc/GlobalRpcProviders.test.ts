import { GlobalRpcProviders } from '../../../../lib/rpc/GlobalRpcProviders'
import { default as bunyan, default as Logger } from 'bunyan'
import { ChainId } from '@uniswap/sdk-core'
import { expect } from 'chai'

const log: Logger = bunyan.createLogger({ name: 'test' })
describe('GlobalRpcProviders', () => {
  it('Prepare global UniJsonRpcProvider by reading config', () => {
    process.env = {
      UNI_RPC_PROVIDER_CONFIG: '{"1": "false", "43114": "true"}',
      WEB3_RPC_1: 'url_1',
      WEB3_RPC_43114: 'url_43114',
    }

    expect(GlobalRpcProviders.getGlobalUniRpcProviders(log).has(ChainId.MAINNET)).to.be.false

    expect(GlobalRpcProviders.getGlobalUniRpcProviders(log).has(ChainId.AVALANCHE)).to.be.true
    expect(GlobalRpcProviders.getGlobalUniRpcProviders(log).get(ChainId.AVALANCHE)?.chainId).to.be.equal(
      ChainId.AVALANCHE
    )
  })
})
