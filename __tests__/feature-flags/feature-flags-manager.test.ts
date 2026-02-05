/**
 * FeatureFlagsManager Tests
 *
 * Tests core manager functionality:
 * - Bootstrap and flag retrieval
 * - Override management
 * - Entitlement checks with expiry and clock skew
 * - Caching behavior
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureFlagsManager } from "@/lib/feature-flags/server-sync";
import { createClient } from "@supabase/supabase-js";

import { fetchFeatureFlagsByEnv } from "@/lib/database/feature-flags";
import {
  fetchEntitlementsByUserId,
  hasEntitlement,
} from "@/lib/database/entitlements";

// Mock Supabase
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        data: [],
        error: null,
      })),
    })),
  })),
};

// Mock database helpers
vi.mock("@/lib/database/feature-flags", () => ({
  fetchFeatureFlagsByEnv: vi.fn(),
}));

vi.mock("@/lib/database/entitlements", () => ({
  fetchEntitlementsByUserId: vi.fn(),
  hasEntitlement: vi.fn(),
}));

// Mock database helpers
vi.mock("@/lib/database/feature-flags", () => ({
  fetchFeatureFlagsByEnv: vi.fn(),
}));

vi.mock("@/lib/database/entitlements", () => ({
  fetchEntitlementsByUserId: vi.fn(),
  hasEntitlement: vi.fn(),
}));

describe("FeatureFlagsManager", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
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
    it("should fetch flags from server", async () => {
      const mockFlags = [
        { flag_name: "testFlag", enabled: true, kind: "feature" as const },
      ];
      (fetchFeatureFlagsByEnv as any).mockResolvedValue(mockFlags);

      await FeatureFlagsManager.initialize(mockSupabase as any);
      await FeatureFlagsManager.bootstrapFlags();

      expect(fetchFeatureFlagsByEnv).toHaveBeenCalledWith(mockSupabase);
    });

    it("should handle fetch errors gracefully", async () => {
      (fetchFeatureFlagsByEnv as any).mockRejectedValue(
        new Error("Network error"),
      );

      await FeatureFlagsManager.initialize(mockSupabase as any);
      await FeatureFlagsManager.bootstrapFlags();

      // Should not crash
      expect(FeatureFlagsManager.getFlag("testFlag", false)).toBe(false);
    });
  });

  describe("getFlag", () => {
    beforeEach(async () => {
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

    beforeEach(async () => {
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
      // Mock server failure (offline)
      (fetchEntitlementsByUserId as any).mockRejectedValue(
        new Error("Network error"),
      );

      // Mock the getCachedEntitlement method to return cached value
      const manager = FeatureFlagsManager as any;
      manager.getCachedEntitlement = vi.fn().mockResolvedValue(true);

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
