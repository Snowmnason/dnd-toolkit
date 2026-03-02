/**
 * Offline Sync Defaults
 *
 * Shared tunable values used across the offline module:
 * - mutation-queue.ts (batch size, retries, debounce)
 * - sync-manager.ts   (same, plus conflict strategy)
 * - offline-recovery.ts (base backoff, backoff cap)
 *
 * Change here to tune all offline sync behaviour at once.
 */

export const OFFLINE_SYNC_DEFAULTS = {
  /** Max mutations to process per sync batch */
  batchSize: 5,
  /** Ms to wait after coming online before flushing (debounce rapid reconnects) */
  debounceMs: 5_000,
  /** Max retry attempts before dead-lettering a mutation */
  maxRetries: 5,
  /** Base delay (ms) for exponential backoff */
  retryBaseMs: 2_000,
  /** Conflict resolution strategy when server and client diverge */
  conflictStrategy: "client_wins" as const,
  /** Max backoff delay cap — prevents indefinite waits (5 minutes) */
  backoffCapMs: 300_000,
} as const;
