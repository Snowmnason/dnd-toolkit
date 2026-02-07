/**
 * Feature Flag Remote Overrides Tests
 *
 * Tests the merge logic, filtering, caching, and offline behavior of remote overrides.
 * Priority: override > entitlement > global flag
 *
 * NOTE: After Phase 1b refactoring, bootstrapFlags now invokes the get_feature_flags
 * Edge Function instead of direct database queries. Tests mock the Edge Function response.
 */

import { FeatureFlagsManager } from "@/lib/feature-flags/server-sync";
import { SecureStorage } from "@/lib/storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock Supabase and storage
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
  const userId = "test-user-123";

  // Mock Supabase client that returns a functions.invoke method
  const createMockSupabase = (response: any = null, error: any = null) => ({
    functions: {
      invoke: vi.fn().mockResolvedValue({
        data: response,
        error: error,
      }),
    },
  });

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
      // Setup: Mock Edge Function response
      const mockSupabase = createMockSupabase({
        flags: [
          {
            flag_name: "testFlag",
            enabled: false,
            kind: "free",
            created_at: "2026-02-05T00:00:00Z",
            updated_at: "2026-02-05T00:00:00Z",
          },
        ],
        entitlements: [],
        overrides: [
          {
            id: "override-1",
            user_id: userId,
            target_type: "flag",
            target_name: "testFlag",
            enabled: true,
            expires_at: null,
            revoked: false,
            created_at: "2026-02-05T00:00:00Z",
            updated_at: "2026-02-05T00:00:00Z",
          },
        ],
        fetchedAt: Date.now(),
        version: "v1",
      });

      // Execute
      await FeatureFlagsManager.initialize(mockSupabase, userId);
      await FeatureFlagsManager.bootstrapFlags();

      // Assert: remote override takes precedence
      expect(FeatureFlagsManager.getFlag("testFlag", false)).toBe(true);
    });

    it("should return override enabled=false when flag enabled=true", async () => {
      // Setup: Mock Edge Function response
      const mockSupabase = createMockSupabase({
        flags: [
          {
            flag_name: "testFlag",
            enabled: true,
            kind: "free",
            created_at: "2026-02-05T00:00:00Z",
            updated_at: "2026-02-05T00:00:00Z",
          },
        ],
        entitlements: [],
        overrides: [
          {
            id: "override-1",
            user_id: userId,
            target_type: "flag",
            target_name: "testFlag",
            enabled: false,
            expires_at: null,
            revoked: false,
            created_at: "2026-02-05T00:00:00Z",
            updated_at: "2026-02-05T00:00:00Z",
          },
        ],
        fetchedAt: Date.now(),
        version: "v1",
      });

      // Execute
      await FeatureFlagsManager.initialize(mockSupabase, userId);
      await FeatureFlagsManager.bootstrapFlags();

      // Assert: remote override takes precedence
      expect(FeatureFlagsManager.getFlag("testFlag", true)).toBe(false);
    });

    it("should use flag value when no override exists", async () => {
      // Setup: Mock Edge Function response with no overrides
      const mockSupabase = createMockSupabase({
        flags: [
          {
            flag_name: "testFlag",
            enabled: true,
            kind: "free",
            created_at: "2026-02-05T00:00:00Z",
            updated_at: "2026-02-05T00:00:00Z",
          },
        ],
        entitlements: [],
        overrides: [],
        fetchedAt: Date.now(),
        version: "v1",
      });

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
      const mockSupabase = createMockSupabase({
        flags: [
          {
            flag_name: "testFlag",
            enabled: false,
            kind: "free",
            created_at: "2026-02-05T00:00:00Z",
            updated_at: "2026-02-05T00:00:00Z",
          },
        ],
        entitlements: [],
        overrides: [], // Edge Function filters out revoked overrides
        fetchedAt: Date.now(),
        version: "v1",
      });

      // Execute (Edge Function already filtered, so this won't have the revoked override)
      await FeatureFlagsManager.initialize(mockSupabase, userId);
      await FeatureFlagsManager.bootstrapFlags();

      // Assert: revoked override was filtered out server-side
      expect(FeatureFlagsManager.getFlag("testFlag", false)).toBe(false);
    });

    it("should ignore expired override", async () => {
      // Setup: override with past expiry (Edge Function filters these out)
      const mockSupabase = createMockSupabase({
        flags: [
          {
            flag_name: "testFlag",
            enabled: false,
            kind: "free",
            created_at: "2026-02-05T00:00:00Z",
            updated_at: "2026-02-05T00:00:00Z",
          },
        ],
        entitlements: [],
        overrides: [], // Edge Function filters out expired overrides
        fetchedAt: Date.now(),
        version: "v1",
      });

      // Execute
      await FeatureFlagsManager.initialize(mockSupabase, userId);
      await FeatureFlagsManager.bootstrapFlags();

      // Assert: expired override was filtered out server-side
      expect(FeatureFlagsManager.getFlag("testFlag", false)).toBe(false);
    });

    it("should use non-expired override", async () => {
      // Setup: override with future expiry
      const futureDate = new Date(Date.now() + 60000).toISOString();
      const mockSupabase = createMockSupabase({
        flags: [
          {
            flag_name: "testFlag",
            enabled: false,
            kind: "free",
            created_at: "2026-02-05T00:00:00Z",
            updated_at: "2026-02-05T00:00:00Z",
          },
        ],
        entitlements: [],
        overrides: [
          {
            id: "override-1",
            user_id: userId,
            target_type: "flag",
            target_name: "testFlag",
            enabled: true,
            expires_at: futureDate,
            revoked: false,
            created_at: "2026-02-05T00:00:00Z",
            updated_at: "2026-02-05T00:00:00Z",
          },
        ],
        fetchedAt: Date.now(),
        version: "v1",
      });

      // Execute
      await FeatureFlagsManager.initialize(mockSupabase, userId);
      await FeatureFlagsManager.bootstrapFlags();

      // Assert
      expect(FeatureFlagsManager.getFlag("testFlag", false)).toBe(true);
    });

    it("should use override with null expires_at (never expires)", async () => {
      // Setup: override with null expiry (never expires)
      const mockSupabase = createMockSupabase({
        flags: [
          {
            flag_name: "testFlag",
            enabled: false,
            kind: "free",
            created_at: "2026-02-05T00:00:00Z",
            updated_at: "2026-02-05T00:00:00Z",
          },
        ],
        entitlements: [],
        overrides: [
          {
            id: "override-1",
            user_id: userId,
            target_type: "flag",
            target_name: "testFlag",
            enabled: true,
            expires_at: null,
            revoked: false,
            created_at: "2026-02-05T00:00:00Z",
            updated_at: "2026-02-05T00:00:00Z",
          },
        ],
        fetchedAt: Date.now(),
        version: "v1",
      });

      // Execute
      await FeatureFlagsManager.initialize(mockSupabase, userId);
      await FeatureFlagsManager.bootstrapFlags();

      // Assert
      expect(FeatureFlagsManager.getFlag("testFlag", false)).toBe(true);
    });
  });

  describe("Caching & Persistence", () => {
    it("should persist overrides to SecureStorage", async () => {
      // Setup
      const mockSupabase = createMockSupabase({
        flags: [
          {
            flag_name: "testFlag",
            enabled: false,
            kind: "free",
            created_at: "2026-02-05T00:00:00Z",
            updated_at: "2026-02-05T00:00:00Z",
          },
        ],
        entitlements: [],
        overrides: [
          {
            id: "override-1",
            user_id: userId,
            target_type: "flag",
            target_name: "testFlag",
            enabled: true,
            expires_at: null,
            revoked: false,
            created_at: "2026-02-05T00:00:00Z",
            updated_at: "2026-02-05T00:00:00Z",
          },
        ],
        fetchedAt: Date.now(),
        version: "v1",
      });

      // Execute
      await FeatureFlagsManager.initialize(mockSupabase, userId);
      await FeatureFlagsManager.bootstrapFlags();

      // Assert: overrides were cached
      expect(SecureStorage.setJSON).toHaveBeenCalledWith(
        expect.stringContaining("feature_flag_override:"),
        expect.objectContaining({
          testFlag: expect.objectContaining({
            enabled: true,
          }),
        }),
      );
    });

    it("should load cached overrides on error", async () => {
      // Setup: Edge Function returns no data (error case)
      const mockSupabase = createMockSupabase(null, new Error("Network error"));

      // Mock cached data available
      (SecureStorage.getJSON as any).mockImplementation(async (key: string) => {
        // Return cached flags when requested
        if (key === "dnd:feature_flags") {
          return {
            flags: {
              testFlag: {
                enabled: false,
                kind: "free",
                description: "",
                source: "server",
              },
            },
            fetchedAt: Date.now(),
          };
        }
        // Return cached overrides when requested
        if (key.includes("feature_flag_override")) {
          return {
            testFlag: {
              id: "override-1",
              user_id: userId,
              target_type: "flag",
              target_name: "testFlag",
              enabled: true,
              expires_at: null,
              revoked: false,
              created_at: "2026-02-05T00:00:00Z",
              updated_at: "2026-02-05T00:00:00Z",
            },
          };
        }
        return null;
      });

      // Execute
      await FeatureFlagsManager.initialize(mockSupabase, userId);
      await FeatureFlagsManager.bootstrapFlags();

      // Assert: cached values loaded
      expect(SecureStorage.getJSON).toHaveBeenCalled();
      // Should have loaded cached flags and overrides, with override taking precedence
      expect(FeatureFlagsManager.getFlag("testFlag", false)).toBe(true);
    });
  });

  describe("Local vs Remote Overrides Priority", () => {
    it("remote override should take precedence over local override", async () => {
      // Setup: Both remote and local overrides for same flag
      const mockSupabase = createMockSupabase({
        flags: [
          {
            flag_name: "testFlag",
            enabled: false,
            kind: "free",
            created_at: "2026-02-05T00:00:00Z",
            updated_at: "2026-02-05T00:00:00Z",
          },
        ],
        entitlements: [],
        overrides: [
          {
            id: "override-1",
            user_id: userId,
            target_type: "flag",
            target_name: "testFlag",
            enabled: true, // Remote says true
            expires_at: null,
            revoked: false,
            created_at: "2026-02-05T00:00:00Z",
            updated_at: "2026-02-05T00:00:00Z",
          },
        ],
        fetchedAt: Date.now(),
        version: "v1",
      });

      // Execute
      await FeatureFlagsManager.initialize(mockSupabase, userId);

      // Set local override to false
      (FeatureFlagsManager as any).userOverrides.set("testFlag", false);

      await FeatureFlagsManager.bootstrapFlags();

      // Assert: remote override takes precedence
      expect(FeatureFlagsManager.getFlag("testFlag", false)).toBe(true);
    });
  });

  describe("Offline Behavior", () => {
    it("should use cached overrides when offline", async () => {
      // First call - successful
      const mockSupabase1 = createMockSupabase({
        flags: [
          {
            flag_name: "testFlag",
            enabled: false,
            kind: "free",
            created_at: "2026-02-05T00:00:00Z",
            updated_at: "2026-02-05T00:00:00Z",
          },
        ],
        entitlements: [],
        overrides: [
          {
            id: "override-1",
            user_id: userId,
            target_type: "flag",
            target_name: "testFlag",
            enabled: true,
            expires_at: null,
            revoked: false,
            created_at: "2026-02-05T00:00:00Z",
            updated_at: "2026-02-05T00:00:00Z",
          },
        ],
        fetchedAt: Date.now(),
        version: "v1",
      });

      // Bootstrap initially
      await FeatureFlagsManager.initialize(mockSupabase1, userId);
      await FeatureFlagsManager.bootstrapFlags();

      // Verify override exists
      expect((FeatureFlagsManager as any).remoteOverrides.size).toBe(1);

      // Execute: clear cache (logout)
      (FeatureFlagsManager as any).bootstrapped = false;

      // Second call - offline
      const mockSupabase2 = createMockSupabase(null, new Error("Offline"));

      // Mock cached data available
      (SecureStorage.getJSON as any).mockResolvedValueOnce({
        flags: {
          testFlag: { enabled: false, kind: "free", source: "server" },
        },
        fetchedAt: Date.now(),
      });

      (SecureStorage.getJSON as any).mockResolvedValueOnce({
        testFlag: {
          id: "override-1",
          user_id: userId,
          target_type: "flag",
          target_name: "testFlag",
          enabled: true,
          expires_at: null,
          revoked: false,
          created_at: "2026-02-05T00:00:00Z",
          updated_at: "2026-02-05T00:00:00Z",
        },
      });

      await FeatureFlagsManager.initialize(mockSupabase2, userId);
      await FeatureFlagsManager.bootstrapFlags();

      // Assert: offline flag uses cached override
      expect(FeatureFlagsManager.getFlag("testFlag", false)).toBe(true);
    });
  });

  describe("Cache Clearing", () => {
    it("should clear overrides on logout", async () => {
      // Setup
      const mockSupabase = createMockSupabase({
        flags: [
          {
            flag_name: "testFlag",
            enabled: false,
            kind: "free",
            created_at: "2026-02-05T00:00:00Z",
            updated_at: "2026-02-05T00:00:00Z",
          },
        ],
        entitlements: [],
        overrides: [
          {
            id: "override-1",
            user_id: userId,
            target_type: "flag",
            target_name: "testFlag",
            enabled: true,
            expires_at: null,
            revoked: false,
            created_at: "2026-02-05T00:00:00Z",
            updated_at: "2026-02-05T00:00:00Z",
          },
        ],
        fetchedAt: Date.now(),
        version: "v1",
      });

      // Bootstrap
      await FeatureFlagsManager.initialize(mockSupabase, userId);
      await FeatureFlagsManager.bootstrapFlags();

      // Verify override exists
      expect((FeatureFlagsManager as any).remoteOverrides.size).toBe(1);

      // Execute: clear cache (logout)
      (SecureStorage.getAllKeys as any).mockResolvedValue([
        `dnd:feature_flags:feature_flag_override:${userId}`,
      ]);
      await FeatureFlagsManager.clearCache();

      // Assert: overrides cleared
      expect((FeatureFlagsManager as any).remoteOverrides.size).toBe(0);
      expect(SecureStorage.removeItem).toHaveBeenCalledWith(
        expect.stringContaining("feature_flag_override:"),
      );
    });
  });
});
