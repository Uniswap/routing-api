import { describe, expect, jest } from '@jest/globals'
import { ExtendedEther } from '@uniswap/smart-order-router'
import { ChainId, Token } from '@uniswap/sdk-core'
import { TokenLookup } from '../../../../lib/handlers/TokenLookup'

const address = '0x0000000000000000000000000000000000000001'
const token = new Token(ChainId.MAINNET, address, 18, 'FOO', 'Foo')

describe('TokenLookup', () => {
  it('Returns the native token if tokenRaw is a native token string', async () => {
    const tokenLookup = new TokenLookup(
      {} as any, // tokenListProvider
      {} as any, // tokenProvider,
      {
        info: jest.fn(),
      } as any // log
    )
    const result = await tokenLookup.tokenStringToCurrency('ETH', 1)

    expect(result).toBeDefined()
    expect(result).toEqual(ExtendedEther.onChain(1))
  })

  it('Finds the token in the token list when the input is an address', async () => {
    const tokenLookup = new TokenLookup(
      {
        getTokenByAddress: (inputAddress: string) => (inputAddress === address ? token : undefined),
      } as any, // tokenListProvider
      {} as any, // tokenProvider,
      {
        info: jest.fn(),
      } as any // log
    )
    const result = await tokenLookup.tokenStringToCurrency(address, 1)

    expect(result).toBeDefined()
    expect(result).toEqual(token)
  })

  it('Finds the token in the token list when the input is a symbol', async () => {
    const tokenLookup = new TokenLookup(
      {
        getTokenBySymbol: (inputSymbol: string) => (inputSymbol === 'FOO' ? token : undefined),
      } as any, // tokenListProvider
      {} as any, // tokenProvider,
      {
        info: jest.fn(),
      } as any // log
    )
    const result = await tokenLookup.tokenStringToCurrency('FOO', 1)

    expect(result).toBeDefined()
    expect(result).toEqual(token)
  })

  it('Returns the token if the on-chain lookup by address is successful', async () => {
    const tokenLookup = new TokenLookup(
      {
        // Both token list lookups return null
        getTokenBySymbol: () => undefined,
        getTokenByAddress: () => undefined,
      } as any, // tokenListProvider
      {
        getTokens: () => {
          return {
            getTokenByAddress: (inputAddress: string) => (inputAddress === address ? token : undefined),
          }
        },
      } as any, // tokenProvider,
      {
        info: jest.fn(),
      } as any // log
    )
    const result = await tokenLookup.tokenStringToCurrency(address, 1)

    // Because the input address was a symbol and not an address, expect the result to be undefined.
    expect(result).toBe(token)
  })

  it('Returns undefined if the on-chain lookup is by symbol', async () => {
    const tokenLookup = new TokenLookup(
      {
        // Both token list lookups return null
        getTokenBySymbol: () => undefined,
        getTokenByAddress: () => undefined,
      } as any, // tokenListProvider
      {
        getTokens: () => {
          return {
            getTokenByAddress: (inputAddress: string) => (inputAddress === address ? token : undefined),
          }
        },
      } as any, // tokenProvider,
      {
        info: jest.fn(),
      } as any // log
    )
    const result = await tokenLookup.tokenStringToCurrency('FOO', 1)

    // Because the input address was a symbol and not an address, expect the result to be undefined.
    expect(result).toBeUndefined()
  })
})
