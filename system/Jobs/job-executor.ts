/**
 * Job Executor
 *
 * Executes a single job: invokes handler, handles success/failure, manages retries.
 * Isolated from queue orchestration — knows nothing about batching, network state,
 * or concurrency. It only knows how to run one job and report the outcome.
 *
 * Responsibilities:
 * - Set job status to "running" before execution
 * - Invoke the registered handler with payload + context
 * - On success: mark completed, set TTL expiry
 * - On failure: classify as retryable or permanent
 *   - Retryable: increment retryCount, schedule backoff, emit retry event
 *   - Permanent: mark failed, emit failed event
 * - Always persists job state changes to the correct storage adapter
 */

import { logger } from '@/lib/utils/logger';
import { calculateNextRetryTime, formatDelay, isRetryable } from '@/pure-algo-immutables/backoff';
import type {
    JobCompletedEvent,
    JobFailedEvent,
    JobHandlerContext,
    JobRecord,
} from '@/type-definitions/job-queue-types';
import type { HandlerRegistry } from './handler-registry';
import type { StorageAdapterRouter } from './storage-adapter-router';

export class JobExecutor {
  constructor(
    private registry: HandlerRegistry,
    private router: StorageAdapterRouter,
    private emitEvent: (event: JobCompletedEvent | JobFailedEvent) => void,
  ) {}

  /**
   * Execute a single job through its full lifecycle:
   * pending → running → completed | retry | failed
   */
  async execute(job: JobRecord): Promise<void> {
    const startTime = Date.now();
    const adapter = await this.router.getAdapterForJob(job.sensitive);

    try {
      // Transition to running
      job.status = 'running';
      job.startedAt = startTime;
      await adapter.set(job);

      logger.category('jobs').info(
        `Starting job ${job.id} (type: ${job.type}, retry: ${job.retryCount}/${job.maxRetries})`,
      );

      const handler = this.registry.get(job.type);
      if (!handler) {
        throw new Error(`No handler registered for job type: ${job.type}`);
      }

      const context: JobHandlerContext = {
        jobId: job.id,
        retryCount: job.retryCount,
      };

      const result = await handler(job.payload, context);

      // Success path
      const durationMs = Date.now() - startTime;
      job.status = 'completed';
      job.completedAt = Date.now();
      job.result = result;

      if (job.ttlMs && job.ttlMs > 0) {
        job.expiresAt = job.completedAt + job.ttlMs;
      }

      await adapter.set(job);

      logger.category('jobs').info(
        `Job ${job.id} completed in ${formatDelay(durationMs)} (${job.type})`,
      );

      this.emitEvent({
        jobId: job.id,
        type: job.type,
        result,
        durationMs,
      } as JobCompletedEvent);
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMsg = String(error);
      const retryable = isRetryable(error);

      logger.category('jobs').warn(
        `Job ${job.id} failed (${formatDelay(durationMs)}): ${errorMsg} [retryable: ${retryable}]`,
      );

      if (retryable && job.retryCount < job.maxRetries) {
        // Retry path: reschedule with exponential backoff
        job.retryCount++;
        job.lastError = errorMsg;
        job.status = 'pending';
        job.startedAt = undefined;
        job.runAt = calculateNextRetryTime(job.retryCount - 1, job.backoffMs);

        await adapter.set(job);

        const nextRetryDelay = job.runAt - Date.now();
        logger.category('jobs').info(
          `Job ${job.id} scheduled for retry ${job.retryCount}/${job.maxRetries} in ${formatDelay(nextRetryDelay)}`,
        );

        this.emitEvent({
          jobId: job.id,
          type: job.type,
          error: errorMsg,
          retryCount: job.retryCount,
          retryable: true,
          nextRetryAt: job.runAt,
        } as JobFailedEvent);
      } else {
        // Permanent failure path
        job.status = 'failed';
        job.lastError = errorMsg;
        job.completedAt = Date.now();
        job.startedAt = undefined;

        if (job.ttlMs && job.ttlMs > 0) {
          job.expiresAt = job.completedAt + job.ttlMs;
        }

        await adapter.set(job);

        logger.category('jobs').error(
          `Job ${job.id} failed permanently after ${job.retryCount} retries`,
        );

        this.emitEvent({
          jobId: job.id,
          type: job.type,
          error: errorMsg,
          retryCount: job.retryCount,
          retryable: false,
        } as JobFailedEvent);
      }
    }
  }
}
