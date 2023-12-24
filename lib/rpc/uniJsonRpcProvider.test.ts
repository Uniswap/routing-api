import { expect } from 'chai'

import UniJsonRpcProvider from './uniJsonRpcProvider'
import { ChainId } from '@uniswap/sdk-core'

describe('UniJsonRpcProvider', () => {
  let uniProvider: UniJsonRpcProvider

  beforeEach(() => {
    uniProvider = new UniJsonRpcProvider(ChainId.MAINNET,
      ['provider_0_url', 'provider_1_url', 'provider_2_url'])
  })

  it('basic test', () => {
    const rpcProvider = new UniJsonRpcProvider(ChainId.MAINNET, ['url1', 'url2'])
    rpcProvider['checkHealthStatus']()
  })

  it('test reorderHealthyProviders()', () => {
    uniProvider['healthyProviders'].reverse()
    uniProvider['reorderHealthyProviders']()
    expect(uniProvider['healthyProviders'][0].url).to.be.equal('provider_0_url')
    expect(uniProvider['healthyProviders'][1].url).to.be.equal('provider_1_url')
    expect(uniProvider['healthyProviders'][2].url).to.be.equal('provider_2_url')
  })
})