/**
 * Job Queue Types
 *
 * Core interfaces for the Background Job Queue system.
 * These types define job structure, handlers, configuration, and storage.
 */

// ==========================================
// Job Record & Status
// ==========================================

/**
 * Represents a single job in the queue.
 * Persisted to storage (FastCache or SecureStorage) across app restarts.
 */
export interface JobRecord {
  /** Unique identifier for this job (UUID v4) */
  id: string;

  /** Job type identifier (e.g., "feature_flags_refresh", "sync_notes") */
  type: string;

  /** Job-specific payload data */
  payload: Record<string, any>;

  /** Optional idempotency key for deduplication (UUID of logical operation) */
  idempotencyKey?: string;

  /** Current status of the job */
  status: "pending" | "running" | "completed" | "failed";

  /** Number of times this job has been attempted */
  retryCount: number;

  /** Maximum retry attempts allowed (default: 5) */
  maxRetries: number;

  /** Base backoff delay in milliseconds for exponential backoff (default: 1000ms) */
  backoffMs: number;

  /** Timestamp when this job should run (Date.now() milliseconds) */
  runAt: number;

  /** Timestamp when job was created */
  createdAt: number;

  /** Timestamp when job execution started (present if status === "running") */
  startedAt?: number;

  /** Timestamp when job completed (present if status === "completed" or "failed") */
  completedAt?: number;

  /** Last error message if job failed */
  lastError?: string;

  /** Cached result from last successful execution */
  result?: any;

  /** Optional recurrence pattern for scheduled/recurring jobs */
  recurrencePattern?: string; // e.g., "daily", "weekly", or cron-like pattern (future)

  /**
   * Network requirement mode for this job
   * - `false` or undefined: Offline-capable (runs anytime, even without network)
   * - `true`: Requires network (deferred if offline, retried when online)
   * - `"defer"`: Hybrid mode (tries online if available, defers gracefully if offline)
   *
   * Default: false (offline-capable)
   * Examples:
   * - `feature_flags_refresh`: true (must update from server)
   * - `save_to_local_cache`: false (pure local work)
   * - `profile_sync`: "defer" (sync if online, save locally if offline)
   */
  requiresNetwork?: boolean | "defer";

  /**
   * Priority level for job execution (default: "normal")
   * Jobs are sorted by priority (high → normal → low) then by runAt timestamp
   * Higher priority jobs run before lower priority jobs
   */
  priority?: "high" | "normal" | "low";

  /**
   * Time-to-live for completed/failed jobs in milliseconds (optional)
   * If set, job will be automatically deleted after this duration
   * Useful for cleanup of old completed or failed jobs
   * Example: 86400000 = 24 hours
   */
  ttlMs?: number;

  /**
   * Timestamp when this job will expire (completedAt + ttlMs)
   * Used for automatic cleanup of old jobs
   */
  expiresAt?: number;

  /**
   * Whether this job contains sensitive data and should use encrypted storage
   * If true, job will be stored via SecureStorageAdapter instead of default adapter
   * Default: false (uses default storage adapter)
   */
  sensitive?: boolean;
}

/**
 * Accepted job statuses
 */
export type JobStatus = JobRecord["status"];

// ==========================================
// Handler & Errors
// ==========================================

/**
 * Context passed to job handlers during execution
 */
export interface JobHandlerContext {
  /** The unique ID of the job being executed */
  jobId: string;

  /** Number of retry attempts so far */
  retryCount: number;

  /** AbortSignal for optional cancellation support (future) */
  signal?: AbortSignal;
}

/**
 * Error returned by a handler, used to classify retryability
 */
export interface JobHandlerError {
  retryable: boolean;
  code?: string;
  message?: string;
  originalError?: Error;
}

/**
 * Function signature for job handlers
 * Handlers are invoked during job execution and must be idempotent (safe to retry)
 *
 * @param payload Job-specific data passed at enqueue time
 * @param context Job execution context (jobId, retryCount, signal)
 * @returns Promise resolving to result data (cached for later retrieval)
 * @throws Can throw an Error or return a JobHandlerError to signal failure
 */
export type JobHandler = (
  payload: Record<string, any>,
  context: JobHandlerContext,
) => Promise<any>;

// ==========================================
// Queue Configuration
// ==========================================

/**
 * Configuration options for the BackgroundJobQueue
 */
export interface JobQueueConfig {
  /** Maximum retry attempts per job (default: 5) */
  maxRetries?: number;

  /** Base delay for exponential backoff in milliseconds (default: 1000ms) */
  baseBackoffMs?: number;

  /** Maximum number of jobs to process in a single batch (default: 3) */
  batchSize?: number;

  /** Storage adapter to use (default: FastCacheAdapter) */
  storageAdapter?: StorageAdapter;

  /**
   * Global maximum concurrent jobs across all types (default: 1)
   * Set to > 1 to allow parallel job execution
   */
  concurrency?: number;

  /**
   * Per-job-type concurrency overrides
   * Maps job type to max concurrent instances
   */
  concurrencyPerType?: Record<string, number>;

  /**
   * Configurable payload size limit in bytes (default: 100KB = 102400)
   */
  maxPayloadBytes?: number;

  /**
   * Stalled job detection threshold in milliseconds (default: 10 minutes)
   * Jobs in "running" state older than this threshold are reset to "pending"
   */
  stalledThresholdMs?: number;

  /**
   * Overflow policy when storage quota is exceeded
   * "dropOldestFailed" (default): Remove oldest failed jobs first
   * "rejectNew": Reject new enqueues when quota exceeded
   */
  overflowPolicy?: "dropOldestFailed" | "rejectNew";

  /**
   * Debounce delay for queue flushes after network reconnection (default: 1000ms)
   * Prevents thrashing during rapid on/off toggles
   */
  reconnectDebounceMs?: number;

  /**
   * Default TTL (time-to-live) for completed/failed jobs in milliseconds
   * If set, jobs will be automatically cleaned up after their completion + ttlMs
   * Per-job override via `ttlMs` field in job record
   * Example: 86400000 = 24 hours
   */
  defaultJobTtlMs?: number;

  /**
   * Enable automatic cleanup pass during runNext() to remove expired jobs
   * (default: true)
   */
  enableAutoCleanup?: boolean;

  /**
   * Storage adapter for sensitive jobs (PII, auth tokens, secrets).
   * Injected by lib/middleware/jobs/job-service.ts during bootstrap.
   * If omitted, sensitive jobs fall back to the default storageAdapter.
   */
  secureAdapter?: StorageAdapter;
}

// ==========================================
// Storage Adapter Interface
// ==========================================

/**
 * Abstract storage interface for persisting jobs
 * Allows swapping between FastCache, SecureStorage, or custom backends
 */
export interface StorageAdapter {
  /**
   * Retrieve all job records from storage
   */
  getAll(): Promise<JobRecord[]>;

  /**
   * Retrieve a single job by ID
   */
  get(id: string): Promise<JobRecord | null>;

  /**
   * Store or update a job record
   */
  set(record: JobRecord): Promise<void>;

  /**
   * Delete a job record by ID
   */
  delete(id: string): Promise<void>;

  /**
   * Delete all jobs of a specific type
   */
  deleteByType(type: string): Promise<void>;

  /**
   * Get current storage usage and quota information
   * Returns undefined if not available
   */
  getQuotaInfo?(): Promise<{
    usedBytes: number;
    quotaBytes: number;
    percentUsed: number;
  } | null>;
}

// ==========================================
// Enqueue Options
// ==========================================

/**
 * Options for enqueuing a job
 */
export interface EnqueueOptions {
  /** Job type identifier (required) */
  type: string;

  /** Job-specific payload data (required) */
  payload: Record<string, any>;

  /** Idempotency key for deduplication (optional) */
  idempotencyKey?: string;

  /** Timestamp when job should run (default: now) */
  runAt?: number;

  /** Maximum retry attempts (default: from config) */
  maxRetries?: number;

  /** Base backoff delay in ms (default: from config) */
  baseBackoffMs?: number;

  /** Recurrence pattern for recurring jobs (optional, future) */
  recurrencePattern?: string;

  /** Whether this is a sensitive job requiring SecureStorage (default: false) */
  sensitive?: boolean;

  /**
   * Network requirement mode for this job
   * - `false` or undefined: Offline-capable (runs anytime)
   * - `true`: Requires network (deferred if offline)
   * - `"defer"`: Hybrid (tries online, defers gracefully if offline)
   * Default: false (offline-capable)
   */
  requiresNetwork?: boolean | "defer";

  /**
   * Priority level for job execution (default: "normal")
   * Jobs are sorted by priority (high → normal → low) then by runAt
   */
  priority?: "high" | "normal" | "low";

  /**
   * Time-to-live for this job after completion in milliseconds (optional)
   * If set, job will be automatically deleted after completedAt + ttlMs
   * Overrides queue's defaultJobTtlMs
   */
  ttlMs?: number;
}

// ==========================================
// Queue Events & Subscribers
// ==========================================

/**
 * Event emitted when a job completes successfully
 */
export interface JobCompletedEvent {
  jobId: string;
  type: string;
  result: any;
  durationMs: number;
}

/**
 * Event emitted when a job fails
 */
export interface JobFailedEvent {
  jobId: string;
  type: string;
  error: string;
  retryCount: number;
  retryable: boolean;
  nextRetryAt?: number;
}

/**
 * Subscriber callback for job events
 */
export type JobEventSubscriber = (
  event: JobCompletedEvent | JobFailedEvent,
) => void;
// ==========================================
// UI Status Representation
// ==========================================

/**
 * Job status for UI display
 * Simplified representation of a job's current state
 */
export interface QueueStatusItem {
  /** Unique job identifier */
  id: string;

  /** Job type (e.g., "upload_document", "create_world", "sync_notes") */
  type: string;

  /** Current status of the job */
  status: "pending" | "running" | "completed" | "failed";

  /** Approximate payload size in bytes */
  payloadSizeBytes: number;

  /** Position in queue (1-indexed, for "1 of 5" display) */
  position: number;

  /** When job was created */
  createdAt: number;

  /** When job started execution (if applicable) */
  startedAt?: number;

  /** When job completed (if applicable) */
  completedAt?: number;

  /** Error message if failed */
  lastError?: string;

  /** Number of retry attempts made so far */
  retryCount: number;

  /** Maximum retry attempts allowed */
  maxRetries: number;
}
