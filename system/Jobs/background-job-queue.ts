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

// Note: FastCacheAdapter is intentionally NOT imported here.
// The middleware layer (lib/middleware/jobs/job-service.ts) creates and injects
// the correct adapters via getJobQueue({ storageAdapter, secureAdapter }).
// This keeps system/Jobs app-agnostic (no lib/* imports for adapters).
import { logger } from "@/lib/utils/logger";
import { formatDelay } from "@/pure-algo-immutables/backoff";
import { NetworkDetection } from "@/system/Network/network-detection";
import type {
  EnqueueOptions,
  JobCompletedEvent,
  JobEventSubscriber,
  JobFailedEvent,
  JobHandler,
  JobQueueConfig,
  JobRecord,
  StorageAdapter,
} from "@/type-definitions/job-queue-types";
import { HandlerRegistry } from "./handler-registry";
import { JobBuilder } from "./job-builder";
import { JobExecutor } from "./job-executor";
import { JobScheduler } from "./job-scheduler";
import { StorageAdapterRouter } from "./storage-adapter-router";

// ==========================================
// Defaults
// ==========================================

const DEFAULT_CONFIG: Required<
  Omit<JobQueueConfig, "storageAdapter" | "secureAdapter" | "concurrencyPerType">
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
  private config: Required<Omit<JobQueueConfig, "secureAdapter">> & {
    storageAdapter: StorageAdapter;
    secureAdapter?: StorageAdapter;
  };
  private registry: HandlerRegistry;
  private router: StorageAdapterRouter;
  private executor: JobExecutor;
  private builder: JobBuilder;
  private scheduler: JobScheduler;
  private subscribers: Set<JobEventSubscriber> = new Set();
  private isInitialized: boolean = false;
  private networkUnsubscribe: (() => void) | null = null;
  private reconnectDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: JobQueueConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      storageAdapter:
        config.storageAdapter ||
        (() => {
          throw new Error(
            "storageAdapter must be provided via initializeJobInfrastructure()",
          );
        })(),
      concurrencyPerType: config.concurrencyPerType || {},
    };

    this.registry = new HandlerRegistry();
    this.router = new StorageAdapterRouter(
      this.config.storageAdapter,
      this.config.secureAdapter ?? null,
    );
    this.executor = new JobExecutor(
      this.registry,
      this.router,
      (event) => this.emitEvent(event),
    );
    this.builder = new JobBuilder(this.router, {
      maxPayloadBytes: this.config.maxPayloadBytes,
      maxRetries: this.config.maxRetries,
      baseBackoffMs: this.config.baseBackoffMs,
      defaultJobTtlMs: this.config.defaultJobTtlMs,
    });
    this.scheduler = new JobScheduler(this.router, this.executor, {
      batchSize: this.config.batchSize,
      concurrency: this.config.concurrency,
      concurrencyPerType: this.config.concurrencyPerType,
      enableAutoCleanup: this.config.enableAutoCleanup,
      storageAdapter: this.config.storageAdapter,
    });
  }

  // ==========================================
  // Public API: Initialization
  // ==========================================

  /**
   * Initialize the queue (must be called before use).
   * - Loads existing jobs from storage
   * - Resets stalled jobs (running → pending)
   * - Subscribes to network status for auto-retry on reconnect
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const allJobs = await this.router.getAllJobs();
      logger.category("jobs").info(`Loaded ${allJobs.length} jobs from storage`);

      // Reset stalled jobs back to pending so they retry on next runNext()
      let stalledCount = 0;
      for (const job of allJobs) {
        if (
          job.status === "running" &&
          job.startedAt &&
          Date.now() - job.startedAt > this.config.stalledThresholdMs
        ) {
          logger.category("jobs").warn(
            `Resetting stalled job ${job.id} (started ${formatDelay(Date.now() - job.startedAt)} ago)`,
          );
          job.status = "pending";
          job.startedAt = undefined;
          const adapter = await this.router.getAdapterForJob(job.sensitive);
          await adapter.set(job);
          stalledCount++;
        }
      }
      if (stalledCount > 0) {
        logger.category("jobs").info(`Reset ${stalledCount} stalled jobs to pending`);
      }

      // Subscribe to network — flush the queue when we come back online
      this.networkUnsubscribe = NetworkDetection.subscribe((status) => {
        if (status.isOnline) {
          logger.category("jobs").debug("Network online: debouncing job processing", {
            debounceMs: this.config.reconnectDebounceMs,
          });
          if (this.reconnectDebounceTimer) clearTimeout(this.reconnectDebounceTimer);
          this.reconnectDebounceTimer = setTimeout(() => {
            this.reconnectDebounceTimer = null;
            logger.category("jobs").debug("Reconnect debounce expired: processing jobs");
            this.scheduler
              .runBatch()
              .catch((err) =>
                logger.category("jobs").warn("Error processing jobs on reconnect", err),
              );
          }, this.config.reconnectDebounceMs);
        } else {
          if (this.reconnectDebounceTimer) {
            clearTimeout(this.reconnectDebounceTimer);
            this.reconnectDebounceTimer = null;
            logger.category("jobs").debug("Network offline: cancelled reconnect flush");
          }
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
   */
  registerHandler(jobType: string, handler: JobHandler): void {
    this.registry.register(jobType, handler);
  }

  /**
   * Unregister a handler for a job type
   */
  unregisterHandler(jobType: string): void {
    this.registry.unregister(jobType);
  }

  /**
   * Check if a handler is registered for a job type
   */
  hasHandler(jobType: string): boolean {
    return this.registry.has(jobType);
  }

  // ==========================================
  // Public API: Enqueueing
  // ==========================================

  /** Validate, deduplicate, build and persist a new job. */
  async enqueue(options: EnqueueOptions): Promise<string> {
    return this.builder.enqueue(options);
  }

  // ==========================================
  // Public API: Execution
  // ==========================================

  /**
   * Run the next available batch of jobs.
   * Defers network-required jobs when offline, respects concurrency limits.
   *
   * @returns Number of jobs dispatched
   */
  async runNext(): Promise<number> {
    if (!this.isInitialized) await this.initialize();
    return this.scheduler.runBatch();
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
    const allJobs = await this.router.getAllJobs();
    return (
      allJobs
        .filter((job) => job.status === "pending" && job.runAt <= Date.now())
        .sort((a, b) => a.runAt - b.runAt)[0] ?? null
    );
  }

  /**
   * Get all jobs of a specific type and status
   */
  async getJobs(
    type?: string,
    status?: JobRecord["status"],
  ): Promise<JobRecord[]> {
    const allJobs = await this.router.getAllJobs();

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
    const allJobs = await this.router.getAllJobs();
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
  // Lifecycle
  // ==========================================

  destroy(): void {
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }
    this.scheduler.clearScheduledJobTimer();
    if (this.reconnectDebounceTimer) {
      clearTimeout(this.reconnectDebounceTimer);
      this.reconnectDebounceTimer = null;
    }
    logger.category("jobs").debug("Queue destroyed, all subscriptions and timers cleared");
  }
}

// ==========================================
// Singleton Instance
// ==========================================

let queueInstance: BackgroundJobQueue | null = null;

/**
 * Get or create the global job queue singleton.
 * Pass config only on first call (via initializeJobInfrastructure).
 *
 * @example
 * import { getJobQueue } from '@/lib/jobs';
 * const queue = getJobQueue();
 */
export function getJobQueue(config?: JobQueueConfig): BackgroundJobQueue {
  if (!queueInstance) {
    queueInstance = new BackgroundJobQueue(config);
  }
  return queueInstance;
}
