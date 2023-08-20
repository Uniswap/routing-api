import { ProtocolsBucketBlockNumber } from '../../../../../../../lib/handlers/router-entities/route-caching/model/protocols-bucket-block-number'
import { Protocol } from '@uniswap/router-sdk'
import { describe, it, expect } from '@jest/globals'

describe('ProtocolsBucketBlockNumber', () => {
  describe('#fullKey', () => {
    it('returns a string-ified version of the object', () => {
      const protocolsBucketBlockNumber = new ProtocolsBucketBlockNumber({
        protocols: [Protocol.MIXED, Protocol.V2, Protocol.V3],
        bucket: 5,
        blockNumber: 12345,
      })

      expect(protocolsBucketBlockNumber.fullKey()).toBe('MIXED,V2,V3/5/12345')
    })

    it('protocols are sorted, even if the original array is not', () => {
      const protocolsBucketBlockNumber = new ProtocolsBucketBlockNumber({
        protocols: [Protocol.V3, Protocol.MIXED, Protocol.V2],
        bucket: 5,
        blockNumber: 12345,
      })

      expect(protocolsBucketBlockNumber.fullKey()).toBe('MIXED,V2,V3/5/12345')
    })
  })

  describe('#protocolsBucketPartialKey', () => {
    it('returns a string-ified version of the object without the last digit of the blockNumber', () => {
      const protocolsBucketBlockNumber = new ProtocolsBucketBlockNumber({
        protocols: [Protocol.MIXED, Protocol.V2, Protocol.V3],
        bucket: 5,
        blockNumber: 12345,
      })

      expect(protocolsBucketBlockNumber.protocolsBucketPartialKey()).toBe('MIXED,V2,V3/5/123')
    })

    it('protocols are sorted, even if the original array is not, without the last digit of the blockNumber', () => {
      const protocolsBucketBlockNumber = new ProtocolsBucketBlockNumber({
        protocols: [Protocol.V3, Protocol.MIXED, Protocol.V2],
        bucket: 5,
        blockNumber: 12345,
      })

      expect(protocolsBucketBlockNumber.protocolsBucketPartialKey()).toBe('MIXED,V2,V3/5/123')
    })
  })
})
