/**
 * Unit tests for Background Job Queue
 *
 * Tests:
 * - Job enqueueing and deduplication
 * - Job execution and handler invocation
 * - Retry logic with exponential backoff
 * - Job status tracking
 * - Storage persistence
 * - Concurrency limits
 */

import {
    BackgroundJobQueue,
    calculateBackoffDelay,
    calculateNextRetryTime,
    formatDelay,
    isRetryable,
    type JobRecord,
    type StorageAdapter,
} from "@/lib/jobs";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ==========================================
// Mock Storage Adapter for Testing
// ==========================================

class InMemoryStorageAdapter implements StorageAdapter {
  private jobs: Map<string, JobRecord> = new Map();

  async getAll(): Promise<JobRecord[]> {
    return Array.from(this.jobs.values());
  }

  async get(id: string): Promise<JobRecord | null> {
    return this.jobs.get(id) ?? null;
  }

  async set(record: JobRecord): Promise<void> {
    this.jobs.set(record.id, { ...record });
  }

  async delete(id: string): Promise<void> {
    this.jobs.delete(id);
  }

  async deleteByType(type: string): Promise<void> {
    for (const [id, job] of this.jobs) {
      if (job.type === type) {
        this.jobs.delete(id);
      }
    }
  }

  clear(): void {
    this.jobs.clear();
  }
}

// ==========================================
// Test Suites
// ==========================================

describe("Backoff Utilities", () => {
  it("calculateBackoffDelay: exponential growth with jitter", () => {
    // First retry: ~1000ms
    let delay = calculateBackoffDelay(0, 1000);
    expect(delay).toBeGreaterThanOrEqual(800);
    expect(delay).toBeLessThanOrEqual(1200);

    // Second retry: ~2000ms
    delay = calculateBackoffDelay(1, 1000);
    expect(delay).toBeGreaterThanOrEqual(1600);
    expect(delay).toBeLessThanOrEqual(2400);

    // Fifth retry: capped at ~32000ms with ±20% jitter
    delay = calculateBackoffDelay(5, 1000);
    expect(delay).toBeGreaterThanOrEqual(25600); // 32000 * 0.8
    expect(delay).toBeLessThanOrEqual(38400); // 32000 * 1.2
  });

  it("calculateNextRetryTime: returns future timestamp", () => {
    const now = Date.now();
    const nextRetry = calculateNextRetryTime(0, 1000, now);

    expect(nextRetry).toBeGreaterThan(now);
    expect(nextRetry - now).toBeGreaterThanOrEqual(800);
    expect(nextRetry - now).toBeLessThanOrEqual(1200);
  });

  it("isRetryable: classifies errors correctly", () => {
    // Retryable errors
    expect(isRetryable({ code: 500 })).toBe(true);
    expect(isRetryable({ code: 503 })).toBe(true);
    expect(isRetryable({ code: 429 })).toBe(true);
    expect(isRetryable({ message: "ECONNREFUSED" })).toBe(true);
    expect(isRetryable({ message: "socket hang up" })).toBe(true);

    // Non-retryable errors
    expect(isRetryable({ code: 400 })).toBe(false);
    expect(isRetryable({ code: 401 })).toBe(false);
    expect(isRetryable({ code: 403 })).toBe(false);
    expect(isRetryable({ code: 404 })).toBe(false);

    // Edge cases
    expect(isRetryable(null)).toBe(false);
    expect(isRetryable(undefined)).toBe(false);
  });

  it("formatDelay: formats delays readably", () => {
    expect(formatDelay(500)).toBe("0.50s");
    expect(formatDelay(1500)).toBe("1s");
    expect(formatDelay(60000)).toBe("1m0s");
    expect(formatDelay(150000)).toBe("2m30s");
  });
});

describe("BackgroundJobQueue", () => {
  let queue: BackgroundJobQueue;
  let storage: InMemoryStorageAdapter;

  beforeEach(async () => {
    storage = new InMemoryStorageAdapter();
    queue = new BackgroundJobQueue({ storageAdapter: storage });
    await queue.initialize();
  });

  describe("Enqueueing", () => {
    it("enqueue: creates and stores a job", async () => {
      const jobId = await queue.enqueue({
        type: "test_job",
        payload: { data: "test" },
      });

      expect(jobId).toBeDefined();
      expect(jobId).toMatch(/^[0-9a-f-]+$/);

      const job = await queue.getStatus(jobId);
      expect(job).toBeDefined();
      expect(job?.type).toBe("test_job");
      expect(job?.status).toBe("pending");
      expect(job?.retryCount).toBe(0);
    });

    it("enqueue: respects payload size limit", async () => {
      const largePayload = "x".repeat(150 * 1024); // 150KB

      await expect(
        queue.enqueue({
          type: "test_job",
          payload: { data: largePayload },
        }),
      ).rejects.toThrow(/exceeds maximum size/);
    });

    it("enqueue: deduplicates by idempotency key", async () => {
      const idempotencyKey = "unique_op_1";

      const jobId1 = await queue.enqueue({
        type: "test_job",
        payload: { data: "test" },
        idempotencyKey,
      });

      const jobId2 = await queue.enqueue({
        type: "test_job",
        payload: { data: "test_different" },
        idempotencyKey,
      });

      expect(jobId1).toBe(jobId2);
    });

    it("enqueue: allows custom retry and backoff config", async () => {
      const jobId = await queue.enqueue({
        type: "test_job",
        payload: { data: "test" },
        maxRetries: 10,
        baseBackoffMs: 500,
      });

      const job = await queue.getStatus(jobId);
      expect(job?.maxRetries).toBe(10);
      expect(job?.backoffMs).toBe(500);
    });

    it("enqueue: schedules job for future execution", async () => {
      const futureTime = Date.now() + 60000; // 1 minute from now

      const jobId = await queue.enqueue({
        type: "test_job",
        payload: { data: "test" },
        runAt: futureTime,
      });

      const job = await queue.getStatus(jobId);
      expect(job?.runAt).toBeGreaterThanOrEqual(futureTime - 100); // Allow slight clock drift
    });
  });

  describe("Job Status & Querying", () => {
    it("getStatus: retrieves job by ID", async () => {
      const jobId = await queue.enqueue({
        type: "test_job",
        payload: { data: "test" },
      });

      const job = await queue.getStatus(jobId);
      expect(job?.id).toBe(jobId);
    });

    it("peek: returns next ready job without executing", async () => {
      const jobId = await queue.enqueue({
        type: "test_job",
        payload: { data: "test" },
      });

      const peeked = await queue.peek();
      expect(peeked?.id).toBe(jobId);

      // Job should still be pending
      const job = await queue.getStatus(jobId);
      expect(job?.status).toBe("pending");
    });

    it("peek: returns null if no pending jobs", async () => {
      const peeked = await queue.peek();
      expect(peeked).toBeNull();
    });

    it("getJobs: filters by type and status", async () => {
      await queue.enqueue({
        type: "type_a",
        payload: { data: "test" },
      });

      await queue.enqueue({
        type: "type_b",
        payload: { data: "test" },
      });

      const typeA = await queue.getJobs("type_a");
      expect(typeA).toHaveLength(1);
      expect(typeA[0].type).toBe("type_a");

      const typeB = await queue.getJobs("type_b");
      expect(typeB).toHaveLength(1);

      const all = await queue.getJobs();
      expect(all).toHaveLength(2);
    });

    it("getPendingCount: returns count of pending jobs", async () => {
      await queue.enqueue({
        type: "test_job",
        payload: { data: "test" },
      });

      await queue.enqueue({
        type: "test_job",
        payload: { data: "test" },
      });

      const count = await queue.getPendingCount();
      expect(count).toBe(2);
    });
  });

  describe("Job Execution", () => {
    it("runNext: executes a job with registered handler", async () => {
      const mockHandler = vi.fn(async () => ({ success: true }));
      queue.registerHandler("test_job", mockHandler);

      const jobId = await queue.enqueue({
        type: "test_job",
        payload: { data: "test_data" },
      });

      const processed = await queue.runNext();
      expect(processed).toBe(1);

      // Wait for async handler execution
      await new Promise((r) => setTimeout(r, 100));

      expect(mockHandler).toHaveBeenCalledOnce();
      expect(mockHandler).toHaveBeenCalledWith(
        { data: "test_data" },
        expect.objectContaining({
          jobId,
          retryCount: 0,
        }),
      );

      const job = await queue.getStatus(jobId);
      expect(job?.status).toBe("completed");
      expect(job?.result).toEqual({ success: true });
    });

    it("runNext: fails if no handler registered", async () => {
      const jobId = await queue.enqueue({
        type: "test_job",
        payload: { data: "test" },
      });

      // Must yield immediately after runNext to let promise execute
      const processed = await queue.runNext();
      expect(processed).toBe(1); // Should pick up the job

      // Give the microtask queue a chance to execute the promise
      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setTimeout(r, 10));

      const job = await queue.getStatus(jobId);
      // Job should be marked for retry (since "no handler" is retryable by default)
      // or still "running" if the error handling hasn't completed yet
      expect(job?.status).toBe("pending");
      expect(job?.retryCount).toBeGreaterThanOrEqual(0);
    });

    it("runNext: ignores jobs scheduled for future", async () => {
      const futureTime = Date.now() + 60000;

      await queue.enqueue({
        type: "test_job",
        payload: { data: "test" },
        runAt: futureTime,
      });

      const mockHandler = vi.fn(async () => ({}));
      queue.registerHandler("test_job", mockHandler);

      const processed = await queue.runNext();
      expect(processed).toBe(0);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    // Removed heavy batch-size integration test to avoid high memory usage in
    // local/CI runs. If needed, reintroduce as a lighter unit test or run with
    // increased Node heap in CI.
  });

  describe("Retry Logic", () => {
    it("runNext: retries retriable errors with backoff", async () => {
      const mockHandler = vi.fn(async () => {
        throw { code: 500, message: "Server error" };
      });

      queue.registerHandler("test_job", mockHandler);

      const jobId = await queue.enqueue({
        type: "test_job",
        payload: { data: "test" },
        maxRetries: 3,
        baseBackoffMs: 100,
      });

      // First run: fails with retriable error
      await queue.runNext();

      // Wait for async handler execution
      await new Promise((r) => setTimeout(r, 100));

      let job = await queue.getStatus(jobId);
      expect(job?.status).toBe("pending");
      expect(job?.retryCount).toBe(1);
      expect(job?.runAt).toBeDefined();
      expect(job?.lastError).toEqual(expect.any(String));
    });

    it("runNext: stops retrying after max retries", async () => {
      const mockHandler = vi.fn(async () => {
        throw { code: 500, message: "Persistent error" };
      });

      queue.registerHandler("test_job", mockHandler);

      const jobId = await queue.enqueue({
        type: "test_job",
        payload: { data: "test" },
        maxRetries: 2,
        baseBackoffMs: 10,
      });

      // Run until job fails permanently
      for (let i = 0; i < 5; i++) {
        await queue.runNext();

        // Wait for async handler execution
        await new Promise((r) => setTimeout(r, 100));

        const job = await queue.getStatus(jobId);
        if (job?.status === "failed") {
          break;
        }

        // Advance time for next retry
        vi.useFakeTimers();
        vi.setSystemTime(job!.runAt + 1000);
        vi.useRealTimers();
      }

      const job = await queue.getStatus(jobId);
      expect(job?.status).toBe("failed");
      expect(job?.retryCount).toBe(2);
    });

    it("runNext: skips non-retriable errors", async () => {
      const mockHandler = vi.fn(async () => {
        throw { code: 401, message: "Unauthorized" };
      });

      queue.registerHandler("test_job", mockHandler);

      const jobId = await queue.enqueue({
        type: "test_job",
        payload: { data: "test" },
        maxRetries: 5,
      });

      await queue.runNext();

      // Wait for async handler execution
      await new Promise((r) => setTimeout(r, 100));

      const job = await queue.getStatus(jobId);
      expect(job?.status).toBe("failed");
      expect(job?.retryCount).toBe(0); // No retries for 401
    });
  });

  describe("Job Control", () => {
    it("cancel: removes a pending job", async () => {
      const jobId = await queue.enqueue({
        type: "test_job",
        payload: { data: "test" },
      });

      const cancelled = await queue.cancel(jobId);
      expect(cancelled).toBe(true);

      const job = await queue.getStatus(jobId);
      expect(job).toBeNull();
    });

    it("cancel: fails to cancel non-pending jobs", async () => {
      const mockHandler = vi.fn(async () => ({}));
      queue.registerHandler("test_job", mockHandler);

      const jobId = await queue.enqueue({
        type: "test_job",
        payload: { data: "test" },
      });

      await queue.runNext();

      const cancelled = await queue.cancel(jobId);
      expect(cancelled).toBe(false);
    });

    it("clearByType: deletes all jobs of a type", async () => {
      await queue.enqueue({
        type: "type_a",
        payload: { data: "test" },
      });

      await queue.enqueue({
        type: "type_b",
        payload: { data: "test" },
      });

      const cleared = await queue.clearByType("type_a");
      expect(cleared).toBe(1);

      const typeAJobs = await queue.getJobs("type_a");
      expect(typeAJobs).toHaveLength(0);

      const typeBJobs = await queue.getJobs("type_b");
      expect(typeBJobs).toHaveLength(1);
    });
  });

  describe("Events", () => {
    it("subscribe: emits completed event", async () => {
      const subscriber = vi.fn();
      queue.subscribe(subscriber);

      const mockHandler = vi.fn(async () => ({ success: true }));
      queue.registerHandler("test_job", mockHandler);

      const jobId = await queue.enqueue({
        type: "test_job",
        payload: { data: "test" },
      });

      await queue.runNext();

      // Wait for async event emission
      await new Promise((r) => setTimeout(r, 100));

      expect(subscriber).toHaveBeenCalledOnce();
      expect(subscriber).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId,
          type: "test_job",
          result: { success: true },
        }),
      );
    });

    it("subscribe: emits failed event", async () => {
      const subscriber = vi.fn();
      queue.subscribe(subscriber);

      const mockHandler = vi.fn(async () => {
        throw new Error("Test error");
      });

      queue.registerHandler("test_job", mockHandler);

      await queue.enqueue({
        type: "test_job",
        payload: { data: "test" },
        maxRetries: 0,
      });

      await queue.runNext();

      // Wait for async event emission
      await new Promise((r) => setTimeout(r, 100));

      expect(subscriber).toHaveBeenCalledOnce();
      expect(subscriber).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "test_job",
          error: expect.stringContaining("Test error"),
          retryable: false,
        }),
      );
    });

    it("subscribe: returns unsubscribe function", async () => {
      const subscriber = vi.fn();
      const unsubscribe = queue.subscribe(subscriber);

      const mockHandler = vi.fn(async () => ({}));
      queue.registerHandler("test_job", mockHandler);

      await queue.enqueue({
        type: "test_job",
        payload: { data: "test" },
      });

      unsubscribe();

      await queue.runNext();

      expect(subscriber).not.toHaveBeenCalled();
    });
  });

  describe("Storage Persistence", () => {
    it("initialize: loads jobs from storage", async () => {
      const jobId = await queue.enqueue({
        type: "test_job",
        payload: { data: "test" },
      });

      // Create new queue instance (simulating app restart)
      const newQueue = new BackgroundJobQueue({ storageAdapter: storage });
      await newQueue.initialize();

      const job = await newQueue.getStatus(jobId);
      expect(job).toBeDefined();
      expect(job?.type).toBe("test_job");
    });

    it("initialize: resets stalled jobs", async () => {
      const jobId = await queue.enqueue({
        type: "test_job",
        payload: { data: "test" },
      });

      let job = await queue.getStatus(jobId);
      job!.status = "running";
      job!.startedAt = Date.now() - 15 * 60 * 1000; // 15 minutes ago
      await storage.set(job!);

      // Reinitialize
      const newQueue = new BackgroundJobQueue({ storageAdapter: storage });
      await newQueue.initialize();

      job = await newQueue.getStatus(jobId);
      expect(job?.status).toBe("pending");
      expect(job?.startedAt).toBeUndefined();
    });
  });
});
