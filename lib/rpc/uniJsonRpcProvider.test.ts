import UniJsonRpcProvider from './uniJsonRpcProvider'
import { ChainId } from '@uniswap/sdk-core'

describe('UniJsonRpcProvider', () => {
  it('basic test', () => {
    const rpcProvider = new UniJsonRpcProvider(ChainId.MAINNET, ['url1', 'url2'])
    rpcProvider['checkHealthStatus']()
  })
})