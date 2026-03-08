/**
 * Storage Adapter Router
 *
 * Routes job storage operations to the correct adapter based on sensitivity.
 * - Normal jobs → default adapter (FastCache)
 * - Sensitive jobs → secure adapter (SecureStorage)
 *
 * Both adapters are injected at construction time by the middleware layer
 * (lib/middleware/jobs/job-service.ts). This keeps system/Jobs app-agnostic —
 * it knows nothing about where the adapters come from.
 *
 * Responsibilities:
 * - Route get/set/delete to the correct adapter
 * - Merge and deduplicate jobs from both adapters for getAllJobs()
 */

import type { JobRecord, StorageAdapter } from '@/type-definitions/job-queue-types';

export class StorageAdapterRouter {
  constructor(
    private defaultAdapter: StorageAdapter,
    private secureAdapter: StorageAdapter | null = null,
  ) {}

  /**
   * Get the appropriate storage adapter for a job based on its sensitivity.
   * Falls back to defaultAdapter if no secureAdapter was injected.
   */
  async getAdapterForJob(sensitive?: boolean): Promise<StorageAdapter> {
    return sensitive && this.secureAdapter ? this.secureAdapter : this.defaultAdapter;
  }

  /**
   * Get all jobs from both adapters, merged and deduplicated by job ID
   */
  async getAllJobs(): Promise<JobRecord[]> {
    const defaultJobs = await this.defaultAdapter.getAll();

    if (!this.secureAdapter) {
      return defaultJobs;
    }

    const secureJobs = await this.secureAdapter.getAll();

    const jobMap = new Map<string, JobRecord>();
    for (const job of defaultJobs) jobMap.set(job.id, job);
    for (const job of secureJobs) jobMap.set(job.id, job);

    return Array.from(jobMap.values());
  }

  /**
   * Get a job by ID from either adapter (searches both).
   * Returns the first match found, prioritizing the adapter that contains it.
   */
  async getJob(jobId: string): Promise<JobRecord | null> {
    // Try default adapter first
    const job = await this.defaultAdapter.get(jobId);
    if (job) return job;

    // If not found and we have a secure adapter, try that
    if (this.secureAdapter) {
      return await this.secureAdapter.get(jobId);
    }

    return null;
  }

  /**
   * Delete all jobs of a given type from both adapters.
   * Clears the type from the default adapter and secure adapter (if present).
   */
  async deleteByType(type: string): Promise<void> {
    await this.defaultAdapter.deleteByType(type);
    if (this.secureAdapter) {
      await this.secureAdapter.deleteByType(type);
    }
  }
}
