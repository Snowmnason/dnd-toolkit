/**
 * FeatureFlagsManager Tests
 *
 * Tests core manager functionality:
 * - Bootstrap and flag retrieval
 * - Override management
 * - Entitlement checks with expiry and clock skew
 * - Caching behavior
 *
 * NOTE: After Phase 1b refactoring, bootstrapFlags invokes the get_feature_flags
 * Edge Function instead of direct database queries.
 */

import { FeatureFlagsManager } from "@/lib/feature-flags/server-sync";
import { SecureStorage } from "@/lib/storage";
import { STORAGE_KEYS } from "@/maps";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchEntitlementsByUserId } from "@/lib/database/entitlements";

// Mock Supabase with functions.invoke capability
const createMockSupabase = (invokeFn?: any) => ({
  functions: {
    invoke:
      invokeFn ||
      vi.fn().mockResolvedValue({
        data: {
          flags: [],
          entitlements: [],
          overrides: [],
          fetchedAt: Date.now(),
          version: "v1",
        },
        error: null,
      }),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        data: [],
        error: null,
      })),
    })),
  })),
});

// Mock SecureStorage
vi.mock("@/lib/storage", () => ({
  SecureStorage: {
    setJSON: vi.fn(),
    getJSON: vi.fn(),
    removeItem: vi.fn(),
    getAllKeys: vi.fn().mockResolvedValue([]),
    setItem: vi.fn(),
    getItem: vi.fn(),
  },
  STORAGE_KEYS: {
    FEATURE_FLAGS: "dnd:feature_flags:v1",
    ENTITLEMENTS: "dnd:entitlements:v1",
    CLOCK_INVALID: "dnd:clock_invalid",
  },
}));

// Ensure production path (calls Edge Function) during tests
vi.mock('@/lib/config/loader', () => ({
  getAppConfig: () => ({ remoteConfig: {}, features: {}, services: {} }),
  isDevelopment: () => false,
}));

// Mock database helpers (only entitlements are still direct)
vi.mock("@/lib/database/entitlements", () => ({
  fetchEntitlementsByUserId: vi.fn(),
}));

describe("FeatureFlagsManager", () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock SecureStorage methods to return null by default (no cached data)
    (SecureStorage.getJSON as any).mockResolvedValue(null);
    (SecureStorage.setJSON as any).mockResolvedValue(undefined);
    (SecureStorage.removeItem as any).mockResolvedValue(undefined);

    // Reset manager state
    await FeatureFlagsManager.clearCache();
    FeatureFlagsManager.clearAllOverrides();
    (FeatureFlagsManager as any).bootstrapped = false;
    (FeatureFlagsManager as any).currentFlags = new Map();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("bootstrapFlags", () => {
    it("should fetch flags from server via Edge Function", async () => {
      const mockSupabase = createMockSupabase(
        vi.fn().mockResolvedValue({
          data: {
            flags: [
              {
                flag_name: "testFlag",
                enabled: true,
                kind: "feature",
                created_at: "2026-02-05T00:00:00Z",
                updated_at: "2026-02-05T00:00:00Z",
              },
            ],
            entitlements: [],
            overrides: [],
            fetchedAt: Date.now(),
            version: "v1",
          },
          error: null,
        }),
      );

      await FeatureFlagsManager.initialize(mockSupabase as any);
      await FeatureFlagsManager.bootstrapFlags();

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
        "get_feature_flags",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("should handle fetch errors gracefully", async () => {
      const mockSupabase = createMockSupabase(
        vi.fn().mockResolvedValue({
          data: null,
          error: new Error("Network error"),
        }),
      );

      // Mock cached data as fallback
      (SecureStorage.getJSON as any).mockResolvedValueOnce({
        flags: {},
        fetchedAt: Date.now(),
      });

      await FeatureFlagsManager.initialize(mockSupabase as any);
      await FeatureFlagsManager.bootstrapFlags();

      // Should not crash
      expect(FeatureFlagsManager.getFlag("testFlag", false)).toBe(false);
    });
  });

  describe("getFlag", () => {
    beforeEach(async () => {
      const mockSupabase = createMockSupabase();
      await FeatureFlagsManager.initialize(mockSupabase as any);
    });

    it("should return override value when set", () => {
      FeatureFlagsManager.setOverride("testFlag", true);
      expect(FeatureFlagsManager.getFlag("testFlag", false)).toBe(true);
    });

    it("should return server value when no override", async () => {
      // Manually set currentFlags to simulate bootstrap
      const manager = FeatureFlagsManager as any;
      manager.currentFlags = new Map([
        ["testFlag", { enabled: true, kind: "feature", source: "server" }],
      ]);
      manager.bootstrapped = true;

      expect(FeatureFlagsManager.getFlag("testFlag", false)).toBe(true);
    });

    it("should return fallback when no server value", () => {
      expect(FeatureFlagsManager.getFlag("unknownFlag", true)).toBe(true);
    });
  });

  describe("overrides", () => {
    it("should set and clear overrides", () => {
      FeatureFlagsManager.setOverride("testFlag", true);
      expect(FeatureFlagsManager.getFlag("testFlag", false)).toBe(true);

      FeatureFlagsManager.clearOverride("testFlag");
      expect(FeatureFlagsManager.getFlag("testFlag", false)).toBe(false);
    });

    it("should clear all overrides", () => {
      FeatureFlagsManager.setOverride("flag1", true);
      FeatureFlagsManager.setOverride("flag2", false);

      FeatureFlagsManager.clearAllOverrides();

      expect(FeatureFlagsManager.getFlag("flag1", false)).toBe(false);
      expect(FeatureFlagsManager.getFlag("flag2", true)).toBe(true);
    });
  });

  describe("getEntitlement", () => {
    const userId = "user-123";
    let mockSupabase: any;

    beforeEach(async () => {
      mockSupabase = createMockSupabase();
      await FeatureFlagsManager.initialize(mockSupabase as any);
    });

    it("should return override when set", async () => {
      FeatureFlagsManager.setOverride(`${userId}:premium`, true);

      const result = await FeatureFlagsManager.getEntitlement(
        "premium",
        userId,
      );
      expect(result.granted).toBe(true);
      expect(result.source).toBe("override");
    });

    it("should check server when no override", async () => {
      (fetchEntitlementsByUserId as any).mockResolvedValue([
        { key: "premium", expires_at: null },
      ]);

      const result = await FeatureFlagsManager.getEntitlement(
        "premium",
        userId,
      );
      expect(result.granted).toBe(true);
      expect(result.source).toBe("server");
      expect(fetchEntitlementsByUserId).toHaveBeenCalledWith(
        userId,
      );
    });

    it("should return cached value when offline", async () => {
      // Setup: Cache an entitlement
      const manager = FeatureFlagsManager as any;
      manager.cachedEntitlements = new Map([
        [
          "premium",
          {
            id: "ent-1",
            user_id: userId,
            key: "premium",
            created_at: "2026-02-06T00:00:00Z",
            updated_at: "2026-02-06T00:00:00Z",
            expires_at: null,
          },
        ],
      ]);

      // Mock server failure (offline)
      (fetchEntitlementsByUserId as any).mockRejectedValue(
        new Error("Network error"),
      );

      const result = await FeatureFlagsManager.getEntitlement(
        "premium",
        userId,
      );
      expect(result.granted).toBe(true);
      expect(result.source).toBe("cache");
    });

    it("should deny when entitlement expired", async () => {
      (fetchEntitlementsByUserId as any).mockResolvedValue([
        {
          key: "premium",
          expires_at: new Date(Date.now() - 1000).toISOString(),
        }, // expired
      ]);

      const result = await FeatureFlagsManager.getEntitlement(
        "premium",
        userId,
      );
      expect(result.granted).toBe(false);
    });
  });

  describe("verifyDeviceClock", () => {
    it("should return true when clock is valid", async () => {
      const result = await FeatureFlagsManager.verifyDeviceClock();
      expect(result).toBe(true);
    });

    it("should return false when clock is skewed", async () => {
      // Mock the checkClockValidity method to return true (invalid)
      const manager = FeatureFlagsManager as any;
      manager.checkClockValidity = vi.fn().mockResolvedValue(true);

      const result = await FeatureFlagsManager.getEntitlement(
        "premium",
        "user-123",
      );
      expect(result.source).toBe("clock_invalid");
    });
  });

  describe("rollouts", () => {
    const userId = "test-user-123";

    beforeEach(async () => {
      const mockSupabase = createMockSupabase();
      await FeatureFlagsManager.initialize(mockSupabase as any);
    });

    describe("evaluateRollout precedence", () => {
      it("should prioritize remote override over local override, rollout, and fallback", async () => {
        // Setup remote override
        const manager = FeatureFlagsManager as any;
        manager.remoteOverrides.set("testRollout", {
          enabled: true,
          revoked: false,
          expires_at: null,
        });

        // Setup local override (should be ignored)
        FeatureFlagsManager.setOverride("testRollout", false);

        // Setup rollout config (should be ignored)
        manager.cachedRollouts.set("testRollout", { percentage: 100 });

        const result = await FeatureFlagsManager.evaluateRollout(
          userId,
          "testRollout",
          false,
        );
        expect(result).toBe(true); // Remote override wins
      });

      it("should prioritize local override over rollout and fallback", async () => {
        // Setup local override
        FeatureFlagsManager.setOverride("testRollout", true);

        // Setup rollout config (should be ignored)
        const manager = FeatureFlagsManager as any;
        manager.cachedRollouts.set("testRollout", { percentage: 0 });

        const result = await FeatureFlagsManager.evaluateRollout(
          userId,
          "testRollout",
          false,
        );
        expect(result).toBe(true); // Local override wins
      });

      it("should evaluate rollout when no overrides exist", async () => {
        const manager = FeatureFlagsManager as any;

        // Setup rollout config for 100% rollout
        manager.cachedRollouts.set("testRollout", { percentage: 100 });

        const result = await FeatureFlagsManager.evaluateRollout(
          userId,
          "testRollout",
          false,
        );
        expect(result).toBe(true); // Should be in 100% rollout
      });

      it("should return fallback when no rollout config exists", async () => {
        const result = await FeatureFlagsManager.evaluateRollout(
          userId,
          "unknownRollout",
          true,
        );
        expect(result).toBe(true); // Fallback value
      });
    });

    describe("deterministic bucketing", () => {
      it("should return consistent results for same user and flag", async () => {
        const manager = FeatureFlagsManager as any;
        manager.cachedRollouts.set("consistentFlag", { percentage: 50 });

        // Call multiple times - should be deterministic
        const result1 = await FeatureFlagsManager.evaluateRollout(
          userId,
          "consistentFlag",
          false,
        );
        const result2 = await FeatureFlagsManager.evaluateRollout(
          userId,
          "consistentFlag",
          false,
        );
        const result3 = await FeatureFlagsManager.evaluateRollout(
          userId,
          "consistentFlag",
          false,
        );

        expect(result1).toBe(result2);
        expect(result2).toBe(result3);
      });

      it("should respect percentage rollout boundaries", async () => {
        const manager = FeatureFlagsManager as any;

        // Test 0% rollout
        manager.cachedRollouts.set("zeroPercent", { percentage: 0 });
        const zeroResult = await FeatureFlagsManager.evaluateRollout(
          userId,
          "zeroPercent",
          false,
        );
        expect(zeroResult).toBe(false);

        // Test 100% rollout
        manager.cachedRollouts.set("hundredPercent", { percentage: 100 });
        const hundredResult = await FeatureFlagsManager.evaluateRollout(
          userId,
          "hundredPercent",
          false,
        );
        expect(hundredResult).toBe(true);
      });

      it("should handle seed for rebalancing", async () => {
        const manager = FeatureFlagsManager as any;

        // Same flag, different seeds should potentially give different results
        manager.cachedRollouts.set("seededFlag1", {
          percentage: 50,
          seed: "seed1",
        });
        manager.cachedRollouts.set("seededFlag2", {
          percentage: 50,
          seed: "seed2",
        });

        const result1 = await FeatureFlagsManager.evaluateRollout(
          userId,
          "seededFlag1",
          false,
        );
        const result2 = await FeatureFlagsManager.evaluateRollout(
          userId,
          "seededFlag2",
          false,
        );

        // Results may or may not differ, but should be consistent
        const result1Again = await FeatureFlagsManager.evaluateRollout(
          userId,
          "seededFlag1",
          false,
        );
        expect(result1).toBe(result1Again);
      });
    });

    describe("rollout caching behavior", () => {
      it("should cache populated rollouts from server", async () => {
        const mockSupabase = createMockSupabase(
          vi.fn().mockResolvedValue({
            data: {
              flags: [],
              entitlements: [],
              overrides: [],
              rollouts: {
                testFlag: { percentage: 25, seed: "test" },
              },
              fetchedAt: Date.now(),
              version: "v1",
            },
            error: null,
          }),
        );

        await FeatureFlagsManager.initialize(mockSupabase as any);
        await FeatureFlagsManager.bootstrapFlags();

        const manager = FeatureFlagsManager as any;
        expect(manager.cachedRollouts.get("testFlag")).toEqual({
          percentage: 25,
          seed: "test",
        });

        // Verify persisted to storage
        expect(SecureStorage.setJSON).toHaveBeenCalledWith(
          `${STORAGE_KEYS.FEATURE_FLAGS}:rollouts`,
          { testFlag: { percentage: 25, seed: "test" } },
        );
      });

      it("should clear cache when server returns empty rollouts", async () => {
        const manager = FeatureFlagsManager as any;

        // Pre-populate cache
        manager.cachedRollouts.set("existingFlag", { percentage: 50 });

        const mockSupabase = createMockSupabase(
          vi.fn().mockResolvedValue({
            data: {
              flags: [],
              entitlements: [],
              overrides: [],
              rollouts: {}, // Explicitly empty
              fetchedAt: Date.now(),
              version: "v1",
            },
            error: null,
          }),
        );

        await FeatureFlagsManager.initialize(mockSupabase as any);
        await FeatureFlagsManager.bootstrapFlags();

        // Cache should be cleared
        expect(manager.cachedRollouts.size).toBe(0);

        // Verify storage removal
        expect(SecureStorage.removeItem).toHaveBeenCalledWith(
          `${STORAGE_KEYS.FEATURE_FLAGS}:rollouts`,
        );
      });

      it("should load cached rollouts when server response missing rollouts field", async () => {
        // Setup cached rollouts
        (SecureStorage.getJSON as any).mockResolvedValueOnce({
          cachedFlag: { percentage: 75 },
        });

        const mockSupabase = createMockSupabase(
          vi.fn().mockResolvedValue({
            data: {
              flags: [],
              entitlements: [],
              overrides: [],
              // rollouts field missing (old server)
              fetchedAt: Date.now(),
              version: "v1",
            },
            error: null,
          }),
        );

        await FeatureFlagsManager.initialize(mockSupabase as any);
        await FeatureFlagsManager.bootstrapFlags();

        const manager = FeatureFlagsManager as any;
        expect(manager.cachedRollouts.get("cachedFlag")).toEqual({
          percentage: 75,
        });
      });

      it("should clear persisted rollouts in clearCache", async () => {
        await FeatureFlagsManager.clearCache();

        expect(SecureStorage.removeItem).toHaveBeenCalledWith(
          `${STORAGE_KEYS.FEATURE_FLAGS}:rollouts`,
        );
      });
    });
  });
});
