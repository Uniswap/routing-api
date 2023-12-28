import { ChainId } from '@uniswap/sdk-core'
import { SingleJsonRpcProvider } from './singleJsonRpcProvider'
import Sinon from 'sinon'
import chai, { expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'

chai.use(chaiAsPromised)

// TODO(jie): 需要确保要使用line coverage！这样才能有足够的confidence!
describe('SingleJsonRpcProvider', () => {
  let provider: SingleJsonRpcProvider

  beforeEach(() => {
    provider = new SingleJsonRpcProvider(ChainId.MAINNET, 'provider_0_url')
    // provider = new SingleJsonRpcProvider(ChainId.MAINNET, 'https://mainnet.infura.io/v3/1251f92fb3044883b08bd8913471ba6e')
  })

  // it('basic test', () => {
  //   const rpcProvider = new UniJsonRpcProvider(ChainId.MAINNET, ['url1', 'url2'])
  //   rpcProvider['checkProviderHealthStatus']()
  // })

  // it('test with real endpoint, single', async () => {
  //   const blockNumber = await provider.getBlockNumber()
  //   console.log(blockNumber)
  //   console.log(`${JSON.stringify(provider['perf'])}`)
  // })

  it('provider call succeeded', async () => {
    const performCall = Sinon.stub(SingleJsonRpcProvider.prototype, '_perform' as any)
    performCall.resolves(123456)

    const blockNumber = await provider.getBlockNumber()

    performCall.restore()
    expect(blockNumber).equals(123456)
    expect(provider['perf'].lastCallSucceed).to.be.true
  })

  it('provider call failed', async () => {
    const performCall = Sinon.stub(SingleJsonRpcProvider.prototype, '_perform' as any)
    performCall.throws('error')

    expect(provider.getBlockNumber()).to.eventually.be.rejected

    performCall.restore()
    expect(provider['perf'].lastCallSucceed).to.be.false
  })

})