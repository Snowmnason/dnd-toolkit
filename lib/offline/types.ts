/**
 * Offline Mutation Queue Types
 *
 * Defines the structure of mutations queued while offline, conflict resolution,
 * and sync status tracking.
 */

/**
 * Type of mutation operation
 */
export type MutationOperation = "create" | "update" | "delete";

/**
 * A mutation queued while offline, waiting to sync when online
 *
 * Stored in SecureStorage with key: dnd:offline:mutation_queue
 */
export interface QueuedMutation {
  /** Unique identifier for this queued mutation (UUID) */
  id: string;

  /** Type of operation (create, update, delete) */
  operation: MutationOperation;

  /** Supabase table name (e.g., 'worlds', 'notes', 'characters') */
  table: string;

  /** Mutation payload (data to send to server) */
  payload: Record<string, any>;

  /** Resource owner ID (for client-wins conflict resolution) */
  ownerId?: string;

  /** When this mutation was queued (Date.now()) */
  timestamp: number;

  /** Number of sync attempts made so far */
  retryCount: number;

  /** Server version snapshot (updated_at) at time of queuing */
  serverVersion?: string;

  /** Cache key pattern to invalidate after successful sync */
  cacheKeyPattern?: string;

  /** Tags to invalidate after successful sync */
  invalidateTags?: string[];
}

/**
 * Sync status of a queued mutation
 */
export enum SyncStatus {
  /** Pending sync (waiting for network or batch processing) */
  PENDING = "pending",
  /** Currently syncing */
  SYNCING = "syncing",
  /** Successfully synced */
  SYNCED = "synced",
  /** Sync failed, waiting for retry */
  FAILED = "failed",
  /** Sync failed permanently (requires user action) */
  FAILED_PERMANENT = "failed_permanent",
}

/**
 * Conflict detected between offline mutation and server state
 */
export interface SyncConflict {
  /** ID of the queued mutation that caused conflict */
  mutationId: string;

  /** Type of conflict */
  type: "version_mismatch" | "resource_deleted" | "permission_denied";

  /** Server version at conflict time */
  serverVersion?: string;

  /** Local version that caused conflict */
  localVersion?: string;

  /** Message describing the conflict */
  message: string;

  /** Suggested resolution strategy */
  suggestedStrategy?: "client_wins" | "server_wins" | "user_choose";
}

/**
 * Result of a sync attempt
 */
export interface SyncResult {
  /** ID of the queued mutation that was synced */
  mutationId: string;

  /** Whether sync succeeded */
  success: boolean;

  /** Result data returned from server (if success) */
  data?: Record<string, any>;

  /** Error message (if failed) */
  error?: string;

  /** Conflict info (if conflict detected) */
  conflict?: SyncConflict;

  /** Whether the error is retryable */
  retryable: boolean;
}

/**
 * Overall sync status for UI/logging
 */
export interface OfflineSyncStatus {
  /** Is sync currently in progress */
  isSyncing: boolean;

  /** Total queued mutations */
  totalQueued: number;

  /** Successfully synced in current batch */
  syncedCount: number;

  /** Failed in current batch */
  failedCount: number;

  /** Conflicts that need user attention */
  conflicts: SyncConflict[];

  /** Last sync attempt timestamp */
  lastSyncAttempt?: number;

  /** Error from last sync attempt */
  lastError?: string;
}

/**
 * Configuration for offline sync behavior
 */
export interface OfflineSyncConfig {
  /** Number of mutations to process per batch (default: 5) */
  batchSize?: number;

  /** Debounce time after regaining connectivity before starting sync (default: 5000ms) */
  debounceMs?: number;

  /** Maximum retry attempts per mutation (default: 5) */
  maxRetries?: number;

  /** Base backoff time for exponential retry (default: 2000ms) */
  retryBaseMs?: number;

  /** Conflict resolution strategy (default: 'client_wins' for user-owned resources) */
  conflictStrategy?: "client_wins" | "server_wins" | "user_choose";
}
