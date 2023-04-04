import { expect } from 'chai'
import { ProtocolsBucketBlockNumber } from '../../../../../../lib/handlers/router-entities/route-caching/model/protocols-bucket-block-number'
import { Protocol } from '@uniswap/router-sdk'

describe('ProtocolsBucketBlockNumber', () => {
  describe('#fullKey', () => {
    it('returns a string-ified version of the object', () => {
      const protocolsBucketBlockNumber = new ProtocolsBucketBlockNumber({
        protocols: [Protocol.MIXED, Protocol.V2, Protocol.V3],
        bucket: 5,
        blockNumber: 12345,
      })

      expect(protocolsBucketBlockNumber.fullKey()).to.eq('MIXED,V2,V3/5/12345')
    })

    it('protocols are sorted, even if the original array is not', () => {
      const protocolsBucketBlockNumber = new ProtocolsBucketBlockNumber({
        protocols: [Protocol.V3, Protocol.MIXED, Protocol.V2],
        bucket: 5,
        blockNumber: 12345,
      })

      expect(protocolsBucketBlockNumber.fullKey()).to.eq('MIXED,V2,V3/5/12345')
    })

    it('throws an error when the bucketNumber is undefined', () => {
      const protocolsBucketBlockNumber = new ProtocolsBucketBlockNumber({
        protocols: [Protocol.V3, Protocol.MIXED, Protocol.V2],
        bucket: 5,
      })

      expect(() => protocolsBucketBlockNumber.fullKey()).to.throw('BlockNumber is necessary to create a fullKey')
    })
  })

  describe('#protocolsBucketPartialKey', () => {
    it('returns a string-ified version of the object without the blockNumber', () => {
      const protocolsBucketBlockNumber = new ProtocolsBucketBlockNumber({
        protocols: [Protocol.MIXED, Protocol.V2, Protocol.V3],
        bucket: 5,
        blockNumber: 12345,
      })

      expect(protocolsBucketBlockNumber.protocolsBucketPartialKey()).to.eq('MIXED,V2,V3/5/')
    })

    it('protocols are sorted, even if the original array is not, without the blockNumber', () => {
      const protocolsBucketBlockNumber = new ProtocolsBucketBlockNumber({
        protocols: [Protocol.V3, Protocol.MIXED, Protocol.V2],
        bucket: 5,
        blockNumber: 12345,
      })

      expect(protocolsBucketBlockNumber.protocolsBucketPartialKey()).to.eq('MIXED,V2,V3/5/')
    })

    it('returns the partial key even if blockNumber is undefined', () => {
      const protocolsBucketBlockNumber = new ProtocolsBucketBlockNumber({
        protocols: [Protocol.V3, Protocol.MIXED, Protocol.V2],
        bucket: 5,
      })

      expect(protocolsBucketBlockNumber.protocolsBucketPartialKey()).to.eq('MIXED,V2,V3/5/')
    })
  })
})
