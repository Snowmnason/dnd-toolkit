/* eslint-disable import/first */
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies used by sync-manager
vi.mock("@/lib/offline/mutation-queue", async () => {
  const mod = await vi.importActual<any>("@/lib/offline/mutation-queue");
  return {
    ...mod,
    OfflineMutationQueue: {
      initialize: vi.fn(async () => {}),
      getReadyBatch: vi.fn(async () => []),
      remove: vi.fn(async () => {}),
      discard: vi.fn(async () => {}),
      size: vi.fn(() => 0),
      getAll: vi.fn(async () => []),
      markFailed: vi.fn(async () => {}),
    },
  };
});

vi.mock("@/lib/offline/sync-handlers", () => ({
  executeSyncHandler: vi.fn(async (mutation: any) => ({ success: true, data: {} })),
}));

vi.mock("@/lib/network/network-detection", () => ({
  NetworkDetection: {
    subscribe: vi.fn(() => () => {}),
    getStatus: vi.fn(() => ({ isOnline: true })),
  },
}));

vi.mock("@/lib/database/supabase", () => ({ supabase: {} }));
vi.mock("@/lib/error", () => ({
  createSafeModeState: vi.fn(() => ({})),
  NetworkCascadeDetector: { recordFailure: vi.fn(() => false), recordSuccess: vi.fn(() => {}) },
  SafeModeReason: { NETWORK_CASCADE: "network_cascade" },
}));

import { OfflineMutationQueue } from "@/lib/offline/mutation-queue";
import { executeSyncHandler } from "@/lib/offline/sync-handlers";
import { OnlineSyncManager } from "@/lib/offline/sync-manager";

describe("OnlineSyncManager (unit)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Ensure queue has no items by default
    (OfflineMutationQueue.getReadyBatch as any).mockResolvedValue([]);
    (OfflineMutationQueue.size as any).mockReturnValue(0);
  });

  it("syncAll returns quickly when offline", async () => {
    // Force offline state
    (OnlineSyncManager as any).isOnline = false;

    const status = await OnlineSyncManager.syncAll();
    expect(status.isSyncing).toBe(false);
  });

  it("processes successful mutations and calls remove", async () => {
    // Create fake mutation
    const fake = { id: "m1", operation: "create", table: "t", payload: {} };
    (OfflineMutationQueue.getReadyBatch as any).mockResolvedValue([fake]);
    (OfflineMutationQueue.size as any).mockReturnValue(1);

    // Ensure executeSyncHandler returns success
    (executeSyncHandler as any).mockResolvedValue({ success: true, data: {} });

    (OnlineSyncManager as any).isOnline = true;
    const status = await OnlineSyncManager.syncAll();

    expect(OfflineMutationQueue.remove).toHaveBeenCalled();
    expect(status.syncedCount).toBeGreaterThanOrEqual(0);
  });

  it("handles permanent failure by discarding mutation", async () => {
    const fake = { id: "m2", operation: "create", table: "t", payload: {} };
    (OfflineMutationQueue.getReadyBatch as any).mockResolvedValue([fake]);
    (OfflineMutationQueue.size as any).mockReturnValue(1);

    // simulate handler failure that is non-retryable
    (executeSyncHandler as any).mockResolvedValue({ success: false, error: "bad request" });

    (OnlineSyncManager as any).isOnline = true;

    await OnlineSyncManager.syncAll();

    expect(OfflineMutationQueue.discard).toHaveBeenCalled();
  });
});
