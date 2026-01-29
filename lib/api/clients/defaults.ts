/**
 * Default cache timing for API clients
 *
 * Stale time: How long before data is considered "stale" and should be refreshed
 * Cache time: How long to keep data in memory before discarding
 *
 * Strategy:
 * - User data: Shorter stale time (5 min) since profiles change frequently
 * - World/campaign data: Medium stale time (10 min) for less-frequently-changing data
 * - Longer cache times (30-60 min) to reduce redundant requests
 */

export const CACHE_DEFAULTS = {
  /** User profile and account data (5 min stale, 30 min cache) */
  user: {
    staleTime: 5 * 60 * 1000,
    cacheTime: 30 * 60 * 1000,
  },

  /** World and campaign data (10 min stale, 1 hour cache) */
  world: {
    staleTime: 10 * 60 * 1000,
    cacheTime: 60 * 60 * 1000,
  },

  /** Static/reference data (30 min stale, 2 hour cache) */
  reference: {
    staleTime: 30 * 60 * 1000,
    cacheTime: 2 * 60 * 60 * 1000,
  },
};

export default CACHE_DEFAULTS;
