import { logger } from "@/lib/utils";
import type { CacheEntry } from "@/type-definitions";
import type { QueryCacheInternals } from "./internals";

/**
 * Persistence-level operations.
 *
 * Handles resolving persistence levels from config patterns,
 * and clearing entries by level or predicate.
 */

// ==========================================
// Persistence Level Resolution
// ==========================================

/**
 * Resolve persistence level for a cache key using pattern matching.
 *
 * Rules:
 * - First matching pattern wins (config order matters)
 * - Wildcard patterns supported (e.g., 'worlds:*')
 * - No match → defaults to 'persist' (conservative)
 */
export function resolvePersistenceLevel(
  ctx: QueryCacheInternals,
  key: string,
): 'persist' | 'volatile' {
  const map = ctx.config.persistenceLevelMap;
  if (!map) return 'persist';

  // Use Object.entries to avoid object injection sink warnings
  for (const [pattern, level] of Object.entries(map)) {
    // Belt-and-suspenders: skip any entry whose value isn't a known persistence
    // literal. The map was already sanitized at load time in loadQueryCacheConfig(),
    // but a guard here protects against direct construction paths in tests/mocks.
    if (level !== 'persist' && level !== 'volatile') {
      logger.category('storage').debug(
        `[resolvePersistenceLevel] Skipping entry with invalid level: pattern="${pattern}" level="${String(level)}"`,
      );
      continue;
    }

    // Convert glob-style pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')        // Escape dots
      .replace(/\*/g, '[^:]*');     // * matches non-colon chars (within segment)

    /* eslint-disable-next-line security/detect-non-literal-regexp */
    const regex = new RegExp(`^${regexPattern}$`);
    if (regex.test(key)) {
      return level;
    }
  }

  return 'persist';
}

// ==========================================
// Clear by Persistence Level
// ==========================================

/**
 * Clear all entries with a specific persistence level.
 *
 * @returns Number of entries cleared
 */
export async function cacheClearByPersistenceLevel(
  ctx: QueryCacheInternals,
  level: 'persist' | 'volatile',
): Promise<number> {
  try {
    const keys = ctx.findMatchingKeys(
      (_key, entry) => (entry.persistenceLevel ?? 'persist') === level,
    );

    await ctx.removeEntries(keys);

    logger.category('storage').info(
      `Cleared ${keys.length} entries with persistence level: ${level}`,
    );

    return keys.length;
  } catch (error) {
    logger.category('storage').error('Error clearing entries by persistence level:', error);
    return 0;
  }
}

/**
 * Clear entries matching a persistence predicate.
 *
 * @returns Number of entries cleared
 */
export async function cacheClearByPersistence(
  ctx: QueryCacheInternals,
  predicate: (entry: CacheEntry) => boolean,
): Promise<number> {
  try {
    const keys = ctx.findMatchingKeys(
      (_key, entry) => predicate(entry),
    );

    if (keys.length === 0) {
      logger.category('storage').debug('clearByPersistence: No entries matched predicate');
      return 0;
    }

    await ctx.removeEntries(keys);

    logger.category('storage').info(
      `Cleared ${keys.length} entries by persistence predicate`,
    );

    return keys.length;
  } catch (error) {
    logger.category('storage').error('Error clearing by persistence predicate:', error);
    return 0;
  }
}

/**
 * Clear entries matching a regex pattern, optionally filtered by persistence level.
 *
 * @returns Number of entries cleared
 */
export async function cacheClearByPattern(
  ctx: QueryCacheInternals,
  pattern: RegExp,
  persistenceLevel?: 'persist' | 'volatile',
): Promise<number> {
  try {
    const keys = ctx.findMatchingKeys((key, entry) => {
      if (!pattern.test(key)) return false;
      if (persistenceLevel) {
        const entryLevel = entry.persistenceLevel ?? 'persist';
        if (entryLevel !== persistenceLevel) return false;
      }
      return true;
    });

    if (keys.length === 0) {
      logger.category('storage').debug('clearByPattern: No entries matched pattern');
      return 0;
    }

    await ctx.removeEntries(keys);

    logger.category('storage').info(
      `Cleared ${keys.length} entries matching pattern`,
      {
        pattern: pattern.toString(),
        persistenceLevel: persistenceLevel || 'any',
      },
    );

    return keys.length;
  } catch (error) {
    logger.category('storage').error('Error clearing by pattern:', error);
    return 0;
  }
}
