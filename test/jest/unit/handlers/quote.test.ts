import { expect } from '@jest/globals'
import { QuoteHandler } from '../../../../lib/handlers/quote/quote'
import { ChainId } from '@uniswap/sdk-core'
import { Protocol } from '@uniswap/router-sdk'

describe('QuoteHandler', () => {
  describe('.protocolsFromRequest', () => {
    it('returns V3 when no protocols are requested', () => {
      expect(QuoteHandler.protocolsFromRequest(ChainId.MAINNET, undefined, undefined)).toEqual([Protocol.V3])
    })

    it('returns V3 when forceCrossProtocol is false', () => {
      expect(QuoteHandler.protocolsFromRequest(ChainId.MAINNET, undefined, false)).toEqual([Protocol.V3])
    })

    it('returns empty when forceCrossProtocol is true', () => {
      expect(QuoteHandler.protocolsFromRequest(ChainId.MAINNET, undefined, true)).toEqual([])
    })

    it('returns requested protocols', () => {
      expect(QuoteHandler.protocolsFromRequest(ChainId.MAINNET, ['v2', 'v3', 'mixed'], undefined)).toEqual([
        Protocol.V2,
        Protocol.V3,
        Protocol.MIXED,
      ])
    })

    it('returns a different set of requested protocols', () => {
      expect(QuoteHandler.protocolsFromRequest(ChainId.MAINNET, ['v3', 'mixed'], undefined)).toEqual([
        Protocol.V3,
        Protocol.MIXED,
      ])
    })

    it('works with other chains', () => {
      expect(QuoteHandler.protocolsFromRequest(ChainId.BASE, ['v2', 'v3', 'mixed'], undefined)).toEqual([
        Protocol.V2,
        Protocol.V3,
        Protocol.MIXED,
      ])
    })

    it('returns undefined when a requested protocol is invalid', () => {
      expect(
        QuoteHandler.protocolsFromRequest(ChainId.BASE, ['v2', 'v3', 'mixed', 'miguel'], undefined)
      ).toBeUndefined()
    })
  })
})
