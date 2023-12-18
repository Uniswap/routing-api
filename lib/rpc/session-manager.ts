import { LRUCache } from 'lru-cache'
import { SingleJsonRpcProvider } from './single-json-rpc-provider'

export class SessionManager {
  constructor(private cache: LRUCache<string, SingleJsonRpcProvider>) {
  }

  public getProvider(sessionId: string) {
    return this.cache.get(sessionId)
  }
}
