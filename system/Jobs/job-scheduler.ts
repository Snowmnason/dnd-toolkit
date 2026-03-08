/**
 * Job Scheduler
 *
 * Decides which jobs to run next: filters by readiness, sorts by priority,
 * handles network-based deferral, enforces concurrency limits, and manages
 * the wakeup timer for future-scheduled jobs.
 *
 * Responsibilities:
 * - Load all jobs and filter to those ready to run (pending + runAt ≤ now)
 * - Clean up TTL-expired jobs before each batch
 * - Defer jobs that require network when offline (reschedule +5s)
 * - Sort by priority (high → normal → low) then by runAt
 * - Enforce global and per-type concurrency limits
 * - Schedule a wakeup timer for the next future-dated job
 *
 * Does NOT:
 * - Execute jobs (that's JobExecutor)
 * - Validate or build job records (that's JobBuilder)
 * - Register handlers (that's HandlerRegistry)
 * - Own the storage adapters (that's StorageAdapterRouter)
 */

import { logger } from '@/lib/utils/logger';
import { formatDelay } from '@/pure-algo-immutables/backoff';
import { NetworkDetection } from '@/system/Network/network-detection';
import type { JobRecord } from '@/type-definitions/job-queue-types';
import type { JobExecutor } from './job-executor';
import type { StorageAdapterRouter } from './storage-adapter-router';

export interface SchedulerConfig {
  batchSize: number;
  concurrency: number;
  concurrencyPerType: Record<string, number>;
  enableAutoCleanup: boolean;
}

export class JobScheduler {
  private scheduledJobTimer: ReturnType<typeof setTimeout> | null = null;
  private nextScheduledTime: number = Infinity;
  private runningJobs: Map<string, Promise<void>> = new Map();
  private activeCounts: Map<string, number> = new Map();

  constructor(
    private router: StorageAdapterRouter,
    private executor: JobExecutor,
    private config: SchedulerConfig,
  ) {}

  /**
   * Run the next available batch of jobs.
   *
   * Flow:
   * 1. Load all jobs from storage
   * 2. Auto-cleanup expired jobs (if enabled)
   * 3. Filter pending jobs ready to run; sort by priority then runAt
   * 4. Split into to-process vs. to-defer (offline + network-required)
   * 5. Reschedule deferred jobs
   * 6. Dispatch batch respecting global + per-type concurrency
   * 7. Schedule wakeup timer for next future job
   *
   * @returns Number of jobs dispatched
   */
  async runBatch(): Promise<number> {
    try {
      const allJobs = await this.router.getAllJobs();

      // Auto-cleanup: remove expired jobs before processing
      if (this.config.enableAutoCleanup) {
        const now = Date.now();
        for (const job of allJobs.filter(j => j.expiresAt && j.expiresAt <= now)) {
          const adapter = await this.router.getAdapterForJob(job.sensitive);
          await adapter.delete(job.id);
          logger.category('jobs').debug(
            `Cleaned up expired job ${job.id} (${job.type}, expired ${new Date(job.expiresAt!).toISOString()})`,
          );
        }
      }

      const isOnline = NetworkDetection.getStatus()?.isOnline ?? true;

      // Filter pending jobs ready to run, sorted by priority then runAt
      const pendingReady = allJobs
        .filter(job => job.status === 'pending' && job.runAt <= Date.now())
        .sort((a, b) => {
          const order = { high: 0, normal: 1, low: 2 };
          const pa = order[a.priority ?? 'normal'];
          const pb = order[b.priority ?? 'normal'];
          return pa !== pb ? pa - pb : a.runAt - b.runAt;
        });

      // Split: jobs that can run now vs. jobs to defer (need network, but offline)
      const toProcess: JobRecord[] = [];
      const toDefer: JobRecord[] = [];

      for (const job of pendingReady) {
        const rn = job.requiresNetwork ?? false;
        if ((rn === true || rn === 'defer') && !isOnline) {
          toDefer.push(job);
        } else {
          toProcess.push(job);
        }
      }

      // Reschedule deferred jobs (+5s to avoid tight retry loops while offline)
      for (const job of toDefer) {
        job.runAt = Date.now() + 5000;
        const adapter = await this.router.getAdapterForJob(job.sensitive);
        await adapter.set(job);
        logger.category('jobs').debug(
          `Job ${job.id} deferred (${job.requiresNetwork === true ? 'requires-network' : 'hybrid'}, offline)`,
        );
      }

      const batch = toProcess.slice(0, this.config.batchSize);

      if (batch.length === 0) {
        if (toDefer.length > 0 && !isOnline) {
          logger.category('jobs').debug(`${toDefer.length} jobs deferred (waiting for network)`);
        } else {
          logger.category('jobs').debug('No pending jobs ready to run');
        }
        this.scheduleNextJobWakeup(allJobs);
        return 0;
      }

      logger.category('jobs').debug(
        `Processing batch of ${batch.length} jobs (${this.runningJobs.size} running, ${toDefer.length} deferred)`,
      );

      let processedCount = 0;

      for (const job of batch) {
        // Global concurrency check
        if (this.config.concurrency > 0 && this.runningJobs.size >= this.config.concurrency) {
          logger.category('jobs').debug(`Global concurrency limit reached (${this.config.concurrency})`);
          break;
        }

        // Per-type concurrency check
        const typeLimit = this.config.concurrencyPerType?.[job.type] ?? this.config.concurrency;
        const typeCount = this.activeCounts.get(job.type) ?? 0;
        if (typeLimit > 0 && typeCount >= typeLimit) {
          logger.category('jobs').debug(
            `Per-type concurrency limit reached for ${job.type} (${typeLimit})`,
          );
          continue;
        }

        // Dispatch job execution
        const jobPromise = this.executor.execute(job).finally(() => {
          this.runningJobs.delete(job.id);
          const next = (this.activeCounts.get(job.type) ?? 1) - 1;
          if (next > 0) this.activeCounts.set(job.type, next);
          else this.activeCounts.delete(job.type);
        });

        this.runningJobs.set(job.id, jobPromise);
        this.activeCounts.set(job.type, typeCount + 1);
        processedCount++;
      }

      this.scheduleNextJobWakeup(allJobs);
      return processedCount;
    } catch (error) {
      logger.category('jobs').error(`Error running batch: ${error}`);
      return 0;
    }
  }

  /**
   * Set a wakeup timer to fire when the next future-scheduled job becomes ready.
   * Prevents scheduled jobs from stalling indefinitely while the queue is idle.
   */
  scheduleNextJobWakeup(jobs: JobRecord[]): void {
    const now = Date.now();
    let nextJobTime = Infinity;

    for (const job of jobs) {
      if (job.status === 'pending' && job.runAt > now && job.runAt < nextJobTime) {
        nextJobTime = job.runAt;
      }
    }

    if (nextJobTime === Infinity) {
      if (this.scheduledJobTimer !== null) {
        clearTimeout(this.scheduledJobTimer);
        this.scheduledJobTimer = null;
        this.nextScheduledTime = Infinity;
        logger.category('jobs').debug('Cleared scheduled job timer (no pending jobs)');
      }
      return;
    }

    // Already have a timer set for this exact time — nothing to do
    if (this.nextScheduledTime === nextJobTime) return;

    if (this.scheduledJobTimer !== null) clearTimeout(this.scheduledJobTimer);

    const delayMs = Math.max(0, nextJobTime - now);
    this.nextScheduledTime = nextJobTime;

    logger.category('jobs').debug('Scheduled job timer set', {
      delay: formatDelay(delayMs),
      nextJobTime: new Date(nextJobTime).toISOString(),
    });

    this.scheduledJobTimer = setTimeout(() => {
      this.scheduledJobTimer = null;
      this.nextScheduledTime = Infinity;
      logger.category('jobs').debug('Scheduled job timer fired: processing queue');
      this.runBatch().catch(err =>
        logger.category('jobs').warn('Error processing jobs after timer wakeup', err),
      );
    }, delayMs);
  }

  /**
   * Cancel the scheduled wakeup timer. Called during queue destroy.
   */
  clearScheduledJobTimer(): void {
    if (this.scheduledJobTimer !== null) {
      clearTimeout(this.scheduledJobTimer);
      this.scheduledJobTimer = null;
      this.nextScheduledTime = Infinity;
      logger.category('jobs').debug('Cleared scheduled job timer');
    }
  }
}
