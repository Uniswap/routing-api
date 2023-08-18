import { Protocol } from '@uniswap/router-sdk'

interface ProtocolsBucketBlockNumberArgs {
  protocols: Protocol[]
  bucket: number
  blockNumber?: number
}

/**
 * Class used to model the sort key of the CachedRoutes cache database.
 */
export class ProtocolsBucketBlockNumber {
  public readonly protocols: Protocol[]
  public readonly bucket: number
  public readonly blockNumber?: number

  constructor({ protocols, bucket, blockNumber }: ProtocolsBucketBlockNumberArgs) {
    this.protocols = protocols.sort()
    this.bucket = bucket
    this.blockNumber = blockNumber
  }

  public fullKey(): string {
    if (this.blockNumber === undefined) {
      throw Error('BlockNumber is necessary to create a fullKey')
    }

    return `${this.protocols}/${this.bucket}/${this.blockNumber}`
  }

  public protocolsBucketPartialKey(): string {
    return `${this.protocols}/${this.bucket}/`
  }
}
