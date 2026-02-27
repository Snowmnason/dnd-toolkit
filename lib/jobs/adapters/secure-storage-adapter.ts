/**
 * SecureStorageAdapter – StorageAdapter implementation using SecureStorage
 *
 * Use this adapter for sensitive job types that include:
 * - Authentication tokens or secrets
 * - Personally identifiable information (PII)
 * - Encryption keys or sensitive configuration
 * - Any data that must remain encrypted at rest
 *
 * Jobs stored with this adapter are encrypted via AES-CTR on all platforms
 * (web, iOS, Android, desktop).
 *
 * Performance Note:
 * SecureStorage has higher latency than FastCache due to encryption/decryption.
 * Suitable for background jobs but not for high-frequency polling.
 * Consider batch operations to amortize overhead.
 */

import { SecureStorage } from "@/lib/storage";
import { logger } from "@/lib/utils/logger";

import type { JobRecord, StorageAdapter } from "../../../type-definitions/job-queue-types";

/**
 * Storage namespace for secure job queue
 * Follows STORAGE_KEYS naming convention: dnd:module:feature
 */
const SECURE_STORAGE_NAMESPACE = "dnd:jobs:secure";

/**
 * Builds a namespaced storage key for a given job ID
 */
function buildJobKey(jobId: string): string {
  return `${SECURE_STORAGE_NAMESPACE}:${jobId}`;
}

/**
 * Builds the key for the job index (list of all job IDs)
 */
function buildIndexKey(): string {
  return `${SECURE_STORAGE_NAMESPACE}:index`;
}

/**
 * SecureStorageAdapter persists jobs to encrypted storage.
 * All data is encrypted at rest; decryption happens on read.
 *
 * Use cases:
 * - Background jobs that involve auth tokens, PII, or secrets
 * - Compliance-sensitive operations where data must be encrypted
 * - Any job payload that shouldn't be readable from unencrypted storage dumps
 *
 * Limitations:
 * - Higher latency than FastCacheAdapter (encryption/decryption overhead)
 * - Not suitable for very high-frequency job processing
 * - Encryption key derivation happens per read/write (consider caching if needed)
 */
export class SecureStorageAdapter implements StorageAdapter {
  private readonly log = logger.category("jobs");

  /**
   * Retrieve all jobs from secure storage
   * @returns Array of all persisted job records
   */
  async getAll(): Promise<JobRecord[]> {
    try {
      const indexKey = buildIndexKey();
      const indexJson = await SecureStorage.getItem(indexKey);

      if (!indexJson) {
        return [];
      }

      let jobIds: string[] = [];
      try {
        jobIds = JSON.parse(indexJson);
      } catch {
        this.log.warn("SecureStorageAdapter", "Corrupted job index, resetting");
        await SecureStorage.removeItem(indexKey);
        return [];
      }

      const jobs: JobRecord[] = [];

      for (const jobId of jobIds) {
        const job = await this.get(jobId);
        if (job) {
          jobs.push(job);
        }
      }

      return jobs;
    } catch (error) {
      this.log.error(
        "SecureStorageAdapter",
        `Failed to fetch all jobs: ${error}`,
      );
      return [];
    }
  }

  /**
   * Retrieve a single job by ID
   * @param id Job ID
   * @returns JobRecord if found, null otherwise
   */
  async get(id: string): Promise<JobRecord | null> {
    try {
      const key = buildJobKey(id);
      const json = await SecureStorage.getItem(key);

      if (!json) {
        return null;
      }

      const record = JSON.parse(json) as JobRecord;

      // Validate structure (basic check)
      if (!record.id || !record.type || !record.status) {
        this.log.warn(
          "SecureStorageAdapter",
          `Job ${id} missing required fields, discarding`,
        );
        await this.delete(id);
        return null;
      }

      return record;
    } catch (error) {
      this.log.error(
        "SecureStorageAdapter",
        `Failed to get job ${id}: ${error}`,
      );
      return null;
    }
  }

  /**
   * Persist a job record to secure storage
   * @param record JobRecord to persist
   */
  async set(record: JobRecord): Promise<void> {
    try {
      // Validate record structure
      if (!record.id || !record.type || !record.status) {
        throw new Error("Job record missing required fields");
      }

      const key = buildJobKey(record.id);
      const json = JSON.stringify(record);

      // Persist the job
      await SecureStorage.setItem(key, json);

      // Update the index
      const indexKey = buildIndexKey();
      const indexJson = await SecureStorage.getItem(indexKey);

      let jobIds: string[] = [];
      if (indexJson) {
        try {
          jobIds = JSON.parse(indexJson);
        } catch {
          jobIds = [];
        }
      }

      if (!jobIds.includes(record.id)) {
        jobIds.push(record.id);
        await SecureStorage.setItem(indexKey, JSON.stringify(jobIds));
      }
    } catch (error) {
      this.log.error(
        "SecureStorageAdapter",
        `Failed to set job ${record.id}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Delete a single job from secure storage
   * @param id Job ID
   */
  async delete(id: string): Promise<void> {
    try {
      const key = buildJobKey(id);
      await SecureStorage.removeItem(key);

      // Update index
      const indexKey = buildIndexKey();
      const indexJson = await SecureStorage.getItem(indexKey);

      if (indexJson) {
        try {
          let jobIds: string[] = JSON.parse(indexJson);
          jobIds = jobIds.filter((jid) => jid !== id);
          if (jobIds.length > 0) {
            await SecureStorage.setItem(indexKey, JSON.stringify(jobIds));
          } else {
            await SecureStorage.removeItem(indexKey);
          }
        } catch (error) {
          this.log.warn(
            "SecureStorageAdapter",
            `Failed to update index on delete: ${error}`,
          );
        }
      }
    } catch (error) {
      this.log.error(
        "SecureStorageAdapter",
        `Failed to delete job ${id}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Delete all jobs of a specific type
   * @param type Job type to delete
   */
  async deleteByType(type: string): Promise<void> {
    try {
      const jobs = await this.getAll();
      const jobsToDelete = jobs.filter((job) => job.type === type);

      for (const job of jobsToDelete) {
        await this.delete(job.id);
      }
    } catch (error) {
      this.log.error(
        "SecureStorageAdapter",
        `Failed to delete jobs of type ${type}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Get storage quota information for diagnostics
   * SecureStorage doesn't expose quota directly; return estimated usage
   * @returns Quota info with estimated current usage and limit, or null on error
   */
  async getQuotaInfo(): Promise<{
    usedBytes: number;
    quotaBytes: number;
    percentUsed: number;
  } | null> {
    try {
      const jobs = await this.getAll();

      // Estimate total size from all job records
      let usedBytes = 0;
      for (const job of jobs) {
        const json = JSON.stringify(job);
        usedBytes += json.length;
      }

      // SecureStorage on most platforms has generous limits; estimate 50MB for web/native
      const quotaBytes = 50 * 1024 * 1024; // 50MB estimated limit

      return {
        usedBytes,
        quotaBytes,
        percentUsed: (usedBytes / quotaBytes) * 100,
      };
    } catch (error) {
      this.log.error(
        "SecureStorageAdapter",
        `Failed to get quota info: ${error}`,
      );
      return null;
    }
  }
}
