import { Protocol } from '@uniswap/router-sdk'

interface ProtocolsBucketBlockNumberArgs {
  protocols: Protocol[]
  bucket: number
  blockNumber: number
}

/**
 * Class used to model the sort key of the CachedRoutes cache database.
 */
export class ProtocolsBucketBlockNumber {
  public readonly protocols: Protocol[]
  public readonly bucket: number
  public readonly blockNumber: number

  constructor({ protocols, bucket, blockNumber }: ProtocolsBucketBlockNumberArgs) {
    this.protocols = protocols.sort()
    this.bucket = bucket
    this.blockNumber = blockNumber
  }

  public fullKey(): string {
    return `${this.protocols}/${this.bucket}/${this.blockNumber}`
  }

  public protocolsBucketPartialKey(): string {
    // allowing up to 100 blocks in the query
    const partialBlockNumber = this.blockNumber.toString().slice(0, -2)
    return `${this.protocols}/${this.bucket}/${partialBlockNumber}`
  }
}
