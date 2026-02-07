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
  },
  STORAGE_KEYS: {
    FEATURE_FLAGS: "dnd:feature_flags:v1",
    CLOCK_INVALID: "dnd:clock_invalid",
  },
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
        mockSupabase,
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
});
