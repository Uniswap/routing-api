import { expect } from '@jest/globals'
import { QuoteHandler } from '../../../../lib/handlers/quote/quote'
import { ChainId } from '@uniswap/sdk-core'
import { Protocol } from '@uniswap/router-sdk'

describe('QuoteHandler', () => {
  describe('.protocolsFromRequest', () => {
    it('returns V3 when no protocols are requested', () => {
      const isMobileRequest = ['uniswap-ios', 'uniswap-android'].includes('')
      expect(
        QuoteHandler.protocolsFromRequest(ChainId.MAINNET, undefined, isMobileRequest, undefined, undefined)
      ).toEqual([Protocol.V3])
    })

    it('returns V3 when forceCrossProtocols is false', () => {
      const isMobileRequest = ['uniswap-ios', 'uniswap-android'].includes('')
      expect(QuoteHandler.protocolsFromRequest(ChainId.MAINNET, undefined, isMobileRequest, undefined, false)).toEqual([
        Protocol.V3,
      ])
    })

    it('returns empty when forceCrossProtocols is true', () => {
      const isMobileRequest = ['uniswap-ios', 'uniswap-android'].includes('')
      expect(QuoteHandler.protocolsFromRequest(ChainId.MAINNET, undefined, isMobileRequest, undefined, true)).toEqual(
        []
      )
    })

    it('returns requested protocols', () => {
      const isMobileRequest = ['uniswap-ios', 'uniswap-android'].includes('')
      expect(
        QuoteHandler.protocolsFromRequest(ChainId.MAINNET, ['v2', 'v3', 'mixed'], isMobileRequest, undefined, undefined)
      ).toEqual([Protocol.V2, Protocol.V3, Protocol.MIXED])
    })

    it('returns a different set of requested protocols', () => {
      const isMobileRequest = ['uniswap-ios', 'uniswap-android'].includes('')
      expect(
        QuoteHandler.protocolsFromRequest(ChainId.MAINNET, ['v3', 'mixed'], isMobileRequest, undefined, undefined)
      ).toEqual([Protocol.V3, Protocol.MIXED])
    })

    it('works with other chains', () => {
      const isMobileRequest = ['uniswap-ios', 'uniswap-android'].includes('')
      expect(
        QuoteHandler.protocolsFromRequest(ChainId.BASE, ['v2', 'v3', 'mixed'], isMobileRequest, undefined, undefined)
      ).toEqual([Protocol.V2, Protocol.V3, Protocol.MIXED])
    })

    it('returns undefined when a requested protocol is invalid', () => {
      const isMobileRequest = ['uniswap-ios', 'uniswap-android'].includes('')
      expect(
        QuoteHandler.protocolsFromRequest(
          ChainId.BASE,
          ['v2', 'v3', 'mixed', 'miguel'],
          isMobileRequest,
          undefined,
          undefined
        )
      ).toBeUndefined()
    })

    describe('for mobile request', () => {
      it('removes v2 and mixed with other chains, when the requested source is mobile', () => {
        ;['uniswap-ios', 'uniswap-android'].forEach((requestSource) => {
          const isMobileRequest = ['uniswap-ios', 'uniswap-android'].includes(requestSource)
          expect(
            QuoteHandler.protocolsFromRequest(
              ChainId.BASE,
              ['v2', 'v3', 'mixed'],
              isMobileRequest,
              undefined,
              undefined
            )
          ).toEqual([Protocol.V3])
        })
      })

      it('removes v2 and mixed with other chains, when the requested source is mobile, and version 1.22, 1.22.5 or 1.23', () => {
        ;['uniswap-ios', 'uniswap-android'].forEach((requestSource) => {
          const isMobileRequest = ['uniswap-ios', 'uniswap-android'].includes(requestSource)
          ;['1.22', '1.22.5', '1.23'].forEach((appVersion) => {
            expect(
              QuoteHandler.protocolsFromRequest(
                ChainId.BASE,
                ['v2', 'v3', 'mixed'],
                isMobileRequest,
                appVersion,
                undefined
              )
            ).toEqual([Protocol.V3])
          })
        })
      })

      it('allows v2 and mixed with mainnet, even when the requested source is mobile, and version 1.22, 1.22.5 or 1.23', () => {
        ;['uniswap-ios', 'uniswap-android'].forEach((requestSource) => {
          const isMobileRequest = ['uniswap-ios', 'uniswap-android'].includes(requestSource)
          ;['1.22', '1.22.5', '1.23', '1.23.build-0'].forEach((appVersion) => {
            expect(
              QuoteHandler.protocolsFromRequest(
                ChainId.MAINNET,
                ['v2', 'v3', 'mixed'],
                isMobileRequest,
                appVersion,
                undefined
              )
            ).toEqual([Protocol.V2, Protocol.V3, Protocol.MIXED])
          })
        })
      })

      it('allows v2 and mixed with other chains, when the requested source is mobile, and version is 1.24 or greater', () => {
        ;['uniswap-ios', 'uniswap-android'].forEach((requestSource) => {
          const isMobileRequest = ['uniswap-ios', 'uniswap-android'].includes(requestSource)
          ;['1.24', '1.25', '1.25.5', '1.26', '1.26.test'].forEach((appVersion) => {
            expect(
              QuoteHandler.protocolsFromRequest(
                ChainId.BASE,
                ['v2', 'v3', 'mixed'],
                isMobileRequest,
                appVersion,
                undefined
              )
            ).toEqual([Protocol.V2, Protocol.V3, Protocol.MIXED])
          })
        })
      })
    })
  })
})
