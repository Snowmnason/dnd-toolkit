/**
 * Background Job Queue
 *
 * Foundation-level persistent job queue for deferred, retryable work.
 *
 * Features:
 * - Persist jobs across app restarts
 * - Exponential backoff retry with jitter
 * - Idempotency key deduplication
 * - Job status tracking (pending, running, completed, failed)
 * - Handler registry per job type
 * - Concurrent job limiting (global + per-type)
 *
 * Usage:
 * ```ts
 * import { BackgroundJobQueue } from '@/lib/jobs';
 *
 * // Initialize with defaults
 * const queue = new BackgroundJobQueue();
 *
 * // Register handlers (during app bootstrap)
 * queue.registerHandler('feature_flags_refresh', async (payload, ctx) => {
 *   await fetchFeatureFlags(payload.worldId);
 *   return { updatedAt: Date.now() };
 * });
 *
 * // Enqueue a job
 * await queue.enqueue({
 *   type: 'feature_flags_refresh',
 *   payload: { worldId: 'world_123' },
 *   idempotencyKey: `ff-refresh:world_123`,
 * });
 *
 * // Run next job
 * await queue.runNext();
 * ```
 */

import { NetworkDetection } from "@/lib/network/network-detection";
import { logger } from "@/lib/utils/logger";
import { FastCacheAdapter } from "./adapters/fastcache-adapter";
import { calculateNextRetryTime, formatDelay, isRetryable } from "./backoff";
import {
    EnqueueOptions,
    JobCompletedEvent,
    JobEventSubscriber,
    JobFailedEvent,
    JobHandler,
    JobHandlerContext,
    JobQueueConfig,
    JobRecord,
    StorageAdapter,
} from "./types";

// ==========================================
// UUID Generation
// ==========================================

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for environments without randomUUID
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ==========================================
// Defaults
// ==========================================

const DEFAULT_CONFIG: Required<
  Omit<JobQueueConfig, "storageAdapter" | "concurrencyPerType">
> = {
  maxRetries: 5,
  baseBackoffMs: 1000,
  batchSize: 3,
  concurrency: 1,
  maxPayloadBytes: 100 * 1024, // 100KB
  stalledThresholdMs: 10 * 60 * 1000, // 10 minutes
  overflowPolicy: "dropOldestFailed",
  reconnectDebounceMs: 1000,
  defaultJobTtlMs: 0, // No TTL by default
  enableAutoCleanup: true,
};

// ==========================================
// Background Job Queue Class
// ==========================================

export class BackgroundJobQueue {
  private config: Required<JobQueueConfig> & { storageAdapter: StorageAdapter };
  private handlers: Map<string, JobHandler> = new Map();
  private subscribers: Set<JobEventSubscriber> = new Set();
  private runningJobs: Map<string, Promise<void>> = new Map(); // Track in-flight jobs
  private isInitialized: boolean = false;
  private activeCounts: Map<string, number> = new Map(); // Track active jobs per type
  private networkUnsubscribe: (() => void) | null = null; // NetworkDetection subscription

  constructor(config: JobQueueConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      storageAdapter: config.storageAdapter || new FastCacheAdapter(),
      concurrencyPerType: config.concurrencyPerType || {},
    };

    logger.category("jobs").info("Initialized BackgroundJobQueue");
  }

  // ==========================================
  // Public API: Initialization
  // ==========================================

  /**
   * Initialize the queue (must be called before use)
   * - Loads existing jobs from storage
   * - Resets stalled jobs (running → pending)
   * - Validates job records
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const allJobs = await this.config.storageAdapter.getAll();

      logger
        .category("jobs")
        .info(`Loaded ${allJobs.length} jobs from storage`);

      // Reset stalled jobs
      let stalledCount = 0;
      for (const job of allJobs) {
        if (
          job.status === "running" &&
          job.startedAt &&
          Date.now() - job.startedAt > this.config.stalledThresholdMs
        ) {
          logger
            .category("jobs")
            .warn(
              `Resetting stalled job ${job.id} (started ${formatDelay(Date.now() - job.startedAt)} ago)`,
            );

          job.status = "pending";
          job.startedAt = undefined;
          await this.config.storageAdapter.set(job);
          stalledCount++;
        }
      }

      if (stalledCount > 0) {
        logger
          .category("jobs")
          .info(`Reset ${stalledCount} stalled jobs to pending`);
      }

      // Subscribe to network status changes to trigger processing when online
      this.networkUnsubscribe = NetworkDetection.subscribe((status) => {
        if (status.isOnline) {
          logger
            .category("jobs")
            .debug("Network online: triggering job processing");
          this.runNext().catch((err) => {
            logger
              .category("jobs")
              .warn("Error processing jobs on network reconnect", err);
          });
        }
      });

      this.isInitialized = true;
      logger.category("jobs").debug("Queue initialization complete");
    } catch (error) {
      logger.category("jobs").error(`Failed to initialize queue: ${error}`);
      throw error;
    }
  }

  // ==========================================
  // Public API: Handler Registry
  // ==========================================

  /**
   * Register a handler for a job type
   *
   * @param jobType - Job type identifier
   * @param handler - Async function to execute the job
   *
   * @example
   * queue.registerHandler('feature_flags_refresh', async (payload, ctx) => {
   *   console.log(`Refreshing flags for world ${payload.worldId}`);
   *   const result = await fetchFeatureFlags(payload.worldId);
   *   return result;
   * });
   */
  registerHandler(jobType: string, handler: JobHandler): void {
    if (!jobType) throw new Error("jobType must be a non-empty string");
    if (!handler) throw new Error("handler must be a function");

    this.handlers.set(jobType, handler);
    logger
      .category("jobs")
      .debug(`Registered handler for job type: ${jobType}`);
  }

  /**
   * Unregister a handler for a job type
   */
  unregisterHandler(jobType: string): void {
    this.handlers.delete(jobType);
    logger
      .category("jobs")
      .debug(`Unregistered handler for job type: ${jobType}`);
  }

  /**
   * Check if a handler is registered for a job type
   */
  hasHandler(jobType: string): boolean {
    return this.handlers.has(jobType);
  }

  // ==========================================
  // Public API: Job Enqueueing
  // ==========================================

  /**
   * Enqueue a new job
   *
   * @param options - Enqueue options (type, payload, etc.)
   * @returns Job ID
   *
   * Behavior:
   * - Validates payload size
   * - Deduplicates by idempotencyKey if provided
   * - Creates JobRecord with default or provided config
   * - Persists to storage
   *
   * @throws If payload exceeds size limit or storage fails
   *
   * @example
   * const jobId = await queue.enqueue({
   *   type: 'sync_notes',
   *   payload: { worldId: 'w123', userId: 'u456' },
   *   idempotencyKey: 'sync:w123:u456',
   *   maxRetries: 3,
   * });
   */
  async enqueue(options: EnqueueOptions): Promise<string> {
    if (!options.type) throw new Error("options.type is required");
    if (!options.payload) throw new Error("options.payload is required");

    // Validate payload size
    const payloadSize = JSON.stringify(options.payload).length;
    if (payloadSize > this.config.maxPayloadBytes) {
      throw new Error(
        `Payload exceeds maximum size: ${payloadSize} > ${this.config.maxPayloadBytes}`,
      );
    }

    // Check for duplicate by idempotency key
    if (options.idempotencyKey) {
      const existing = await this.findByIdempotencyKey(options.idempotencyKey);
      if (existing) {
        logger
          .category("jobs")
          .debug(
            `Job with idempotency key already exists: ${options.idempotencyKey}, reusing ${existing.id}`,
          );
        return existing.id;
      }
    }

    // Create job record
    const jobRecord: JobRecord = {
      id: generateUUID(),
      type: options.type,
      payload: options.payload,
      idempotencyKey: options.idempotencyKey,
      status: "pending",
      retryCount: 0,
      maxRetries: options.maxRetries ?? this.config.maxRetries,
      backoffMs: options.baseBackoffMs ?? this.config.baseBackoffMs,
      runAt: options.runAt ?? Date.now(),
      createdAt: Date.now(),
      recurrencePattern: options.recurrencePattern,
      requiresNetwork: options.requiresNetwork,
      priority: options.priority ?? "normal",
      ttlMs: options.ttlMs ?? this.config.defaultJobTtlMs,
    };

    // Set expiresAt if TTL is configured (will be set after job completion)
    // For now, we just store the ttlMs value

    // Persist to storage
    await this.config.storageAdapter.set(jobRecord);

    logger
      .category("jobs")
      .info(
        `Enqueued job: ${jobRecord.id} (type: ${options.type}, runAt: ${new Date(jobRecord.runAt).toISOString()})`,
      );

    return jobRecord.id;
  }

  // ==========================================
  // Public API: Job Execution
  // ==========================================

  /**
   * Run the next available job (or up to batchSize jobs)
   *
   * Behavior:
   * - Loads pending jobs sorted by runAt
   * - Respects concurrency limits (global + per-type)
   * - Updates job status to "running"
   * - Invokes handler
   * - On success: mark completed, cache result
   * - On failure: classify error, reschedule with backoff or mark failed
   * - Handles crashes gracefully (job stays in running state, reset on restart)
   *
   * @returns Number of jobs processed
   */
  async runNext(): Promise<number> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const allJobs = await this.config.storageAdapter.getAll();

      // Cleanup: Remove expired jobs if auto-cleanup is enabled
      if (this.config.enableAutoCleanup) {
        const now = Date.now();
        const expiredJobs = allJobs.filter(
          (job) => job.expiresAt && job.expiresAt <= now,
        );
        for (const job of expiredJobs) {
          await this.config.storageAdapter.delete(job.id);
          logger
            .category("jobs")
            .debug(
              `Cleaned up expired job ${job.id} (${job.type}, expired at ${new Date(job.expiresAt!).toISOString()})`,
            );
        }
      }

      // Get current network status
      const networkStatus = NetworkDetection.getStatus();
      const isOnline = networkStatus?.isOnline ?? true; // Assume online if unavailable

      // Filter pending jobs that are ready to run
      let pendingJobs = allJobs
        .filter((job) => job.status === "pending" && job.runAt <= Date.now())
        .sort((a, b) => {
          // Sort by priority first (high → normal → low), then by runAt
          const priorityOrder = { high: 0, normal: 1, low: 2 };
          const aPriority = priorityOrder[a.priority ?? "normal"];
          const bPriority = priorityOrder[b.priority ?? "normal"];

          if (aPriority !== bPriority) {
            return aPriority - bPriority;
          }
          return a.runAt - b.runAt;
        });

      // Handle network requirements
      const jobsToProcess: JobRecord[] = [];
      const jobsToDefer: JobRecord[] = [];

      for (const job of pendingJobs) {
        const requiresNetwork = job.requiresNetwork ?? false;

        if (requiresNetwork === true && !isOnline) {
          // Online-required job: defer if offline
          jobsToDefer.push(job);
        } else if (requiresNetwork === "defer" && !isOnline) {
          // Hybrid job: defer if offline
          jobsToDefer.push(job);
        } else {
          // Ready to process (either offline-capable or online available)
          jobsToProcess.push(job);
        }
      }

      // Update deferred jobs (reschedule them)
      for (const job of jobsToDefer) {
        // Defer for 5 seconds (wait for network to stabilize)
        job.runAt = Date.now() + 5000;
        await this.config.storageAdapter.set(job);
        logger
          .category("jobs")
          .debug(
            `Job ${job.id} deferred (${job.requiresNetwork === true ? "requires-network" : "hybrid"}, currently offline)`,
          );
      }

      // Take up to batchSize from ready jobs
      const batch = jobsToProcess.slice(0, this.config.batchSize);

      if (batch.length === 0) {
        if (jobsToDefer.length > 0 && !isOnline) {
          logger
            .category("jobs")
            .debug(`${jobsToDefer.length} jobs deferred (waiting for network)`);
        } else {
          logger.category("jobs").debug("No pending jobs ready to run");
        }
        return 0;
      }

      logger
        .category("jobs")
        .debug(
          `Processing batch of ${batch.length} jobs (${this.runningJobs.size} already running, ${jobsToDefer.length} deferred)`,
        );

      // Process jobs respecting concurrency
      let processedCount = 0;
      for (const job of batch) {
        // Check global concurrency
        if (
          this.runningJobs.size >= this.config.concurrency &&
          this.config.concurrency > 0
        ) {
          logger
            .category("jobs")
            .debug(
              `Global concurrency limit reached (${this.config.concurrency})`,
            );
          break;
        }

        // Check per-type concurrency
        const typeLimit =
          this.config.concurrencyPerType?.[job.type] ?? this.config.concurrency;
        const typeCount = this.activeCounts.get(job.type) ?? 0;

        if (typeCount >= typeLimit && typeLimit > 0) {
          logger
            .category("jobs")
            .debug(
              `Per-type concurrency limit reached for ${job.type} (${typeLimit})`,
            );
          continue;
        }

        // Start processing
        const processPromise = this.processJob(job).finally(() => {
          this.runningJobs.delete(job.id);
          const newCount = (this.activeCounts.get(job.type) ?? 1) - 1;
          if (newCount > 0) {
            this.activeCounts.set(job.type, newCount);
          } else {
            this.activeCounts.delete(job.type);
          }
        });

        this.runningJobs.set(job.id, processPromise);
        this.activeCounts.set(job.type, typeCount + 1);
        processedCount++;
      }

      return processedCount;
    } catch (error) {
      logger.category("jobs").error(`Error running next batch: ${error}`);
      return 0;
    }
  }

  /**
   * Process a single job (internal)
   */
  private async processJob(job: JobRecord): Promise<void> {
    const startTime = Date.now();

    try {
      // Update to running
      job.status = "running";
      job.startedAt = startTime;
      await this.config.storageAdapter.set(job);

      logger
        .category("jobs")
        .info(
          `Starting job ${job.id} (type: ${job.type}, retry: ${job.retryCount}/${job.maxRetries})`,
        );

      // Get handler
      const handler = this.handlers.get(job.type);
      if (!handler) {
        throw new Error(`No handler registered for job type: ${job.type}`);
      }

      // Create handler context
      const context: JobHandlerContext = {
        jobId: job.id,
        retryCount: job.retryCount,
      };

      // Execute handler
      const result = await handler(job.payload, context);

      // Success
      const durationMs = Date.now() - startTime;
      job.status = "completed";
      job.completedAt = Date.now();
      job.result = result;

      // Set expiration time if TTL is configured
      if (job.ttlMs && job.ttlMs > 0) {
        job.expiresAt = job.completedAt + job.ttlMs;
      }

      await this.config.storageAdapter.set(job);

      logger
        .category("jobs")
        .info(
          `Job ${job.id} completed in ${formatDelay(durationMs)} (${job.type})`,
        );

      // Emit event
      const event: JobCompletedEvent = {
        jobId: job.id,
        type: job.type,
        result,
        durationMs,
      };
      this.emitEvent(event);
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMsg = String(error);

      // Determine if retryable
      const retryable = isRetryable(error);

      logger
        .category("jobs")
        .warn(
          `Job ${job.id} failed (${formatDelay(durationMs)}): ${errorMsg} [retryable: ${retryable}]`,
        );

      // Handle failure
      if (retryable && job.retryCount < job.maxRetries) {
        // Schedule retry
        job.retryCount++;
        job.lastError = errorMsg;
        job.status = "pending";
        job.startedAt = undefined;
        job.runAt = calculateNextRetryTime(job.retryCount - 1, job.backoffMs);

        await this.config.storageAdapter.set(job);

        const nextRetryDelay = job.runAt - Date.now();
        logger
          .category("jobs")
          .info(
            `Job ${job.id} scheduled for retry ${job.retryCount}/${job.maxRetries} in ${formatDelay(nextRetryDelay)}`,
          );

        // Emit event
        const event: JobFailedEvent = {
          jobId: job.id,
          type: job.type,
          error: errorMsg,
          retryCount: job.retryCount,
          retryable: true,
          nextRetryAt: job.runAt,
        };
        this.emitEvent(event);
      } else {
        // Permanent failure
        job.status = "failed";
        job.lastError = errorMsg;
        job.completedAt = Date.now();
        job.startedAt = undefined;

        // Set expiration time if TTL is configured
        if (job.ttlMs && job.ttlMs > 0) {
          job.expiresAt = job.completedAt + job.ttlMs;
        }

        await this.config.storageAdapter.set(job);

        logger
          .category("jobs")
          .error(
            `Job ${job.id} failed permanently after ${job.retryCount} retries`,
          );

        // Emit event
        const event: JobFailedEvent = {
          jobId: job.id,
          type: job.type,
          error: errorMsg,
          retryCount: job.retryCount,
          retryable: false,
        };
        this.emitEvent(event);
      }
    }
  }

  // ==========================================
  // Public API: Job Status & Querying
  // ==========================================

  /**
   * Get status of a specific job
   */
  async getStatus(jobId: string): Promise<JobRecord | null> {
    return this.config.storageAdapter.get(jobId);
  }

  /**
   * Peek at the next job without executing it
   */
  async peek(): Promise<JobRecord | null> {
    const allJobs = await this.config.storageAdapter.getAll();

    return (
      allJobs
        .filter((job) => job.status === "pending" && job.runAt <= Date.now())
        .sort((a, b) => a.runAt - b.runAt)[0] || null
    );
  }

  /**
   * Get all jobs of a specific type and status
   */
  async getJobs(
    type?: string,
    status?: JobRecord["status"],
  ): Promise<JobRecord[]> {
    const allJobs = await this.config.storageAdapter.getAll();

    return allJobs.filter((job) => {
      const matchesType = !type || job.type === type;
      const matchesStatus = !status || job.status === status;
      return matchesType && matchesStatus;
    });
  }

  /**
   * Get count of pending jobs
   */
  async getPendingCount(): Promise<number> {
    const allJobs = await this.config.storageAdapter.getAll();
    return allJobs.filter((job) => job.status === "pending").length;
  }

  // ==========================================
  // Public API: Job Control
  // ==========================================

  /**
   * Cancel a job (only if pending)
   *
   * @returns true if cancelled, false if job not found or not cancelable
   */
  async cancel(jobId: string): Promise<boolean> {
    const job = await this.config.storageAdapter.get(jobId);

    if (!job) {
      logger.category("jobs").warn(`Job not found: ${jobId}`);
      return false;
    }

    if (job.status !== "pending") {
      logger
        .category("jobs")
        .warn(
          `Cannot cancel job ${jobId}: status is ${job.status}, not pending`,
        );
      return false;
    }

    await this.config.storageAdapter.delete(jobId);
    logger.category("jobs").info(`Cancelled job ${jobId}`);

    return true;
  }

  /**
   * Clear all jobs of a specific type
   */
  async clearByType(type: string): Promise<number> {
    const jobs = await this.getJobs(type);

    await this.config.storageAdapter.deleteByType(type);

    logger.category("jobs").info(`Cleared ${jobs.length} jobs of type ${type}`);

    return jobs.length;
  }

  // ==========================================
  // Public API: Events
  // ==========================================

  /**
   * Subscribe to job events (completion, failure)
   */
  subscribe(subscriber: JobEventSubscriber): () => void {
    this.subscribers.add(subscriber);

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  /**
   * Emit event to all subscribers
   */
  private emitEvent(event: JobCompletedEvent | JobFailedEvent): void {
    for (const subscriber of this.subscribers) {
      try {
        subscriber(event);
      } catch (error) {
        logger.category("jobs").error(`Error in subscriber: ${error}`);
      }
    }
  }

  // ==========================================
  // Private Helpers
  // ==========================================

  /**
   * Find a job by idempotency key
   */
  private async findByIdempotencyKey(key: string): Promise<JobRecord | null> {
    const allJobs = await this.config.storageAdapter.getAll();
    return (
      allJobs.find(
        (job) => job.idempotencyKey === key && job.status === "pending",
      ) || null
    );
  }

  /**
   * Cleanup on app shutdown (unsubscribe from network events)
   */
  destroy(): void {
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
      logger
        .category("jobs")
        .debug("Queue destroyed, network subscription unsubscribed");
    }
  }
}

// ==========================================
// Singleton Instance
// ==========================================

let queueInstance: BackgroundJobQueue | null = null;

/**
 * Get or create the global job queue singleton
 *
 * @example
 * import { getJobQueue } from '@/lib/jobs';
 *
 * const queue = getJobQueue();
 * await queue.initialize();
 */
export function getJobQueue(config?: JobQueueConfig): BackgroundJobQueue {
  if (!queueInstance) {
    queueInstance = new BackgroundJobQueue(config);
  }
  return queueInstance;
}
