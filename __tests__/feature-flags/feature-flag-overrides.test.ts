/**
 * Feature Flag Remote Overrides Tests
 *
 * Tests the merge logic, filtering, caching, and offline behavior of remote overrides.
 * Priority: override > entitlement > global flag
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureFlagsManager } from "@/lib/feature-flags/server-sync";
import { SecureStorage } from "@/lib/storage";

import { fetchFeatureFlags } from "@/lib/database/feature-flags";
import { fetchOverridesByUserId } from "@/lib/database/feature-flag-overrides";

// Mock Supabase and database helpers
vi.mock("@/lib/database/feature-flags", () => ({
  fetchFeatureFlags: vi.fn(),
}));

vi.mock("@/lib/database/entitlements", () => ({
  fetchEntitlementsByUserId: vi.fn(),
}));

vi.mock("@/lib/database/feature-flag-overrides", () => ({
  fetchOverridesByUserId: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  SecureStorage: {
    setJSON: vi.fn().mockResolvedValue(undefined),
    getJSON: vi.fn().mockResolvedValue(null),
    removeItem: vi.fn().mockResolvedValue(undefined),
    getAllKeys: vi.fn().mockResolvedValue([]),
  },
  STORAGE_KEYS: {
    FEATURE_FLAGS: "dnd:feature_flags",
    ENTITLEMENTS: "dnd:entitlements",
    CLOCK_INVALID: "dnd:clock_invalid",
  },
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Feature Flag Remote Overrides", () => {
  const mockSupabase = {} as any;
  const userId = "test-user-123";

  beforeEach(() => {
    vi.clearAllMocks();
    (FeatureFlagsManager as any).bootstrapped = false;
    (FeatureFlagsManager as any).currentFlags = new Map();
    (FeatureFlagsManager as any).remoteOverrides = new Map();
    (FeatureFlagsManager as any).userOverrides.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Merge Priority: override > flag", () => {
    it("should return override enabled=true when flag enabled=false", async () => {
      // Setup
      (fetchFeatureFlags as any).mockResolvedValue([
        { flag_name: "testFlag", enabled: false, kind: "free" },
      ]);
      (fetchOverridesByUserId as any).mockResolvedValue([
        {
          id: "override-1",
          user_id: userId,
          flag_name: "testFlag",
          enabled: true,
          expires_at: null,
          revoked: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      // Execute
      await FeatureFlagsManager.initialize(mockSupabase, userId);
      await FeatureFlagsManager.bootstrapFlags();

      // Assert: remote override takes precedence
      expect(FeatureFlagsManager.getFlag("testFlag", false)).toBe(true);
    });

    it("should return override enabled=false when flag enabled=true", async () => {
      // Setup
      (fetchFeatureFlags as any).mockResolvedValue([
        { flag_name: "testFlag", enabled: true, kind: "free" },
      ]);
      (fetchOverridesByUserId as any).mockResolvedValue([
        {
          id: "override-1",
          user_id: userId,
          flag_name: "testFlag",
          enabled: false,
          expires_at: null,
          revoked: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      // Execute
      await FeatureFlagsManager.initialize(mockSupabase, userId);
      await FeatureFlagsManager.bootstrapFlags();

      // Assert: remote override takes precedence
      expect(FeatureFlagsManager.getFlag("testFlag", true)).toBe(false);
    });

    it("should use flag value when no override exists", async () => {
      // Setup
      (fetchFeatureFlags as any).mockResolvedValue([
        { flag_name: "testFlag", enabled: true, kind: "free" },
      ]);
      (fetchOverridesByUserId as any).mockResolvedValue([]);

      // Execute
      await FeatureFlagsManager.initialize(mockSupabase, userId);
      await FeatureFlagsManager.bootstrapFlags();

      // Assert
      expect(FeatureFlagsManager.getFlag("testFlag", false)).toBe(true);
    });
  });

  describe("Override Filtering: Expired & Revoked", () => {
    it("should ignore revoked override", async () => {
      // Setup: override marked as revoked
      (fetchFeatureFlags as any).mockResolvedValue([
        { flag_name: "testFlag", enabled: false, kind: "free" },
      ]);
      (fetchOverridesByUserId as any).mockResolvedValue([
        {
          id: "override-1",
          user_id: userId,
          flag_name: "testFlag",
          enabled: true,
          expires_at: null,
          revoked: true, // Revoked
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      // Execute
      await FeatureFlagsManager.initialize(mockSupabase, userId);
      await FeatureFlagsManager.bootstrapFlags();

      // Assert: revoked override is ignored, flag value used
      expect(FeatureFlagsManager.getFlag("testFlag", false)).toBe(false);
    });

    it("should ignore expired override", async () => {
      // Setup: override expired in the past
      const pastDate = new Date(Date.now() - 60000).toISOString(); // 1 minute ago
      (fetchFeatureFlags as any).mockResolvedValue([
        { flag_name: "testFlag", enabled: false, kind: "free" },
      ]);
      (fetchOverridesByUserId as any).mockResolvedValue([
        {
          id: "override-1",
          user_id: userId,
          flag_name: "testFlag",
          enabled: true,
          expires_at: pastDate,
          revoked: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      // Execute
      await FeatureFlagsManager.initialize(mockSupabase, userId);
      await FeatureFlagsManager.bootstrapFlags();

      // Assert: expired override is ignored, flag value used
      expect(FeatureFlagsManager.getFlag("testFlag", false)).toBe(false);
    });

    it("should use non-expired override", async () => {
      // Setup: override expires in the future
      const futureDate = new Date(Date.now() + 60000).toISOString(); // 1 minute from now
      (fetchFeatureFlags as any).mockResolvedValue([
        { flag_name: "testFlag", enabled: false, kind: "free" },
      ]);
      (fetchOverridesByUserId as any).mockResolvedValue([
        {
          id: "override-1",
          user_id: userId,
          flag_name: "testFlag",
          enabled: true,
          expires_at: futureDate,
          revoked: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      // Execute
      await FeatureFlagsManager.initialize(mockSupabase, userId);
      await FeatureFlagsManager.bootstrapFlags();

      // Assert: valid override is used
      expect(FeatureFlagsManager.getFlag("testFlag", false)).toBe(true);
    });

    it("should use override with null expires_at (never expires)", async () => {
      // Setup: override with no expiry
      (fetchFeatureFlags as any).mockResolvedValue([
        { flag_name: "testFlag", enabled: false, kind: "free" },
      ]);
      (fetchOverridesByUserId as any).mockResolvedValue([
        {
          id: "override-1",
          user_id: userId,
          flag_name: "testFlag",
          enabled: true,
          expires_at: null,
          revoked: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      // Execute
      await FeatureFlagsManager.initialize(mockSupabase, userId);
      await FeatureFlagsManager.bootstrapFlags();

      // Assert: override without expiry is always valid
      expect(FeatureFlagsManager.getFlag("testFlag", false)).toBe(true);
    });
  });

  describe("Caching & Persistence", () => {
    it("should persist overrides to SecureStorage", async () => {
      // Setup
      (fetchFeatureFlags as any).mockResolvedValue([]);
      const overrides = [
        {
          id: "override-1",
          user_id: userId,
          flag_name: "testFlag",
          enabled: true,
          expires_at: null,
          revoked: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
      (fetchOverridesByUserId as any).mockResolvedValue(overrides);

      // Execute
      await FeatureFlagsManager.initialize(mockSupabase, userId);
      await FeatureFlagsManager.bootstrapFlags();

      // Assert: overrides stored in SecureStorage
      expect(SecureStorage.setJSON).toHaveBeenCalledWith(
        expect.stringContaining(
          `dnd:feature_flags:feature_flag_override:${userId}`,
        ),
        expect.objectContaining({
          testFlag: expect.objectContaining({ enabled: true }),
        }),
      );
    });

    it("should load cached overrides on error", async () => {
      // Setup: fetch fails but cached data available
      (fetchFeatureFlags as any).mockResolvedValue([]);
      (fetchOverridesByUserId as any).mockRejectedValue(
        new Error("Network error"),
      );
      (SecureStorage.getJSON as any).mockResolvedValue({
        testFlag: {
          id: "override-1",
          flag_name: "testFlag",
          enabled: true,
          expires_at: null,
          revoked: false,
        },
      });

      // Execute
      await FeatureFlagsManager.initialize(mockSupabase, userId);
      await FeatureFlagsManager.bootstrapFlags();

      // Assert: cached override is used
      expect(SecureStorage.getJSON).toHaveBeenCalled();
      expect(FeatureFlagsManager.getFlag("testFlag", false)).toBe(true);
    });
  });

  describe("Local vs Remote Overrides Priority", () => {
    it("remote override should take precedence over local override", async () => {
      // Setup
      (fetchFeatureFlags as any).mockResolvedValue([]);
      (fetchOverridesByUserId as any).mockResolvedValue([
        {
          id: "override-1",
          user_id: userId,
          flag_name: "testFlag",
          enabled: true,
          expires_at: null,
          revoked: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      // Execute: set local override and bootstrap
      FeatureFlagsManager.setOverride("testFlag", false);
      await FeatureFlagsManager.initialize(mockSupabase, userId);
      await FeatureFlagsManager.bootstrapFlags();

      // Assert: remote override (true) takes precedence over local override (false)
      expect(FeatureFlagsManager.getFlag("testFlag", false)).toBe(true);
    });
  });

  describe("Offline Behavior", () => {
    it("should use cached overrides when offline", async () => {
      // Setup: initial bootstrap succeeds
      (fetchFeatureFlags as any).mockResolvedValue([
        { flag_name: "testFlag", enabled: false, kind: "free" },
      ]);
      (fetchOverridesByUserId as any).mockResolvedValue([
        {
          id: "override-1",
          user_id: userId,
          flag_name: "testFlag",
          enabled: true,
          expires_at: null,
          revoked: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      await FeatureFlagsManager.initialize(mockSupabase, userId);
      await FeatureFlagsManager.bootstrapFlags();

      // Now simulate offline by rejecting fetch
      (fetchOverridesByUserId as any).mockRejectedValue(new Error("Offline"));
      (fetchFeatureFlags as any).mockRejectedValue(new Error("Offline"));
      (SecureStorage.getJSON as any).mockResolvedValue({
        testFlag: {
          id: "override-1",
          flag_name: "testFlag",
          enabled: true,
          expires_at: null,
          revoked: false,
        },
      });

      // Simulate re-bootstrap (offline)
      (FeatureFlagsManager as any).bootstrapped = false;
      await FeatureFlagsManager.bootstrapFlags();

      // Assert: should still return override value from cache
      expect(FeatureFlagsManager.getFlag("testFlag", false)).toBe(true);
    });
  });

  describe("Cache Clearing", () => {
    it("should clear overrides on logout", async () => {
      // Setup: bootstrap with overrides
      (fetchFeatureFlags as any).mockResolvedValue([]);
      (fetchOverridesByUserId as any).mockResolvedValue([
        {
          id: "override-1",
          user_id: userId,
          flag_name: "testFlag",
          enabled: true,
          expires_at: null,
          revoked: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      await FeatureFlagsManager.initialize(mockSupabase, userId);
      await FeatureFlagsManager.bootstrapFlags();

      // Verify override exists
      expect((FeatureFlagsManager as any).remoteOverrides.size).toBe(1);

      // Execute: clear cache (logout)
      (SecureStorage.getAllKeys as any).mockResolvedValue([
        `dnd:feature_flags:feature_flag_override:${userId}`,
      ]);
      await FeatureFlagsManager.clearCache();

      // Assert: remoteOverrides cleared
      expect((FeatureFlagsManager as any).remoteOverrides.size).toBe(0);
      expect(SecureStorage.removeItem).toHaveBeenCalled();
    });
  });
});
