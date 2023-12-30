import { assert, expect } from 'chai'

import UniJsonRpcProvider from './uniJsonRpcProvider'
import { ChainId } from '@uniswap/sdk-core'
// import { SingleJsonRpcProvider } from './singleJsonRpcProvider'
import Sinon, { SinonSandbox } from 'sinon'
import { Config } from './config'
// import { SingleJsonRpcProvider } from './singleJsonRpcProvider'
// import { StaticJsonRpcProvider } from '@ethersproject/providers'

const TEST_CONFIG: Config = {
  ERROR_PENALTY: -50,
  HIGH_LATENCY_PENALTY: -50,
  HEALTH_SCORE_THRESHOLD: -70,
  MAX_LATENCY_ALLOWED_IN_MS: 500,
  RECOVER_SCORE_PER_MS: 0.005,
  RECOVER_EVALUATION_THRESHOLD: -20,
  RECOVER_EVALUATION_WAIT_PERIOD_IN_MS: 5000,
}

describe('UniJsonRpcProvider', () => {
  let uniProvider: UniJsonRpcProvider
  let sandbox: SinonSandbox

  beforeEach(() => {
    uniProvider = new UniJsonRpcProvider(ChainId.MAINNET,
      ['url_0', 'url_1', 'url_2'], TEST_CONFIG)
    sandbox = Sinon.createSandbox()
  })

  afterEach(() => {
    sandbox.restore()
  })

  it('all provider healthy', async () => {
    const perform0 = sandbox.stub(uniProvider['healthyProviders'][0], '_perform' as any)
    perform0.resolves(123)
    const perform1 = sandbox.stub(uniProvider['healthyProviders'][1], '_perform' as any)
    perform1.resolves(456)
    const perform2 = sandbox.stub(uniProvider['healthyProviders'][2], '_perform' as any)
    perform2.resolves(789)

    expect(uniProvider.lastUsedUrl).undefined
    const blockNumber = await uniProvider.getBlockNumber()
    expect(blockNumber).equals(123)
    expect(uniProvider.lastUsedUrl).equals('url_0')
  })

  it('first provider unhealthy', async () => {
    const perform0 = sandbox.stub(uniProvider['healthyProviders'][0], '_perform' as any)
    perform0.throws('error')
    const perform1 = sandbox.stub(uniProvider['healthyProviders'][1], '_perform' as any)
    perform1.resolves(456)
    const perform2 = sandbox.stub(uniProvider['healthyProviders'][2], '_perform' as any)
    perform2.resolves(789)

    uniProvider['debugPrintProviderHealthScores']()

    // Two failed calls makes provider0 unhealthy
    try {
      await uniProvider.getBlockNumber()
      assert(false)  // Should not reach.
    } catch (err: any) {
      expect(err.name).equals('error')
    }
    try {
      await uniProvider.getBlockNumber()
      assert(false)  // Should not reach.
    } catch (err: any) {
      expect(err.name).equals('error')
    }

    expect(uniProvider.lastUsedUrl).equals('url_0')
    // uniProvider['debugPrintProviderHealthScores']()
    expect(uniProvider.currentHealthyUrls).to.have.ordered.members(['url_1', 'url_2'])
    expect(uniProvider.currentUnhealthyUrls).to.have.ordered.members(['url_0'])

    // Now later requests will be served with provider1
    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_1')
    await uniProvider.getBlockNumber()
    expect(uniProvider.lastUsedUrl).equals('url_1')
  })

  // it('basic test', () => {
  //   const rpcProvider = new UniJsonRpcProvider(ChainId.MAINNET, ['url1', 'url2'])
  //   rpcProvider['checkProviderHealthStatus']()
  // })

  // it('test reorderHealthyProviders()', () => {
  //   uniProvider['healthyProviders'].reverse()
  //   uniProvider['reorderHealthyProviders']()
  //   expect(uniProvider['healthyProviders'][0].url).to.be.equal('url_0')
  //   expect(uniProvider['healthyProviders'][1].url).to.be.equal('url_1')
  //   expect(uniProvider['healthyProviders'][2].url).to.be.equal('url_2')
  // })

  // it('test with real endpoint, single', async () => {
  //   const provider = new SingleJsonRpcProvider(ChainId.MAINNET, 'https://mainnet.infura.io/v3/1251f92fb3044883b08bd8913471ba6e')
  //   const blockNumber = await provider.getBlockNumber()
  //   console.log(blockNumber)
  //   console.log(`${JSON.stringify(provider['perf'])}`)
  // })

  // it('test with real endpoint, uni', async () => {
  //   const provider = new UniJsonRpcProvider(ChainId.MAINNET, [
  //     'https://mainnet.infura.io/v3/1251f92fb3044883b08bd8913471ba6e',
  //     'https://eth-mainnet.g.alchemy.com/v2/PC1uzrHueA8AdsD8jdQPcXFt4IUKSm-g',
  //   ])
  //   const blockNumber = await provider.getBlockNumber()
  //   console.log(blockNumber)
  // })


})