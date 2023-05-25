import { ICache } from '@uniswap/smart-order-router'

export class DynamoCache<T> implements ICache<T> {
  constructor(private nodeCache: NodeCache) {}

  async get(key: string): Promise<T | undefined> {
    return this.nodeCache.get<T>(key);
  }

  async set(key: string, value: T): Promise<boolean> {
    return this.nodeCache.set(key, value);
  }

  async has(key: string): Promise<boolean> {
    return this.nodeCache.has(key);
  }
}