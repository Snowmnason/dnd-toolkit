/**
 * LRU Cache for Feature Flag Evaluation Results
 *
 * Caches `isEnabledWithContext` results per (flag, context) signature to avoid
 * redundant evaluation and improve performance on repeated checks.
 *
 * Features:
 * - LRU eviction policy (max 256 entries by default)
 * - TTL support (entries expire after 1 hour by default)
 * - In-memory only (no persistence to SecureStorage in this cache)
 * - Per-call memoization is separate and orthogonal
 *
 * **When entries expire:**
 * - Check: `currentTime > entryTime + TTL`
 * - Expired entries are not returned and removed on next `get()`
 * - TTL defaults to 1 hour but is configurable per instance
 *
 * **Size limits:**
 * - Max 256 entries by default (configurable)
 * - When limit exceeded, least recently used entry is evicted
 * - This prevents unbounded memory growth
 */

export interface CacheEntry<T> {
  value: T;
  timestamp: number; // Time entry was cached
}

export interface CacheConfig {
  maxSize?: number; // Maximum number of entries (default: 256)
  ttlMs?: number; // Time-to-live in milliseconds (default: 1 hour)
}

export interface CacheStats {
  size: number;
  maxSize: number;
  loadFactor: number;
  ttlMs: number;
  hits?: number;
  misses?: number;
  hitRate?: number;
}

/**
 * Lightweight LRU Cache for feature flag evaluation results
 */
export class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private accessOrder: string[] = []; // Track access order for LRU eviction
  private readonly maxSize: number;
  private readonly ttlMs: number;
  private hits = 0;
  private misses = 0;

  constructor(config: CacheConfig = {}) {
    this.maxSize = config.maxSize ?? 256;
    this.ttlMs = config.ttlMs ?? 60 * 60 * 1000; // 1 hour default
  }

  /**
   * Get a value from cache if it exists and hasn't expired
   * Updates LRU order on hit
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return undefined;
    }

    // Check if entry has expired
    if (Date.now() > entry.timestamp + this.ttlMs) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.misses++;
      return undefined;
    }

    // Hit: update LRU order and track hit
    this.hits++;
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);

    return entry.value;
  }

  /**
   * Set a value in cache
   * Evicts LRU entry if cache is full
   */
  set(key: string, value: T): void {
    // If key already exists, remove it from cache
    if (this.cache.has(key)) {
      this.removeFromAccessOrder(key);
    }

    // If cache is full, evict least recently used
    if (
      this.cache.size >= this.maxSize &&
      !this.cache.has(key) // Don't evict if updating existing key
    ) {
      const lruKey = this.accessOrder.shift(); // Remove oldest
      if (lruKey) {
        this.cache.delete(lruKey);
      }
    }

    // Add new entry
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });
    this.accessOrder.push(key);
  }

  /**
   * Remove a specific key from cache
   */
  delete(key: string): boolean {
    const existed = this.cache.delete(key);
    this.removeFromAccessOrder(key);
    return existed;
  }

  /**
   * Clear all entries from cache
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Remove expired entries from cache
   * Useful for periodic cleanup
   */
  evictExpired(): number {
    const now = Date.now();
    let evicted = 0;

    const keysToDelete: string[] = [];
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + this.ttlMs) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.delete(key);
      evicted++;
    }

    return evicted;
  }

  /**
   * Get cache statistics for monitoring
   */
  getStats(): CacheStats {
    const totalRequests = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      loadFactor: this.cache.size / this.maxSize,
      ttlMs: this.ttlMs,
      hits: this.hits,
      misses: this.misses,
      hitRate: totalRequests > 0 ? this.hits / totalRequests : 0,
    };
  }

  /**
   * Get all keys in cache (for testing/debugging)
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Helper to remove key from access order list
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }
}

/**
 * Specialized cache for feature flag evaluation results
 * Keyed by (flag, context) signature
 */
export class FlagEvaluationCache extends LRUCache<boolean> {
  constructor(config: CacheConfig = {}) {
    // Feature flag caches typically have high hit rates and fast context signatures
    // Default: 256 entries, 1 hour TTL
    super(config);
  }

  /**
   * Create cache key from flag name and context signature
   *
   * Context signature format: "flag::platform::environment::role"
   * Example: "advancedMaps::web::production::admin"
   */
  static makeKey(
    flagName: string,
    platform: string,
    environment: string,
    userRole: string | undefined,
  ): string {
    return `${flagName}::${platform}::${environment}::${userRole ?? "unknown"}`;
  }

  /**
   * Get cached result for a flag evaluation
   */
  getResult(
    flagName: string,
    platform: string,
    environment: string,
    userRole: string | undefined,
  ): boolean | undefined {
    const key = FlagEvaluationCache.makeKey(
      flagName,
      platform,
      environment,
      userRole,
    );
    return this.get(key);
  }

  /**
   * Cache result of a flag evaluation
   */
  setResult(
    flagName: string,
    platform: string,
    environment: string,
    userRole: string | undefined,
    result: boolean,
  ): void {
    const key = FlagEvaluationCache.makeKey(
      flagName,
      platform,
      environment,
      userRole,
    );
    this.set(key, result);
  }

  /**
   * Invalidate cache for a specific flag (when flag definition changes)
   */
  invalidateFlag(flagName: string): number {
    let invalidated = 0;
    const keysToDelete: string[] = [];

    for (const key of this.keys()) {
      if (key.startsWith(`${flagName}::`)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.delete(key);
      invalidated++;
    }

    return invalidated;
  }

  /**
   * Invalidate cache for a specific user role (when role changes)
   * Handles both string roles and undefined role (which is stored as "unknown")
   */
  invalidateRole(userRole: string | undefined): number {
    let invalidated = 0;
    const keysToDelete: string[] = [];

    // Normalize undefined to "unknown" to match how makeKey works
    const normalizedRole = userRole ?? "unknown";
    const roleSignature = `::${normalizedRole}`;

    for (const key of this.keys()) {
      if (key.endsWith(roleSignature)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.delete(key);
      invalidated++;
    }

    return invalidated;
  }
}
