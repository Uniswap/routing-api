import { describe, expect, jest } from '@jest/globals'
import { tokenStringToCurrency } from '../../../../lib/handlers/shared'
import { ExtendedEther } from '@uniswap/smart-order-router'

describe('tokenStringToCurrency', () => {
  it('returns the native token if tokenRaw is a native token string', async () => {
    const result = await tokenStringToCurrency(
      {} as any, // tokenListProvider
      {} as any, // tokenProvider,
      'ETH',
      1,
      {
        debug: jest.fn(),
      } as any // log
    )

    expect(result).toBeDefined()
    expect(result).toEqual(ExtendedEther.onChain(1))
  })
})
