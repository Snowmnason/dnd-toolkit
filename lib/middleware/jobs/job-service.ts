/**
 * Job Service — Middleware
 *
 * Sits between JobsManager and system/Jobs. Owns all precondition checks,
 * adapter injection, and normalization so the queue itself stays pure.
 *
 * Responsibilities:
 * - Bootstrap: create adapters and inject into the queue singleton
 * - Network precondition: warn/defer if job requires network and we're offline
 * - Storage routing: resolve which adapter a job should use
 * - Normalization: ensure sensible defaults before handing to system
 * - Logging: trace every enqueue with context
 *
 * Does NOT:
 * - Execute jobs (that's system/Jobs/background-job-queue.ts)
 * - Expose UI state (that's JobsManager → hooks)
 *
 * Architecture:
 * JobsManager → jobService (this file) → getJobQueue() → system
 */

import { logger } from '@/lib/utils/logger';
import { getJobQueue } from '@/system/Jobs/background-job-queue';
import { NetworkDetection } from '@/system/Network/network-detection';
import type { EnqueueOptions, JobEventSubscriber, JobRecord } from '@/type-definitions/job-queue-types';
import { FastCacheAdapter } from './adapters/fastcache-adapter';
import { SecureStorageAdapter } from './adapters/secure-storage-adapter';

// ─── Bootstrap ──────────────────────────────────────────────────────────────

/**
 * Initialize the job queue with the correct storage adapters.
 * Called once from sync-phase during kernel bootstrap.
 *
 * Injects:
 * - FastCacheAdapter  → default (non-sensitive jobs)
 * - SecureStorageAdapter → secure (sensitive jobs, PII, auth tokens)
 *
 * After this call the queue singleton is ready and handlers can be registered.
 */
export async function initializeJobInfrastructure(): Promise<void> {
  const defaultAdapter = new FastCacheAdapter();
  const secureAdapter = new SecureStorageAdapter();

  const queue = getJobQueue({
    storageAdapter: defaultAdapter,
    secureAdapter,
  });

  await queue.initialize();

  logger.category('jobs').info('✅ Job infrastructure initialized (fastcache + secure adapters)');
}

/**
 * Register all background job handlers with the queue.
 * Called once from registration-phase during kernel bootstrap, after initializeJobInfrastructure.
 */
export async function registerJobHandlers(): Promise<void> {
  const queue = getJobQueue();

  // Sync orchestrator
  const { createSyncJobHandler } = await import('@/lib/jobs');
  const syncHandler = createSyncJobHandler();
  queue.registerHandler(syncHandler.name, (async (payload: any) => {
    await syncHandler.execute(payload);
  }) as any); // JobHandler expects (payload, context), but we only need payload

  // Network recovery — full init: registers handler + wires state-machine transition listeners
  const { NetworkRecoveryRetryJobManager } = await import('@/lib/jobs/core/network-recovery-retry-job');
  const { NetworkStateManager } = await import('@/system/Network/state-machine');
  await NetworkRecoveryRetryJobManager.initialize(NetworkStateManager, queue);

  logger.category('jobs').info('Job handlers registered (sync-orchestrator, network-recovery-retry)');
}

// ─── Precondition Checks ────────────────────────────────────────────────────

/**
 * Check whether a job that requires network connectivity can proceed.
 * Returns true if the job can be enqueued normally.
 * Returns false if the job is online-only and we are offline (should be dropped or blocked).
 */
function checkNetworkPrecondition(options: EnqueueOptions): boolean {
  if (!options.requiresNetwork) return true;

  const status = NetworkDetection.getStatus();
  const isOnline = status?.isOnline ?? true; // assume online if unavailable

  if (!isOnline) {
    if (options.requiresNetwork === 'defer') {
      // Defer is fine — the queue handles scheduling this for when we're back online
      logger.category('jobs').debug(
        `Job "${options.type}" will be deferred (requiresNetwork=defer, currently offline)`,
      );
    } else {
      // requiresNetwork === true means online-only — log that it's being queued
      // to fire on reconnect (the queue will handle the defer logic itself)
      logger.category('jobs').debug(
        `Job "${options.type}" queued (requiresNetwork=true, currently offline, will run on reconnect)`,
      );
    }
  }

  return true; // Always allow enqueue — the queue's runNext() defers as needed
}

// ─── Normalization ───────────────────────────────────────────────────────────

/**
 * Normalize enqueue options to ensure sensible defaults are explicit
 * before passing into the system queue.
 */
function normalizeOptions(options: EnqueueOptions): EnqueueOptions {
  return {
    priority: 'normal',
    ...options,
    runAt: options.runAt ?? Date.now(),
    sensitive: options.sensitive ?? false,
  };
}

// ─── Runtime Methods ─────────────────────────────────────────────────────────

export const jobService = {
  /**
   * Enqueue a job after precondition checks and normalization.
   *
   * Flow:
   * 1. Network precondition check (warn if requiresNetwork and offline)
   * 2. Normalize options (defaults, runAt, sensitive flag)
   * 3. Delegate to system queue
   */
  async enqueue(options: EnqueueOptions): Promise<string> {
    // 1. Network precondition
    checkNetworkPrecondition(options);

    // 2. Normalize
    const normalized = normalizeOptions(options);

    logger.category('jobs').debug(
      `Enqueueing "${normalized.type}" (sensitive=${normalized.sensitive}, requiresNetwork=${normalized.requiresNetwork ?? false}, priority=${normalized.priority})`,
    );

    // 3. Delegate to system
    return getJobQueue().enqueue(normalized);
  },

  /**
   * Get a single job's current record from storage.
   */
  async getJob(jobId: string): Promise<JobRecord | null> {
    return getJobQueue().getStatus(jobId);
  },

  /**
   * Get all jobs, optionally filtered by type and/or status.
   */
  async getJobs(type?: string, status?: JobRecord['status']): Promise<JobRecord[]> {
    return getJobQueue().getJobs(type, status);
  },

  /**
   * Get count of pending jobs.
   */
  async getPendingCount(): Promise<number> {
    return getJobQueue().getPendingCount();
  },

  /**
   * Subscribe to job events (completed, failed, retry).
   * Returns unsubscribe function.
   */
  subscribe(subscriber: JobEventSubscriber): () => void {
    return getJobQueue().subscribe(subscriber);
  },

  /**
   * Cancel a pending job.
   */
  async cancel(jobId: string): Promise<boolean> {
    return getJobQueue().cancel(jobId);
  },

  /**
   * Clear all jobs of a given type.
   */
  async clearByType(type: string): Promise<number> {
    return getJobQueue().clearByType(type);
  },

  /**
   * Peek at the next pending job without executing it.
   */
  async peekNext(): Promise<JobRecord | null> {
    return getJobQueue().peek();
  },
};
