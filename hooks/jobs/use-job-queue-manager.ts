/**
 * useJobQueueManager Hook
 *
 * Simple React hook for accessing and managing the singleton BackgroundJobQueue
 * during app lifecycle. Provides convenient access to common queue operations.
 *
 * Usage:
 * ```tsx
 * export function MyComponent() {
 *   const { queue, isInitialized } = useJobQueueManager();
 *
 *   const handleEnqueue = async () => {
 *     const jobId = await queue?.enqueue({
 *       type: 'my_job',
 *       payload: { data: 'test' },
 *       priority: 'high',
 *     });
 *     console.log('Enqueued job:', jobId);
 *   };
 *
 *   if (!isInitialized) {
 *     return <div>Initializing queue...</div>;
 *   }
 *
 *   return <button onClick={handleEnqueue}>Enqueue Job</button>;
 * }
 * ```
 */

import { JobsManager } from "@/lib/jobs";
import type { EnqueueOptions, JobRecord } from "@/type-definitions/job-queue-types";
import { useCallback } from "react";

/**
 * Hook for accessing the BackgroundJobQueue singleton
 *
 * @returns Object containing:
 *   - `queue`: The singleton BackgroundJobQueue instance
 *   - `isInitialized`: Whether the queue has been initialized
 *   - Helper methods for common operations
 */
export function useJobQueueManager() {
  const isInitialized = true; // Initialized during sync-phase bootstrap

  /**
   * Enqueue a new job
   */
  const enqueue = useCallback(
    async (options: EnqueueOptions): Promise<string> => {
      return JobsManager.enqueue(options);
    },
    [],
  );

  /**
   * Get status of a specific job
   */
  const getStatus = useCallback(
    async (jobId: string): Promise<JobRecord | null> => {
      return JobsManager.getJob(jobId);
    },
    [],
  );

  /**
   * Cancel a pending job (only works for pending jobs, not running/completed)
   */
  const cancel = useCallback(
    async (jobId: string): Promise<boolean> => {
      return JobsManager.cancel(jobId);
    },
    [],
  );

  /**
   * Get all jobs of a specific type
   */
  const getJobs = useCallback(
    async (type: string): Promise<JobRecord[]> => {
      return JobsManager.getJobs(type);
    },
    [],
  );

  /**
   * Get count of jobs by status
   * If status is omitted, returns total count of all jobs
   */
  const getJobCount = useCallback(
    async (status?: JobRecord['status']): Promise<number> => {
      const jobs = await JobsManager.getJobs(undefined, status);
      return jobs.length;
    },
    [],
  );

  /**
   * Clear all jobs of a specific type
   */
  const clearByType = useCallback(
    async (type: string): Promise<number> => {
      return JobsManager.clearByType(type);
    },
    [],
  );

  /**
   * Subscribe to job events
   */
  const subscribe = useCallback((callback: any) => {
    return JobsManager.subscribe(callback);
  }, []);

  return {
    isInitialized,
    enqueue,
    getStatus,
    cancel,
    getJobs,
    getJobCount,
    clearByType,
    subscribe,
  };
}
