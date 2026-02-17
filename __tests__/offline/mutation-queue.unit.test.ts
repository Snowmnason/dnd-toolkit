/* eslint-disable security/detect-object-injection */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OfflineMutationQueue } from "@/lib/offline/mutation-queue";

// Mocks for external dependencies
vi.mock("@/lib/storage", () => {
  const store: Record<string, any> = {};
  return {
    SecureStorage: {
      getJSON: vi.fn(async (key: string) => store[key] ?? null),
      setJSON: vi.fn(async (key: string, value: any) => {
        store[key] = value;
      }),
      removeItem: vi.fn(async (key: string) => {
        delete store[key];
      }),
    },
    STORAGE_KEYS: {
      OFFLINE_MUTATION_QUEUE: "dnd:offline:mutation_queue",
    },
  };
});

vi.mock("@/lib/offline/offline-recovery", () => ({
  BackoffScheduler: {
    calculateNextAttemptAt: vi.fn((m: any) => Date.now() + 1000),
    filterReadyMutations: vi.fn((queue: any[]) => queue.filter(() => true)),
  },
  OfflineQueueStatsCollector: { collectStats: vi.fn(() => ({})) },
  Phase4Enhancements: { prepareForQueue: vi.fn(async (m: any) => m) },
}));

describe("OfflineMutationQueue (unit)", () => {
  beforeEach(async () => {
    // Ensure queue is cleared between tests
    await OfflineMutationQueue.clear();
  });

  it("enqueue persists and increases size", async () => {
    const queued = await OfflineMutationQueue.enqueue({
      operation: "create",
      table: "characters",
      payload: { name: "Bob" },
    } as any);

    expect(queued).toHaveProperty("id");
    expect(OfflineMutationQueue.size()).toBe(1);

    const all = await OfflineMutationQueue.getAll();
    expect(all.length).toBe(1);
    expect(all[0].table).toBe("characters");
  });

  it("peek returns FIFO order", async () => {
    const a = await OfflineMutationQueue.enqueue({
      operation: "create",
      table: "t1",
      payload: { v: 1 },
    } as any);

    // small delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 5));

    const b = await OfflineMutationQueue.enqueue({
      operation: "update",
      table: "t2",
      payload: { v: 2 },
    } as any);

    const peeked = await OfflineMutationQueue.peek(2);
    expect(peeked[0].id).toBe(a.id);
    expect(peeked[1].id).toBe(b.id);
  });

  it("markFailed increments retryCount and sets nextAttemptAt", async () => {
    const q = await OfflineMutationQueue.enqueue({
      operation: "delete",
      table: "t3",
      payload: {},
    } as any);

    await OfflineMutationQueue.markFailed(q.id, "network error", "network");

    const updated = OfflineMutationQueue.getMutation(q.id)!;
    expect(updated.retryCount).toBe(1);
    expect(updated.nextAttemptAt).toBeGreaterThan(Date.now() - 100);
  });

  it("remove and discard modify the queue", async () => {
    const q1 = await OfflineMutationQueue.enqueue({ operation: "c", table: "a", payload: {} } as any);
    const q2 = await OfflineMutationQueue.enqueue({ operation: "c", table: "b", payload: {} } as any);

    expect(OfflineMutationQueue.size()).toBe(2);

    await OfflineMutationQueue.remove([q1.id]);
    expect(OfflineMutationQueue.size()).toBe(1);

    await OfflineMutationQueue.discard(q2.id, "test discard");
    expect(OfflineMutationQueue.size()).toBe(0);
  });

  it("getReadyBatch respects BackoffScheduler.filterReadyMutations", async () => {
    // Enqueue 3 items
    const items = [];
    for (let i = 0; i < 3; i++) {
      items.push(await OfflineMutationQueue.enqueue({ operation: "c", table: `t${i}`, payload: {} } as any));
    }

    // Mock filterReadyMutations to only return the first two
    const { BackoffScheduler } = await import("@/lib/offline/offline-recovery");
    (BackoffScheduler.filterReadyMutations as any).mockImplementation((queue: any[]) => queue.slice(0, 2));

    const ready = await OfflineMutationQueue.getReadyBatch(5);
    expect(ready.length).toBe(2);
    expect(ready[0].id).toBe(items[0].id);
  });
});
