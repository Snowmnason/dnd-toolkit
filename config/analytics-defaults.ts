/**
 * Analytics Defaults
 *
 * Shared tunable values used across the analytics module:
 * - breadcrumb-queue.ts  (ANALYTICS_RETRY_DEFAULTS)
 * - consent-sync-queue.ts (CONSENT_SYNC_DEFAULTS)
 *
 * ANALYTICS_RETRY_DEFAULTS: shared retry/flush behaviour for the breadcrumb queue.
 * CONSENT_SYNC_DEFAULTS: more conservative settings for consent sync (fewer retries, longer delays).
 */

/** Shared retry and flush defaults for breadcrumb-queue */
export const ANALYTICS_RETRY_DEFAULTS = {
  /** Max retry attempts before discarding an event/breadcrumb */
  maxRetries: 5,
  /** Base delay (ms) for exponential backoff */
  retryBaseMs: 1_000,
  /** Flush debounce — hold off flushing until this many ms of quiet */
  debounceMs: 5_000,
} as const;

/** Conservative retry defaults for consent sync (user-facing, fewer retries) */
export const CONSENT_SYNC_DEFAULTS = {
  /** Max retry attempts before dropping a consent sync item */
  maxRetries: 3,
  /** Base delay (ms) for exponential backoff */
  baseRetryDelayMs: 2_000,
  /** Maximum delay cap (ms) — prevents indefinite waits */
  maxRetryDelayMs: 30_000,
} as const;
