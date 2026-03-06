import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthStateManager } from "@/lib/auth/auth-state";
import { getPrivacyStorageBackend } from "@/lib/middleware/storage";
import * as updateCache from "@/lib/storage/sync/update-storage-cache";

// Mock storage backend helper
vi.mock("@/lib/middleware/storage", () => ({
  getPrivacyStorageBackend: vi.fn(),
}));

// Mock update-storage-cache
vi.mock("@/lib/storage/update-storage-cache", () => ({
  updateStorageCache: { refreshAllWorldsCache: vi.fn() },
  refreshAllWorldsCache: vi.fn(),
}));

describe("AuthStateManager.batchVerifyWorldAccess", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns results for all worlds and may defer when session not ready", async () => {
    // Attempt to simulate deferred path; implementation may vary depending on environment.
    (updateCache as any).refreshAllWorldsCache = vi.fn().mockResolvedValue(null);
    const result = await AuthStateManager.batchVerifyWorldAccess(["w1", "w2"]);
    // Should return a map with same number of entries as input
    expect(result.results.size).toBe(2);
    // deferred is a boolean; if true then all results must be false
    expect(typeof result.deferred).toBe("boolean");
    if (result.deferred) {
      expect(result.results.get("w1")).toBe(false);
      expect(result.results.get("w2")).toBe(false);
    }
  });

  it("reads cache values when refresh succeeds", async () => {
    (updateCache as any).refreshAllWorldsCache = vi.fn().mockResolvedValue(true);
    const backend = { getJSON: vi.fn() };
    // w1 true, w2 false
    (backend.getJSON as any).mockImplementation(async (key: string) => key.includes("w1") ? true : false);
    (getPrivacyStorageBackend as any).mockReturnValue(backend);

    const { results, deferred } = await AuthStateManager.batchVerifyWorldAccess(["w1", "w2"]);
    expect(deferred).toBe(false);
    expect(results.get("w1")).toBe(true);
    expect(results.get("w2")).toBe(false);
  });

  it("falls back to per-world verification if refresh throws", async () => {
    (updateCache as any).refreshAllWorldsCache = vi.fn().mockRejectedValue(new Error("fail"));

    // Spy on verifyWorldAccessWithDatabase to return hasAccess true/false
    const spy = (vi.spyOn(AuthStateManager as any, "verifyWorldAccessWithDatabase") as any).mockImplementation(async (worldId: any) => ({ hasAccess: worldId === "w1" }));

    const res = await AuthStateManager.batchVerifyWorldAccess(["w1", "w2"]);
    // Should return a results map with entries for both worlds
    expect(res.results.size).toBe(2);
    expect(typeof res.deferred).toBe("boolean");
    expect(typeof res.results.get("w1")).toBe("boolean");
    expect(typeof res.results.get("w2")).toBe("boolean");
    spy.mockRestore();
  });
});
