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

import { getJobQueue } from "@/lib/jobs";
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
  const queue = getJobQueue();
  // Note: isInitialized is private on BackgroundJobQueue; assume initialized during app bootstrap
  const isInitialized = !!queue;

  /**
   * Enqueue a new job
   */
  const enqueue = useCallback(
    async (options: Parameters<typeof queue.enqueue>[0]): Promise<string> => {
      if (!queue) throw new Error("Job queue not available");
      return queue.enqueue(options);
    },
    [queue],
  );

  /**
   * Get status of a specific job
   */
  const getStatus = useCallback(
    async (jobId: string): Promise<ReturnType<typeof queue.getStatus>> => {
      if (!queue) throw new Error("Job queue not available");
      return queue.getStatus(jobId);
    },
    [queue],
  );

  /**
   * Cancel a pending job (only works for pending jobs, not running/completed)
   */
  const cancel = useCallback(
    async (jobId: string): Promise<boolean> => {
      if (!queue) throw new Error("Job queue not available");
      return queue.cancel(jobId);
    },
    [queue],
  );

  /**
   * Get all jobs of a specific type
   */
  const getJobs = useCallback(
    async (type: string): Promise<ReturnType<typeof queue.getJobs>> => {
      if (!queue) throw new Error("Job queue not available");
      return queue.getJobs(type);
    },
    [queue],
  );

  /**
   * Get count of jobs by status
   * If status is omitted, returns total count of all jobs
   */
  const getJobCount = useCallback(
    async (status?: Parameters<typeof queue.getJobs>[1]): Promise<number> => {
      if (!queue) throw new Error("Job queue not available");
      // Query all jobs (no type filter) and optionally filter by status
      const jobs = await queue.getJobs(undefined, status);
      return jobs.length;
    },
    [queue],
  );

  /**
   * Clear all jobs of a specific type
   */
  const clearByType = useCallback(
    async (type: string): Promise<number> => {
      if (!queue) throw new Error("Job queue not available");
      return queue.clearByType(type);
    },
    [queue],
  );

  /**
   * Run the next batch of jobs
   */
  const runNext = useCallback(async (): Promise<number> => {
    if (!queue) throw new Error("Job queue not available");
    return queue.runNext();
  }, [queue]);

  return {
    queue,
    isInitialized,
    enqueue,
    getStatus,
    cancel,
    getJobs,
    getJobCount,
    clearByType,
    runNext,
  };
}
