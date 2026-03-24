import { logger } from '@/lib/utils/logger';

/**
 * Represents the result of a conditional invalidation operation.
 */
export interface ConditionalInvalidationResult {
  invalidatedCount: number;
  scannedCount: number;
  errors: { key: string; error: Error }[];
}

/**
 * Predicate function for conditional cache invalidation.
 * Receives the cache key and entry data (as stored).
 * Return true to invalidate, false to keep.
 */
export type ConditionalPredicate = (key: string, entry: unknown) => boolean;

/**
 * Callback for delegating actual invalidation to middleware/cache layer.
 */
export type InvalidationDelegate = (keys: string[]) => Promise<{ invalidatedCount: number; errors: { key: string; error: Error }[] }>;

/**
 * Manages conditional (predicate-based) cache invalidation.
 * Provides filtering logic; delegates actual cache operations to middleware via callback.
 */
class ConditionalFilterImpl {
  /**
   * Filter cache entries and collect keys to invalidate.
   * This method is stateless - it only determines which keys match the criteria.
   * Actual invalidation is delegated to the provided callback (middleware layer).
   *
   * @param pattern - Glob pattern to filter keys (e.g., `world:*`, `members:world:*`)
   * @param predicate - Function that receives (key, entry) and returns true to invalidate
   * @param getCacheStats - Callback to retrieve current cache stats
   * @param invalidate - Callback to delegate actual invalidation to middleware
   * @returns Result with counts of scanned/invalidated entries and any errors
   */
  async invalidateIfMatches(
    pattern: string,
    predicate: ConditionalPredicate,
    getCacheStats: () => { entries: { key: string; entry: unknown }[] },
    invalidate: InvalidationDelegate
  ): Promise<ConditionalInvalidationResult> {
    const result: ConditionalInvalidationResult = {
      invalidatedCount: 0,
      scannedCount: 0,
      errors: [],
    };

    try {
      // Get cache stats (caller provides this; we don't directly access cache)
      const stats = getCacheStats();
      if (!stats || !stats.entries || stats.entries.length === 0) {
        logger.category('storage').debug('No cache entries to scan');
        return result;
      }

      // Collect keys matching pattern AND predicate
      const keysToInvalidate: string[] = [];

      for (const entry of stats.entries) {
        const key = entry.key;
        result.scannedCount++;

        // Check if key matches pattern
        if (!this.matchesPattern(key, pattern)) {
          continue;
        }

        // Apply predicate to entry — pass the real cache entry data
        try {
          const shouldInvalidate = predicate(key, entry.entry);

          if (shouldInvalidate) {
            keysToInvalidate.push(key);
          }
        } catch (predicateError) {
          const error = predicateError instanceof Error ? predicateError : new Error(String(predicateError));
          result.errors.push({ key, error });
          logger.category('storage').warn('Predicate error during conditional invalidation', {
            key,
            error: error.message,
          });
        }
      }

      // Delegate actual invalidation to middleware (caller responsibility)
      if (keysToInvalidate.length > 0) {
        const invalidationResult = await invalidate(keysToInvalidate);
        result.invalidatedCount = invalidationResult.invalidatedCount;
        result.errors.push(...invalidationResult.errors);
      }

      // Log result
      logger.category('storage').debug('Conditional invalidation complete', {
        pattern,
        scannedCount: result.scannedCount,
        invalidatedCount: result.invalidatedCount,
        errorCount: result.errors.length,
      });

      // Warn if we scanned a lot (performance concern)
      if (result.scannedCount > 1000) {
        logger.category('storage').warn('Conditional invalidation scanned many entries', {
          pattern,
          scannedCount: result.scannedCount,
          advice: 'Consider using more specific patterns to reduce scan overhead',
        });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.category('storage').error('Fatal error in conditional invalidation', {
        pattern,
        error: err.message,
      });
      result.errors.push({ key: '[system]', error: err });
    }

    return result;
  }

  /**
   * Test if a cache key matches a given pattern.
   * Supports glob patterns: `*` matches any characters, literals match exactly.
   * @private
   */
  private matchesPattern(key: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
      .replace(/\*/g, '.*'); // Convert * to .* for glob matching

    // eslint-disable-next-line security/detect-non-literal-regexp
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(key);
  }
}

/**
 * Singleton instance of the conditional filter.
 */
export const ConditionalFilter = new ConditionalFilterImpl();
