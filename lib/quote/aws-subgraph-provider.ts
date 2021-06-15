import { ISubgraphProvider, SubgraphPool } from '@uniswap/smart-order-router';
import { S3 } from 'aws-sdk';
import Logger from 'bunyan';
import NodeCache from 'node-cache';

const POOL_CACHE = new NodeCache({ stdTTL: 240, useClones: false });
const POOL_CACHE_KEY = 'pools';

export class AWSSubgraphProvider implements ISubgraphProvider {
  constructor(
    private bucket: string,
    private key: string,
    protected log: Logger
  ) {}

  public async getPools(): Promise<SubgraphPool[]> {
    const s3 = new S3();

    this.log.debug(
      { cacheStats: POOL_CACHE.getStats() },
      'Subgraph pool cache status'
    );

    const cachedPools = POOL_CACHE.get<SubgraphPool[]>(POOL_CACHE_KEY);

    if (cachedPools) {
      this.log.info(
        { subgraphPools: cachedPools.length },
        'Subgraph pool fetched from local cache.'
      );

      return cachedPools;
    }

    this.log.info(
      { bucket: this.bucket, key: this.key },
      'Subgraph pools local cache miss. Getting subgraph pools from S3'
    );

    const result = await s3
      .getObject({ Key: this.key, Bucket: this.bucket })
      .promise();

    const { Body: poolsBuffer } = result;

    this.log.info(
      { bucket: this.bucket, key: this.key },
      'Got subgraph pools from S3'
    );

    if (!poolsBuffer) {
      throw new Error('Could not get subgraph pool cache from S3');
    }

    const pools = JSON.parse(poolsBuffer.toString('utf-8')) as SubgraphPool[];

    POOL_CACHE.set<SubgraphPool[]>(POOL_CACHE_KEY, pools);

    return pools;
  }
}
