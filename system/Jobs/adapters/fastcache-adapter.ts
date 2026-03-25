/**
 * FastCache Storage Adapter for Job Queue
 *
 * Persists job records to FastCache (ephemeral, non-sensitive storage).
 * Suitable for jobs that don't involve PII, auth tokens, or sensitive data.
 *
 * Usage:
 * ```ts
 * const adapter = new FastCacheAdapter();
 * const queue = new BackgroundJobQueue({ storageAdapter: adapter });
 * ```
 */

import { logger } from "@/lib/utils/logger";
import { FastCache } from "@/system/Storage/cache/FastCache";
import { JobRecord, StorageAdapter } from "@/type-definitions/job-queue-types";

const JOB_QUEUE_KEY_PREFIX = "job_queue:";
const JOBS_INDEX_KEY = "job_queue:index";

/**
 * FastCache adapter for storing job records
 */
export class FastCacheAdapter implements StorageAdapter {
  private readonly prefix: string;

  constructor(prefix: string = JOB_QUEUE_KEY_PREFIX) {
    this.prefix = prefix;
  }

  /**
   * Retrieve all job records from FastCache
   */
  async getAll(): Promise<JobRecord[]> {
    try {
      const indexStr = await FastCache.getItem(JOBS_INDEX_KEY);
      if (!indexStr) {
        return [];
      }

      const jobIds: string[] = JSON.parse(indexStr);
      const jobs: JobRecord[] = [];

      for (const jobId of jobIds) {
        const job = await this.get(jobId);
        if (job) {
          jobs.push(job);
        }
      }

      return jobs;
    } catch (error) {
      logger.category("jobs").error(`Failed to retrieve all jobs: ${error}`);
      return [];
    }
  }

  /**
   * Retrieve a single job by ID
   */
  async get(id: string): Promise<JobRecord | null> {
    try {
      const key = `${this.prefix}${id}`;
      const jobStr = await FastCache.getItem(key);

      if (!jobStr) {
        return null;
      }

      const job = JSON.parse(jobStr) as JobRecord;

      // Validate job structure
      if (!this.validateJobRecord(job)) {
        logger
          .category("jobs")
          .warn(`Invalid job record loaded from cache: ${id}`);
        // Optionally delete the corrupted record
        await this.delete(id);
        return null;
      }

      return job;
    } catch (error) {
      logger.category("jobs").error(`Failed to retrieve job ${id}: ${error}`);
      return null;
    }
  }

  /**
   * Store or update a job record
   */
  async set(record: JobRecord): Promise<void> {
    try {
      // Validate before storing
      if (!this.validateJobRecord(record)) {
        throw new Error(`Invalid job record: ${JSON.stringify(record)}`);
      }

      const key = `${this.prefix}${record.id}`;

      // Store the job
      await FastCache.setItem(key, JSON.stringify(record));

      // Update index
      await this.addToIndex(record.id);

      logger
        .category("jobs")
        .debug(`Stored job ${record.id} (type: ${record.type})`);
    } catch (error) {
      logger.category("jobs").error(`Failed to store job: ${error}`);
      throw error;
    }
  }

  /**
   * Delete a job record by ID
   */
  async delete(id: string): Promise<void> {
    try {
      const key = `${this.prefix}${id}`;
      await FastCache.removeItem(key);

      // Remove from index
      await this.removeFromIndex(id);

      logger.category("jobs").debug(`Deleted job ${id}`);
    } catch (error) {
      logger.category("jobs").error(`Failed to delete job ${id}: ${error}`);
      throw error;
    }
  }

  /**
   * Delete all jobs of a specific type
   */
  async deleteByType(type: string): Promise<void> {
    try {
      const allJobs = await this.getAll();
      const jobsToDelete = allJobs.filter((job) => job.type === type);

      for (const job of jobsToDelete) {
        await this.delete(job.id);
      }

      logger
        .category("jobs")
        .debug(`Deleted ${jobsToDelete.length} jobs of type ${type}`);
    } catch (error) {
      logger
        .category("jobs")
        .error(`Failed to delete jobs by type ${type}: ${error}`);
      throw error;
    }
  }

  /**
   * Get current storage usage and quota (best effort, may return null)
   */
  async getQuotaInfo(): Promise<{
    usedBytes: number;
    quotaBytes: number;
    percentUsed: number;
  } | null> {
    try {
      // FastCache doesn't expose quota info directly; estimate from storage size
      const allJobs = await this.getAll();
      const usedBytes = JSON.stringify(allJobs).length;

      // Rough estimate: assume 10MB quota for FastCache on most platforms
      const quotaBytes = 10 * 1024 * 1024;

      return {
        usedBytes,
        quotaBytes,
        percentUsed: (usedBytes / quotaBytes) * 100,
      };
    } catch (error) {
      logger.category("jobs").warn(`Failed to get quota info: ${error}`);
      return null;
    }
  }

  /**
   * Validate job record structure
   */
  private validateJobRecord(job: any): boolean {
    if (!job || typeof job !== "object") return false;

    const requiredFields = [
      "id",
      "type",
      "payload",
      "status",
      "retryCount",
      "maxRetries",
      "backoffMs",
      "runAt",
      "createdAt",
    ];

    for (const field of requiredFields) {
      if (!(field in job)) return false;
    }

    // Validate status enum
    const validStatuses = ["pending", "running", "completed", "failed"];
    if (!validStatuses.includes(job.status)) return false;

    // Validate numeric fields
    if (
      typeof job.retryCount !== "number" ||
      typeof job.maxRetries !== "number" ||
      typeof job.backoffMs !== "number" ||
      typeof job.runAt !== "number" ||
      typeof job.createdAt !== "number"
    ) {
      return false;
    }

    return true;
  }

  /**
   * Add job ID to the index (internal)
   */
  private async addToIndex(jobId: string): Promise<void> {
    try {
      const indexStr = await FastCache.getItem(JOBS_INDEX_KEY);
      const jobIds: string[] = indexStr ? JSON.parse(indexStr) : [];

      if (!jobIds.includes(jobId)) {
        jobIds.push(jobId);
        await FastCache.setItem(JOBS_INDEX_KEY, JSON.stringify(jobIds));
      }
    } catch (error) {
      logger.category("jobs").warn(`Failed to update index: ${error}`);
    }
  }

  /**
   * Remove job ID from the index (internal)
   */
  private async removeFromIndex(jobId: string): Promise<void> {
    try {
      const indexStr = await FastCache.getItem(JOBS_INDEX_KEY);
      if (!indexStr) return;

      const jobIds: string[] = JSON.parse(indexStr);
      const filtered = jobIds.filter((id) => id !== jobId);

      await FastCache.setItem(JOBS_INDEX_KEY, JSON.stringify(filtered));
    } catch (error) {
      logger
        .category("jobs")
        .warn(`Failed to update index on delete: ${error}`);
    }
  }
}
