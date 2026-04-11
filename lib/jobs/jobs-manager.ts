/**
 * Jobs Manager — Runtime Facade
 *
 * Purpose: Bridge between hooks/UI and the background job queue.
 * Does NOT handle job handler registration (that's sync-phase.ts responsibility).
 *
 * Responsibilities:
 * - Enqueue new jobs at runtime
 * - Query queue state for UI display (pending count, job status)
 * - Subscribe to job events for real-time UI updates
 * - Cancel pending jobs
 * - Clear jobs of a specific type
 *
 * Architecture:
 * Hooks → JobsManager → jobService (middleware) → getJobQueue() (system)
 *
 * Usage:
 * ```ts
 * // In a hook:
 * const { data, isLoading, error } = useEnqueueJob();
 * await JobsManager.enqueue({
 *   type: 'feature_flags_refresh',
 *   payload: { worldId },
 * });
 * ```
 */

import { executeSyncOperation, type SyncDirection, type SyncMode } from '@/lib/jobs/core/sync/sync-orchestrator';
import { logger } from '@/lib/utils/logger';
import { jobService } from '@/middleware/jobs/job-service';
import type { EnqueueOptions, JobEventSubscriber, JobRecord } from '@/type-definitions/job-queue-types';

export const JobsManager = {
  /**
   * Enqueue a new job to be processed
   *
   * @param options - Job enqueue options (type, payload, etc.)
   * @returns Job ID
   * @throws If payload exceeds size limit or storage fails
   *
   * @example
   * const jobId = await JobsManager.enqueue({
   *   type: 'sync_notes',
   *   payload: { worldId: 'w123' },
   *   idempotencyKey: 'sync:w123',
   *   requiresNetwork: 'defer',
   * });
   */
  async enqueue(options: EnqueueOptions): Promise<string> {
    try {
      const jobId = await jobService.enqueue(options);
      logger.category('jobs').debug(`Job enqueued: ${jobId} (type: ${options.type})`);
      return jobId;
    } catch (error) {
      logger.category('jobs').error(`Failed to enqueue job: ${error}`);
      throw error;
    }
  },

  /**
   * Get status of a specific job
   *
   * @param jobId - Job ID to query
   * @returns Job record or null if not found
   *
   * @example
   * const job = await JobsManager.getJob('job-123');
   * console.log(job?.status); // 'pending' | 'running' | 'completed' | 'failed'
   */
  async getJob(jobId: string): Promise<JobRecord | null> {
    try {
      return await jobService.getJob(jobId);
    } catch (error) {
      logger.category('jobs').error(`Failed to get job status: ${error}`);
      return null;
    }
  },

  /**
   * Get count of pending jobs
   *
   * @returns Number of jobs in 'pending' status
   *
   * @example
   * const pending = await JobsManager.getPendingCount();
   * console.log(`${pending} jobs waiting to run`);
   */
  async getPendingCount(): Promise<number> {
    try {
      return await jobService.getPendingCount();
    } catch (error) {
      logger.category('jobs').error(`Failed to get pending count: ${error}`);
      return 0;
    }
  },

  /**
   * Get all jobs of a specific type and status
   *
   * @param type - Job type to filter by (optional)
   * @param status - Job status to filter by (optional)
   * @returns Array of matching job records
   *
   * @example
   * const failedJobs = await JobsManager.getJobs('sync_notes', 'failed');
   */
  async getJobs(type?: string, status?: JobRecord['status']): Promise<JobRecord[]> {
    try {
      return await jobService.getJobs(type, status);
    } catch (error) {
      logger.category('jobs').error(`Failed to get jobs: ${error}`);
      return [];
    }
  },

  /**
   * Subscribe to job completion and failure events
   *
   * Useful for updating UI when jobs complete, fail, or are retried.
   * Returns unsubscribe function.
   *
   * @param subscriber - Callback fired on job events
   * @returns Unsubscribe function
   *
   * @example
   * const unsubscribe = JobsManager.subscribe((event) => {
   *   if (event.type === 'completed') {
   *     console.log(`Job ${event.jobId} completed`);
   *   }
   * });
   *
   * // Later:
   * unsubscribe();
   */
  subscribe(subscriber: JobEventSubscriber): () => void {
    try {
      return jobService.subscribe(subscriber);
    } catch (error) {
      logger.category('jobs').error(`Failed to subscribe to job events: ${error}`);
      return () => {};
    }
  },

  /**
   * Cancel a pending job
   *
   * Only succeeds if job is in 'pending' status.
   * Running or completed jobs cannot be cancelled.
   *
   * @param jobId - Job ID to cancel
   * @returns true if cancelled, false otherwise
   *
   * @example
   * const cancelled = await JobsManager.cancel('job-123');
   * if (cancelled) {
   *   console.log('Job cancelled');
   * } else {
   *   console.log('Job not found or not pending');
   * }
   */
  async cancel(jobId: string): Promise<boolean> {
    try {
      return await jobService.cancel(jobId);
    } catch (error) {
      logger.category('jobs').error(`Failed to cancel job: ${error}`);
      return false;
    }
  },

  /**
   * Clear all jobs of a specific type
   *
   * Deletes jobs regardless of status (pending, running, completed, failed).
   *
   * @param type - Job type to clear
   * @returns Number of jobs deleted
   *
   * @example
   * const deleted = await JobsManager.clearByType('sync_notes');
   * console.log(`Deleted ${deleted} jobs`);
   */
  async clearByType(type: string): Promise<number> {
    try {
      return await jobService.clearByType(type);
    } catch (error) {
      logger.category('jobs').error(`Failed to clear jobs by type: ${error}`);
      return 0;
    }
  },

  /**
   * Peek at the next pending job without executing it
   *
   * Useful for debugging or previewing which job will run next.
   *
   * @returns Next pending job or null if queue is empty
   *
   * @example
   * const next = await JobsManager.peekNext();
   * console.log(`Next job: ${next?.id} (type: ${next?.type})`);
   */
  async peekNext(): Promise<JobRecord | null> {
    try {
      return await jobService.peekNext();
    } catch (error) {
      logger.category('jobs').error(`Failed to peek next job: ${error}`);
      return null;
    }
  },

  /**
   * Perform a synchronization operation (central orchestration hub).
   *
   * Synchronous entry point for all sync operations:
   * - Auth systems (sign-in, re-auth, sign-out)
   * - Manual sync button (useForceResync)
   * - Background job handlers (queue execution)
   *
   * Delegates to the registered sync handler logic (executeSyncOperation).
   *
   * @param payload - Sync operation parameters (mode, direction, target)
   * @returns Results from the sync operation
   * @throws If sync fails
   *
   * @example
   * // From auth system:
   * const result = await JobsManager.performSync({ mode: 'automatic', direction: 'download' });
   * const worldIds = result.worlds?.worldIds || [];
   *
   * // From manual sync button:
   * await JobsManager.performSync({ mode: 'manual', direction: 'download' });
   * await JobsManager.performSync({ mode: 'manual', target: 'queue', direction: 'upload' });
   */
  async performSync(payload: {
    mode?: SyncMode;
    direction?: SyncDirection;
    target?: 'profile' | 'worlds' | 'queue';
  }): Promise<{ profile?: any; worlds?: any; queue?: any }> {
    try {
      logger.category('jobs').info(
        `Sync operation starting [${payload.mode || 'automatic'}/${payload.direction || 'download'}${payload.target ? `/${payload.target}` : ''}]`
      );

      const result = await executeSyncOperation(payload);

      logger.category('jobs').info('Sync operation completed successfully');
      return result;
    } catch (error) {
      logger.category('jobs').error('Sync operation failed:', error);
      throw error;
    }
  },
};
