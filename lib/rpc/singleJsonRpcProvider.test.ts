import { ChainId } from '@uniswap/sdk-core'
import { SingleJsonRpcProvider } from './singleJsonRpcProvider'

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

  it('test with real endpoint, single', async () => {
    const blockNumber = await provider.getBlockNumber()
    console.log(blockNumber)
    console.log(`${JSON.stringify(provider['perf'])}`)
  })

  it('test with mocked provider', async () => {
    // TODO(jie): I need to learn to use Sinon mock. Let provider._perform() return a correct or error out,
    //   then check provider's properties' updates
    //   check correct or error should be inside different UT functions
    // const blockNumber = await provider.getBlockNumber()
    // console.log(blockNumber)
    // console.log(`${JSON.stringify(provider['perf'])}`)
  })

})