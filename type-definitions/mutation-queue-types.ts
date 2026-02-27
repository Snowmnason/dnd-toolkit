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
 * Persistence strategy for offline mutations (Phase 1b: Adaptive Payload Sizing)
 * 
 * - `full`: Store complete payload (all fields, attachments, maps, details)
 * - `reduced`: Strip large fields (attachments, maps, GeoJSON), keep core data
 * - `ephemeral`: Minimal payload (only IDs and timestamps, for quick operations)
 * 
 * Default: `reduced` to respect network conditions and save storage
 */
export type MutationPersistence = "full" | "reduced" | "ephemeral";

/**
 * A mutation queued while offline, waiting to sync when online
 *
 * Stored in SecureStorage with key: dnd:offline:mutation_queue
 *
 * Phase 4 Enhancements:
 * - authStrategy: Ensures replayed requests use fresh tokens from AuthLayer
 * - payload: Redacted (stripped of tokens/PII before storage)
 * - nextAttemptAt: Scheduled retry with backoff + jitter (survives restarts)
 * - lastFailureReason: Per-entry failure tracking for observability
 * 
 * Phase 1b (Adaptive Payloads):
 * - persistence: Strategy for payload reduction based on network quality
 *   - `full`: Complete payload (no reduction)
 *   - `reduced`: Strip attachments, maps, details (default for offline mutations)
 *   - `ephemeral`: Only core fields (IDs, timestamps)
 */
export interface QueuedMutation {
  /** Unique identifier for this queued mutation (UUID) */
  id: string;

  /** Type of operation (create, update, delete) */
  operation: MutationOperation;

  /** Supabase table name (e.g., 'worlds', 'notes', 'characters') */
  table: string;

  /** Mutation payload (data to send to server) - REDACTED (Phase 4) */
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

  /** Auth strategy for replay (Phase 4): ensures fresh token injection */
  authStrategy?: string;

  /** When to attempt next sync (Phase 4): persisted with backoff + jitter */
  nextAttemptAt?: number;

  /** Backoff state for recovery (Phase 4): tracks retry timing */
  backoffState?: {
    /** Base backoff interval (ms) */
    baseMs: number;
    /** Current multiplier (2^retryCount) */
    multiplier: number;
    /** Jitter factor (0.9-1.1) */
    jitter: number;
  };

  /** Last failure reason (Phase 4): for observability and debugging */
  lastFailureReason?: string;

  /** Error type for network/error contract (Phase 4): keep in sync with NetworkErrorContract.type */
  lastErrorType?:
    | "network"
    | "auth"
    | "conflict"
    | "validation"
    | "rate_limit"
    | "server"
    | "unknown";

  /** Persistence strategy for payload reduction (Phase 1b: Adaptive Payloads) */
  persistence?: MutationPersistence;
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
/**
 * Phase 4: Network/Error Contract (standardized error types)
 * Used by _shouldQueueRequest and error handling to classify errors
 */
export interface NetworkErrorContract {
  /** Error classification */
  type:
    | "network"
    | "auth"
    | "conflict"
    | "validation"
    | "rate_limit"
    | "server"
    | "unknown";

  /** HTTP status code if applicable */
  statusCode?: number;

  /** Whether error is retryable */
  retryable: boolean;

  /** Whether to queue for offline replay */
  shouldQueue: boolean;

  /** Suggested backoff (ms) for retries */
  suggestedBackoffMs?: number;

  /** Human-readable error message */
  message: string;
}

/**
 * Phase 4: Failure Statistics for OfflineQueueManager.getStats()
 * Tracks per-entry telemetry for observability
 */
export interface OfflineQueueStats {
  /** Total mutations in queue */
  totalQueued: number;

  /** Mutations that have never failed (retryCount=0 and no lastErrorType) - awaiting first sync */
  pending: number;

  /** Mutations by error type (only counts mutations with retryCount > 0 or lastErrorType set) */
  failuresByType: {
    network: number;
    auth: number;
    conflict: number;
    validation: number;
    rate_limit: number;
    server: number;
    unknown: number;
  };

  /** Oldest queued mutation timestamp */
  oldestMutationAge?: number;

  /** Average retry count */
  avgRetryCount: number;

  /** Mutations scheduled for future retry */
  scheduledForRetry: number;

  /** Last sync attempt result */
  lastSyncResult?: {
    timestamp: number;
    succeeded: number;
    failed: number;
    conflicted: number;
  };
}

/**
 * Phase 4: Privacy Redaction Rules
 * Defines which fields should be stripped before persisting mutations
 * RedactionRule type is imported from centralized redaction manager
 */
export type { RedactionRule } from "@/pure-algo-immutables/redaction-manager";

/**
 * Phase 4: Auth Retry Metadata
 * Tracks auth state for replay attempts
 */
export interface AuthReplayMetadata {
  /** Auth strategy that was used (e.g., "user", "service") */
  authStrategy: string;

  /** Whether to refresh token before replay */
  shouldRefreshToken: boolean;

  /** When token was last refreshed */
  lastTokenRefreshAt?: number;

  /** Number of auth failures during replay */
  authFailureCount: number;
}
