import { expect } from '@jest/globals'
import { QuoteHandler } from '../../../../lib/handlers/quote/quote'
import { ChainId } from '@uniswap/sdk-core'
import { Protocol } from '@uniswap/router-sdk'
import { UniversalRouterVersion } from '@uniswap/universal-router-sdk'

describe('QuoteHandler', () => {
  describe('.protocolsFromRequest', () => {
    it('returns V3 when no protocols are requested', () => {
      expect(
        QuoteHandler.protocolsFromRequest(ChainId.MAINNET, UniversalRouterVersion.V1_2, undefined, undefined)
      ).toEqual([Protocol.V3])
    })

    it('returns V3 when forceCrossProtocol is false', () => {
      expect(QuoteHandler.protocolsFromRequest(ChainId.MAINNET, UniversalRouterVersion.V1_2, undefined, false)).toEqual(
        [Protocol.V3]
      )
    })

    it('returns empty when forceCrossProtocol is true', () => {
      expect(QuoteHandler.protocolsFromRequest(ChainId.MAINNET, UniversalRouterVersion.V1_2, undefined, true)).toEqual(
        []
      )
    })

    it('returns requested protocols', () => {
      expect(
        QuoteHandler.protocolsFromRequest(
          ChainId.MAINNET,
          UniversalRouterVersion.V1_2,
          ['v2', 'v3', 'mixed'],
          undefined
        )
      ).toEqual([Protocol.V2, Protocol.V3, Protocol.MIXED])
    })

    it('returns a different set of requested protocols', () => {
      expect(
        QuoteHandler.protocolsFromRequest(ChainId.MAINNET, UniversalRouterVersion.V1_2, ['v3', 'mixed'], undefined)
      ).toEqual([Protocol.V3, Protocol.MIXED])
    })

    it('works with other chains', () => {
      expect(
        QuoteHandler.protocolsFromRequest(ChainId.BASE, UniversalRouterVersion.V1_2, ['v2', 'v3', 'mixed'], undefined)
      ).toEqual([Protocol.V2, Protocol.V3, Protocol.MIXED])
    })

    it('returns undefined when a requested protocol is invalid', () => {
      expect(
        QuoteHandler.protocolsFromRequest(
          ChainId.BASE,
          UniversalRouterVersion.V1_2,
          ['v2', 'v3', 'mixed', 'miguel'],
          undefined
        )
      ).toBeUndefined()
    })

    it('returns v2, v3, mixed when universal router version is v1.2', () => {
      expect(
        QuoteHandler.protocolsFromRequest(
          ChainId.MAINNET,
          UniversalRouterVersion.V1_2,
          ['v2', 'v3', 'v4', 'mixed'],
          undefined
        )
      ).toEqual([Protocol.V2, Protocol.V3, Protocol.MIXED])
    })

    it('returns v2, v3, v4, mixed when universal router version is v2.0', () => {
      expect(
        QuoteHandler.protocolsFromRequest(
          ChainId.MAINNET,
          UniversalRouterVersion.V2_0,
          ['v2', 'v3', 'v4', 'mixed'],
          undefined
        )
      ).toEqual([Protocol.V2, Protocol.V3, Protocol.V4, Protocol.MIXED])
    })
  })
})
