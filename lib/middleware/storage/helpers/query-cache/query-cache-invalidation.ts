import { logger } from "@/lib/utils";
import type {
    CacheEntry,
    InvalidateOptions,
} from "@/type-definitions";
import { escapeRegexChars, type QueryCacheInternals } from "./internals";

/**
 * Invalidation operations.
 *
 * All invalidation methods bump globalVersion (to reject in-flight stale writes)
 * and remove matching entries via the shared internals.
 */

/** Get the current global version number */
export function cacheGetCurrentVersion(ctx: QueryCacheInternals): number {
  return ctx.globalVersion;
}

/** Invalidate entries by tags */
export async function cacheInvalidateByTags(
  ctx: QueryCacheInternals,
  tags: string[],
  options?: InvalidateOptions,
): Promise<void> {
  try {
    ctx.globalVersion++;

    const keys = ctx.findMatchingKeys(
      (_key, entry) => !!entry.tags && entry.tags.some((tag) => tags.includes(tag)),
    );

    await ctx.removeEntries(keys);

    logger.category('storage').info(
      `Invalidated ${keys.length} entries by tags`,
      {
        tags,
        strategy: options?.strategy || 'immediate',
        newVersion: ctx.globalVersion,
      },
    );
  } catch (error) {
    logger.category('storage').error("Error invalidating by tags:", error);
  }
}

/** Invalidate entries by pattern (regex or string) */
export async function cacheInvalidate(
  ctx: QueryCacheInternals,
  pattern: string | RegExp,
  options?: InvalidateOptions,
): Promise<void> {
  try {
    ctx.globalVersion++;

    let regex: RegExp;
    if (typeof pattern === "string") {
      const escapedPattern = escapeRegexChars(pattern);
      /* eslint-disable-next-line security/detect-non-literal-regexp */
      regex = new RegExp(`^${escapedPattern}`);
    } else {
      regex = pattern;
    }

    const keys = ctx.findMatchingKeys((key) => regex.test(key));

    await ctx.removeEntries(keys);

    logger.category('storage').info(
      `Invalidated ${keys.length} entries by pattern`,
      {
        pattern: pattern.toString(),
        strategy: options?.strategy || 'immediate',
        newVersion: ctx.globalVersion,
      },
    );
  } catch (error) {
    logger.category('storage').error("Error invalidating by pattern:", error);
  }
}

/** Invalidate entries older than a given duration */
export async function cacheInvalidateOlderThan(
  ctx: QueryCacheInternals,
  maxAgeMs: number,
): Promise<number> {
  try {
    ctx.globalVersion++;

    const now = Date.now();
    const keys = ctx.findMatchingKeys(
      (_key, entry) => (now - entry.timestamp) > maxAgeMs,
    );

    await ctx.removeEntries(keys);

    logger.category('storage').info(
      `Invalidated ${keys.length} entries older than ${maxAgeMs}ms`,
      {
        maxAgeMs,
        newVersion: ctx.globalVersion,
      },
    );

    return keys.length;
  } catch (error) {
    logger.category('storage').error("Error invalidating old entries:", error);
    return 0;
  }
}

/**
 * Invalidate entries matching a predicate function.
 *
 * Version bump only happens AFTER successful removal (unlike the other
 * invalidation methods that bump first). This keeps the version consistent
 * when the predicate throws or removal fails.
 */
export async function cacheSelectiveInvalidate(
  ctx: QueryCacheInternals,
  predicate: (key: string, entry: CacheEntry) => boolean,
  options?: InvalidateOptions,
): Promise<number> {
  try {
    const keys = ctx.findMatchingKeys(predicate);

    if (keys.length === 0) {
      logger.category('storage').debug('selectiveInvalidate: No entries matched predicate');
      return 0;
    }

    await ctx.removeEntries(keys);

    // Only bump version AFTER successful removal
    ctx.globalVersion++;

    logger.category('storage').info(
      `Invalidated ${keys.length} entries by predicate (v${ctx.globalVersion})`,
      {
        count: keys.length,
        strategy: options?.strategy || 'immediate',
        newVersion: ctx.globalVersion,
      },
    );

    return keys.length;
  } catch (error) {
    logger.category('storage').error(
      'Error invalidating by predicate (version NOT bumped):',
      error,
    );
    return 0;
  }
}
