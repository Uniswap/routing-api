/**
 * Quote Cache Service for JuiceSwap API
 *
 * This caching layer significantly reduces RPC calls during high-traffic events
 * like the Citrea bApps Campaign where 1000+ users request identical quotes.
 *
 * Benefits:
 * - Reduces RPC calls from 1000/second to 1/30seconds for identical requests
 * - Improves response time for users (cached responses are instant)
 * - Prevents rate limiting and RPC node overload
 */

interface CachedQuote {
  data: any;
  timestamp: number;
  hitCount: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  totalRequests: number;
  cacheSize: number;
  avgHitRate: number;
}

export class QuoteCache {
  private cache: Map<string, CachedQuote> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    totalRequests: 0,
    cacheSize: 0,
    avgHitRate: 0,
  };

  // Configuration
  private readonly DEFAULT_TTL = 30_000; // 30 seconds for production
  private readonly CITREA_TTL = 60_000; // 60 seconds for Citrea (less volatile)
  private readonly MAX_CACHE_SIZE = 1000;
  private readonly CLEANUP_INTERVAL = 60_000; // Run cleanup every minute

  constructor() {
    // Start periodic cleanup
    setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
    console.log('[QuoteCache] Initialized with TTL: 30s default, 60s for Citrea');
  }

  /**
   * Generate cache key from quote parameters
   * Excludes user-specific fields like 'swapper' to maximize cache hits
   */
  private generateKey(params: any): string {
    const {
      tokenIn,
      tokenInAddress,
      tokenOut,
      tokenOutAddress,
      tokenInChainId,
      tokenOutChainId,
      amount,
      type,
    } = params;

    // Normalize token addresses
    const inToken = (tokenIn || tokenInAddress || '').toLowerCase();
    const outToken = (tokenOut || tokenOutAddress || '').toLowerCase();

    // Create deterministic key
    return `${tokenInChainId}_${inToken}_${tokenOutChainId}_${outToken}_${amount}_${type || 'EXACT_INPUT'}`;
  }

  /**
   * Check if this is a Citrea testnet quote
   */
  private isCitreaQuote(params: any): boolean {
    const CITREA_TESTNET_CHAIN_ID = 5003; // Citrea testnet chain ID
    return params.tokenInChainId === CITREA_TESTNET_CHAIN_ID ||
           params.tokenOutChainId === CITREA_TESTNET_CHAIN_ID;
  }

  /**
   * Get TTL based on chain
   */
  private getTTL(params: any): number {
    return this.isCitreaQuote(params) ? this.CITREA_TTL : this.DEFAULT_TTL;
  }

  /**
   * Get cached quote if available and valid
   */
  get(params: any): any | null {
    const key = this.generateKey(params);
    const cached = this.cache.get(key);

    this.stats.totalRequests++;

    if (!cached) {
      this.stats.misses++;
      this.updateHitRate();
      console.log(`[QuoteCache] MISS - Key: ${key.substring(0, 50)}...`);
      return null;
    }

    const age = Date.now() - cached.timestamp;
    const ttl = this.getTTL(params);

    if (age > ttl) {
      // Expired entry
      this.cache.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      console.log(`[QuoteCache] EXPIRED - Key: ${key.substring(0, 50)}... (age: ${age}ms)`);
      return null;
    }

    // Cache hit!
    cached.hitCount++;
    this.stats.hits++;
    this.updateHitRate();

    console.log(`[QuoteCache] HIT - Key: ${key.substring(0, 50)}... (age: ${age}ms, hits: ${cached.hitCount})`);

    return cached.data;
  }

  /**
   * Store quote in cache
   */
  set(params: any, data: any): void {
    const key = this.generateKey(params);

    // Enforce size limit
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      hitCount: 0,
    });

    this.stats.cacheSize = this.cache.size;

    console.log(`[QuoteCache] STORED - Key: ${key.substring(0, 50)}... (size: ${this.cache.size})`);
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, value] of this.cache.entries()) {
      // Use maximum TTL for cleanup
      if (now - value.timestamp > Math.max(this.DEFAULT_TTL, this.CITREA_TTL)) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[QuoteCache] Cleanup removed ${removed} expired entries`);
    }

    this.stats.cacheSize = this.cache.size;
  }

  /**
   * Evict oldest entry (LRU)
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, value] of this.cache.entries()) {
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      console.log(`[QuoteCache] Evicted oldest entry: ${oldestKey.substring(0, 50)}...`);
    }
  }

  /**
   * Update hit rate statistics
   */
  private updateHitRate(): void {
    if (this.stats.totalRequests > 0) {
      this.stats.avgHitRate = (this.stats.hits / this.stats.totalRequests) * 100;
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.stats.cacheSize = 0;
    console.log('[QuoteCache] Cache cleared');
  }

  /**
   * Check if we should cache this quote
   * Some quotes shouldn't be cached (e.g., large trades, special addresses)
   */
  shouldCache(params: any, response: any): boolean {
    // Don't cache failed quotes
    if (!response || response.error || response.state === 'NOT_FOUND') {
      return false;
    }

    // Always cache Citrea quotes (campaign optimization)
    if (this.isCitreaQuote(params)) {
      return true;
    }

    // Don't cache very large trades (> 100 ETH equivalent)
    const amount = parseFloat(params.amount || '0');
    const isLargeTrade = amount > 100e18; // Rough estimate
    if (isLargeTrade) {
      return false;
    }

    return true;
  }
}

// Singleton instance
export const quoteCache = new QuoteCache();