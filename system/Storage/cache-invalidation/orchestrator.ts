import { logger } from '@/lib/utils/logger';
import { CascadeManager } from './cascade-manager';
import { ConditionalFilter } from './conditional-filter';
import { DeferredQueue } from './deferred-queue';
import { lruEvictionManager } from './lru-eviction';
import { TransactionCoordinator } from './transaction-coordinator';

/**
 * Centralized validation error wrapper.
 * Standardizes parameter validation failures with consistent logging.
 */
export class CacheInvalidationError extends Error {
  constructor(
    public readonly code: 'INVALID_PARAMS' | 'EXECUTION_FAILED' | 'VALIDATION_FAILED',
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CacheInvalidationError';
  }
}

/**
 * Orchestrator for cache invalidation systems.
 * Consolidates validation, error handling, and coordination across all 5 managers:
 * - Cascade invalidations (parent → child)
 * - Conditional invalidations (predicate-based filtering)
 * - Transactional invalidations (atomic with rollback)
 * - Deferred invalidations (scheduled with debouncing)
 * - LRU eviction (capacity management)
 *
 * DESIGN: Validation/error handling moved HERE; managers remain clean and focused.
 * Each method validates inputs once, logs consistently, and delegates to managers.
 */
export class CacheInvalidationOrchestrator {
  /**
   * Initialize all sub-systems.
   * Called during kernel bootstrap to prepare cache-invalidation layer.
   *
   * @param config - System configuration with cacheCapacity settings
   */
  initialize(config?: { cacheCapacity?: { hardMaxBytes?: number; softThreshold?: number; targetAfterEviction?: number } }): void {
    try {
      const cacheCapacity = config?.cacheCapacity;
      if (!cacheCapacity || !cacheCapacity.hardMaxBytes) {
        return; // No config or incomplete config provided, skip initialization
      }

      const lruConfig = {
        hardMaxBytes: cacheCapacity.hardMaxBytes,
        softThreshold: cacheCapacity.softThreshold ?? 0.85, // 85% of hard limit default
        targetAfterEviction: cacheCapacity.targetAfterEviction ?? 0.7, // Drop to 70% after eviction (default)
      };
      lruEvictionManager.initialize(lruConfig);
      logger.category('storage').debug('Cache invalidation orchestrator initialized');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.category('storage').error('Failed to initialize cache invalidation orchestrator', {
        error: err.message,
      });
      throw new CacheInvalidationError('EXECUTION_FAILED', 'Orchestrator initialization failed', {
        error: err.message,
      });
    }
  }

  /**
   * Register a cascade dependency pattern.
   * When parentPattern is invalidated, all childPatterns are automatically invalidated.
   *
   * @param parentPattern - Parent cache key pattern (glob supported: `world:*`)
   * @param childPatterns - Child patterns to cascade when parent is invalidated
   * @throws CacheInvalidationError if validation fails or circular dependency detected
   */
  registerCascade(parentPattern: string, childPatterns: string[]): void {
    // Validate inputs
    if (!this.isValidPattern(parentPattern)) {
      throw new CacheInvalidationError('INVALID_PARAMS', 'Invalid parent pattern', {
        parentPattern,
        reason: 'Must be non-empty string',
      });
    }

    if (!Array.isArray(childPatterns) || childPatterns.length === 0) {
      throw new CacheInvalidationError('INVALID_PARAMS', 'Child patterns must be non-empty array', {
        childPatterns,
      });
    }

    if (!childPatterns.every((p) => this.isValidPattern(p))) {
      throw new CacheInvalidationError('INVALID_PARAMS', 'Invalid child pattern in array', {
        childPatterns,
        reason: 'All patterns must be non-empty strings',
      });
    }

    // Delegate to manager (no validation needed there)
    try {
      CascadeManager.registerCascade(parentPattern, childPatterns);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new CacheInvalidationError('EXECUTION_FAILED', `Failed to register cascade: ${err.message}`, {
        parentPattern,
        childPatterns,
        error: err.message,
      });
    }
  }

  /**
   * Get cascade dependencies for a key.
   * Returns all child patterns that should be invalidated when this key is invalidated.
   *
   * @param key - Cache key to look up dependencies for
   * @returns Array of child patterns
   */
  getCascadeDependencies(key: string): string[] {
    if (!this.isValidPattern(key)) {
      logger.category('storage').warn('getCascadeDependencies called with invalid key', { key });
      return [];
    }

    return CascadeManager.getCascadeDependencies(key);
  }

  /**
   * Get all registered cascades (for debugging/monitoring).
   * @returns Array of all cascade mappings
   */
  getAllCascades() {
    return CascadeManager.getAllCascades();
  }

  /**
   * Reset all cascades.
   */
  resetCascades(): void {
    CascadeManager.reset();
  }

  /**
   * Conditionally invalidate cache entries matching a pattern and predicate.
   *
   * @param pattern - Glob pattern to filter keys (e.g., `world:*`)
   * @param predicate - Function(key, entry) → boolean; true to invalidate
   * @param getCacheStats - Callback to retrieve current cache stats
   * @param invalidate - Callback to execute actual invalidations
   * @returns Promise resolving to invalidation result
   * @throws CacheInvalidationError if validation fails
   */
  async invalidateIfMatches(
    pattern: string,
    predicate: (key: string, entry: unknown) => boolean,
    getCacheStats: () => { entries: { key: string }[] },
    invalidate: (keys: string[]) => Promise<{ invalidatedCount: number; errors: { key: string; error: Error }[] }>
  ) {
    // Validate inputs
    if (!this.isValidPattern(pattern)) {
      throw new CacheInvalidationError('INVALID_PARAMS', 'Invalid pattern', { pattern });
    }

    if (typeof predicate !== 'function') {
      throw new CacheInvalidationError('INVALID_PARAMS', 'Predicate must be a function', {
        predicateType: typeof predicate,
      });
    }

    if (typeof getCacheStats !== 'function') {
      throw new CacheInvalidationError('INVALID_PARAMS', 'getCacheStats must be a function', {
        getCacheStatsType: typeof getCacheStats,
      });
    }

    if (typeof invalidate !== 'function') {
      throw new CacheInvalidationError('INVALID_PARAMS', 'Invalidate callback must be a function', {
        invalidateType: typeof invalidate,
      });
    }

    try {
      return await ConditionalFilter.invalidateIfMatches(pattern, predicate, getCacheStats, invalidate);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new CacheInvalidationError('EXECUTION_FAILED', `Conditional invalidation failed: ${err.message}`, {
        pattern,
        error: err.message,
      });
    }
  }

  /**
   * Execute a transactional cache invalidation with atomic rollback semantics.
   * Either all queued invalidations succeed, or cache is restored to pre-transaction state.
   *
   * @param operation - Async function(tx) that queues invalidations via tx.invalidate(key)
   * @param config - Configuration with snapshot provider, executor, restorer
   * @returns Promise resolving to transaction result
   * @throws CacheInvalidationError if validation fails
   */
  async transaction(
    operation: (tx: {
      invalidate: (key: string) => void;
      invalidateMany: (keys: string[]) => void;
      getQueuedInvalidations: () => string[];
      isQueued: (key: string) => boolean;
    }) => Promise<void>,
    config: {
      getSnapshot: () => { entries: Map<string, unknown>; size: number; timestamp: number };
      executeInvalidations: (keys: string[]) => Promise<{ invalidatedCount: number; errors: { key: string; error: Error }[] }>;
      restoreSnapshot: (snapshot: { entries: Map<string, unknown>; size: number; timestamp: number }) => Promise<void>;
    }
  ) {
    // Validate inputs
    if (typeof operation !== 'function') {
      throw new CacheInvalidationError('INVALID_PARAMS', 'Operation must be a function', {
        operationType: typeof operation,
      });
    }

    if (!config || typeof config.getSnapshot !== 'function' || typeof config.executeInvalidations !== 'function' || typeof config.restoreSnapshot !== 'function') {
      throw new CacheInvalidationError('INVALID_PARAMS', 'Invalid transaction config', {
        hasConfig: !!config,
        hasGetSnapshot: config?.getSnapshot ? typeof config.getSnapshot : 'undefined',
        hasExecuteInvalidations: config?.executeInvalidations ? typeof config.executeInvalidations : 'undefined',
        hasRestoreSnapshot: config?.restoreSnapshot ? typeof config.restoreSnapshot : 'undefined',
      });
    }

    try {
      return await TransactionCoordinator.transaction(operation, config);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new CacheInvalidationError('EXECUTION_FAILED', `Transaction failed: ${err.message}`, {
        error: err.message,
      });
    }
  }

  /**
   * Schedule a deferred (delayed) invalidation.
   * Useful for debouncing rapid cache update patterns (e.g., user typing).
   *
   * @param delayMs - Milliseconds to delay before execution
   * @param patterns - Cache key patterns to invalidate
   * @param executor - Callback to execute invalidations after delay
   * @returns Deferred schedule result with cancel function
   * @throws CacheInvalidationError if validation fails
   */
  invalidateAfter(
    delayMs: number,
    patterns: string[],
    executor: (patterns: string[]) => Promise<{ invalidatedCount: number; errors: { pattern: string; error: Error }[] }>
  ) {
    // Validate inputs
    if (typeof delayMs !== 'number' || delayMs < 0) {
      throw new CacheInvalidationError('INVALID_PARAMS', 'Delay must be non-negative number', {
        delayMs,
      });
    }

    if (!Array.isArray(patterns) || patterns.length === 0) {
      throw new CacheInvalidationError('INVALID_PARAMS', 'Patterns must be non-empty array', {
        patterns,
      });
    }

    if (!patterns.every((p) => this.isValidPattern(p))) {
      throw new CacheInvalidationError('INVALID_PARAMS', 'Invalid pattern in array', {
        patterns,
        reason: 'All patterns must be non-empty strings',
      });
    }

    if (typeof executor !== 'function') {
      throw new CacheInvalidationError('INVALID_PARAMS', 'Executor must be a function', {
        executorType: typeof executor,
      });
    }

    try {
      return DeferredQueue.invalidateAfter(delayMs, patterns, executor);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new CacheInvalidationError('EXECUTION_FAILED', `Failed to schedule deferred invalidation: ${err.message}`, {
        delayMs,
        patterns,
        error: err.message,
      });
    }
  }

  /**
   * Cancel a scheduled deferred invalidation by ID.
   *
   * @param id - Deferred schedule ID to cancel
   * @returns True if cancelled, false if already executed or not found
   */
  cancelDeferred(id: string): boolean {
    if (!this.isValidPattern(id)) {
      logger.category('storage').warn('Invalid deferred ID for cancellation', { id });
      return false;
    }

    return DeferredQueue.cancel(id);
  }

  /**
   * Get all pending deferred invalidations.
   * Useful for debugging and testing.
   *
   * @returns Array of pending deferred entries
   */
  getPendingDeferred() {
    return DeferredQueue.getPending();
  }

  /**
   * Clear all pending deferred invalidations.
   */
  clearPendingDeferred(): void {
    DeferredQueue.cancelAll();
  }

  /**
   * Track a cache entry in LRU eviction system.
   *
   * @param key - Cache key
   * @param sizeBytes - Size of entry in bytes
   */
  trackEntry(key: string, sizeBytes: number): void {
    if (!this.isValidPattern(key)) {
      throw new CacheInvalidationError('INVALID_PARAMS', 'Invalid cache key', { key });
    }

    if (typeof sizeBytes !== 'number' || sizeBytes <= 0) {
      throw new CacheInvalidationError('INVALID_PARAMS', 'Size must be positive number', { sizeBytes });
    }

    lruEvictionManager.trackEntry(key, sizeBytes);
  }

  /**
   * Untrack a cache entry from LRU eviction system.
   *
   * @param key - Cache key to untrack
   */
  untrackEntry(key: string): void {
    if (!this.isValidPattern(key)) {
      logger.category('storage').warn('Invalid cache key for untrack', { key });
      return;
    }

    lruEvictionManager.untrackEntry(key);
  }

  /**
   * Get LRU eviction statistics (for debugging/monitoring).
   *
   * @returns Current LRU tracking stats
   */
  getLRUStats() {
    return lruEvictionManager.getStats();
  }

  /**
   * Get LRU capacity statistics.
   * @returns Capacity info (total size, hard limit, soft limit, approaching capacity)
   */
  getLRUCapacityStats() {
    return lruEvictionManager.getCapacityStats();
  }

  /**
   * Check if LRU is approaching capacity limit.
   * @returns True if totalSize >= soft limit
   */
  isApproachingCapacity(): boolean {
    return lruEvictionManager.isApproachingCapacity();
  }

  /**
   * Check if LRU has exceeded hard limit.
   * @returns True if totalSize > hard limit (should trigger emergency cleanup)
   */
  isExceededHardLimit(): boolean {
    return lruEvictionManager.isExceededHardLimit();
  }

  /**
   * Clear all LRU tracking data.
   * Used during cache reset or system cleanup.
   */
  clearLRU(): void {
    lruEvictionManager.clear();
  }

  /**
   * Reset all cache invalidation systems to clean state.
   * Clears cascades, pending deferred ops, and LRU tracking.
   * Use sparingly (typically during full cache reset).
   */
  resetAll(): void {
    try {
      CascadeManager.reset();
      DeferredQueue.cancelAll();
      lruEvictionManager.clear();
      logger.category('storage').debug('All cache invalidation systems reset');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.category('storage').error('Failed to reset cache invalidation systems', {
        error: err.message,
      });
      throw new CacheInvalidationError('EXECUTION_FAILED', 'Failed to reset systems', {
        error: err.message,
      });
    }
  }

  /**
   * Validate that a pattern string is well-formed.
   * @private
   */
  private isValidPattern(pattern: string): boolean {
    return typeof pattern === 'string' && pattern.length > 0;
  }
}

/**
 * Global singleton instance of the cache invalidation orchestrator.
 * All cache invalidation operations should use this instance.
 */
export const cacheInvalidationOrchestrator = new CacheInvalidationOrchestrator();
