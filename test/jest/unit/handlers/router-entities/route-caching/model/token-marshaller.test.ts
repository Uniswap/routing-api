import { describe, expect, it } from '@jest/globals'
import { TokenMarshaller } from '../../../../../../../lib/handlers/router-entities/route-caching'
import { ChainId } from '@uniswap/sdk-core'
import { nativeOnChain } from '@uniswap/smart-order-router'
import { WETH } from '@uniswap/universal-router-sdk/dist/test/utils/uniswapData'

describe('TokenMarshaller', () => {
  it('returns native currency', () => {
    const marshalledCurrency = TokenMarshaller.marshal(nativeOnChain(ChainId.MAINNET))
    const currency = TokenMarshaller.unmarshal(marshalledCurrency)
    expect(currency).toEqual(nativeOnChain(ChainId.MAINNET))
  })

  it('returns token currency', () => {
    const marshalledCurrency = TokenMarshaller.marshal(WETH)
    const currency = TokenMarshaller.unmarshal(marshalledCurrency)
    expect(currency).toEqual(WETH)
  })
})
