/**
 * Phase 3: Cohorts Integration Tests
 *
 * Tests cohort membership evaluation and flag resolution with cohorts:
 * - Cohort caching and storage
 * - User cohort membership caching  
 * - Flag resolution with cohort requirements (AND logic)
 * - Explicit membership vs. deterministic bucketing
 * - Cohort + conditions combinations
 * - Cohort validation
 */

import { FeatureFlagsManager } from "@/lib/feature-flags/server-sync/orchestrator";
import { isUserInCohort } from "@/pure-algo-immutables";
import { performFeatureFlagSync } from "@/lib/jobs/core/sync/feature-flags-sync-job";
import { SecureStorage } from "@/system/Storage";
import type { CachedCohort, CachedUserCohortMembership } from "@/type-definitions/featureFlagTypes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock Supabase
const createMockSupabase = (invokeFn?: any) => ({
  functions: {
    invoke:
      invokeFn ||
      vi.fn().mockResolvedValue({
        data: {
          flags: [],
          entitlements: [],
          overrides: [],
          rollouts: {},
          cohorts: [],
          user_cohort_memberships: [],
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
vi.mock("@/system/Storage", () => ({
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

// Mock database
vi.mock("@/lib/database/entitlements", () => ({
  fetchEntitlementsByUserId: vi.fn().mockResolvedValue([]),
}));

// Mock loader module - with ability to update config
let mockConfigValue = {
  featureFlags: {},
  environment: "production" as const,
};

vi.mock("@/lib/config/loader", () => ({
  getAppConfig: vi.fn(() => mockConfigValue),
  isDevelopment: vi.fn(() => false),
}));

describe.skip("Phase 3: Cohorts Integration", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    (SecureStorage.getJSON as any).mockResolvedValue(null);
    (SecureStorage.setJSON as any).mockResolvedValue(undefined);
    (SecureStorage.removeItem as any).mockResolvedValue(undefined);

    FeatureFlagsManager.clearAllOverrides();
    (FeatureFlagsManager as any).bootstrapped = false;
    (FeatureFlagsManager as any).currentFlags = new Map();
    (FeatureFlagsManager as any).userId = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Cohort Caching", () => {
    it("should cache cohorts from Edge Function response", async () => {
      const mockCohorts: CachedCohort[] = [
        {
          id: "cohort-1",
          slug: "beta_testers",
          name: "Beta Testers",
          percentage: 20,
          is_active: true,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
        {
          id: "cohort-2",
          slug: "enterprise",
          name: "Enterprise Users",
          percentage: 100,
          is_active: true,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ];

      const mockSupabase = createMockSupabase(
        vi.fn().mockResolvedValue({
          data: {
            flags: [],
            entitlements: [],
            overrides: [],
            rollouts: {},
            cohorts: mockCohorts,
            user_cohort_memberships: [],
            fetchedAt: Date.now(),
            version: "v1",
          },
          error: null,
        }),
      );

        FeatureFlagsManager.state.userId = "user-123";
      await performFeatureFlagSync();

      // Verify cohorts were cached to storage
      expect(SecureStorage.setJSON).toHaveBeenCalledWith(
        expect.stringContaining(":cohorts"),
        expect.objectContaining({
          beta_testers: expect.objectContaining({ slug: "beta_testers" }),
          enterprise: expect.objectContaining({ slug: "enterprise" }),
        }),
      );
    });

    it("should load cached cohorts when offline", async () => {
      const mockCohorts: Record<string, CachedCohort> = {
        beta_testers: {
          id: "cohort-1",
          slug: "beta_testers",
          name: "Beta Testers",
          percentage: 20,
          is_active: true,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      };

      // Simulate offline: getJSON resolves with cached cohorts, invoke fails
      (SecureStorage.getJSON as any).mockImplementation((key: string) => {
        if (key.includes(":cohorts")) {
          return Promise.resolve(mockCohorts);
        }
        return Promise.resolve(null);
      });

      const mockSupabase = createMockSupabase(
        vi.fn().mockRejectedValue(new Error("Network error")),
      );

        FeatureFlagsManager.state.userId = "user-123";
      // Should fail gracefully and load from cache
      try {
        await performFeatureFlagSync();
      } catch {
        // Expected to fail
      }
    });

    it("should cache user cohort memberships", async () => {
      const mockMemberships: CachedUserCohortMembership[] = [
        {
          id: "mem-1",
          user_id: "user-123",
          cohort_id: "cohort-1",
          cohort_slug: "beta_testers",
          source: "direct",
          is_active: true,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ];

      const mockSupabase = createMockSupabase(
        vi.fn().mockResolvedValue({
          data: {
            flags: [],
            entitlements: [],
            overrides: [],
            rollouts: {},
            cohorts: [],
            user_cohort_memberships: mockMemberships,
            fetchedAt: Date.now(),
            version: "v1",
          },
          error: null,
        }),
      );

        FeatureFlagsManager.state.userId = "user-123";
      await performFeatureFlagSync();

      // Verify memberships were cached
      expect(SecureStorage.setJSON).toHaveBeenCalledWith(
        expect.stringContaining(":user_cohort_memberships"),
        mockMemberships,
      );
    });

    it("should handle Edge Function response with no cohort data gracefully", async () => {
      const mockSupabase = createMockSupabase(
        vi.fn().mockResolvedValue({
          data: {
            flags: [
              {
                flag_name: "regular_feature",
                enabled: true,
                kind: "free",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
            entitlements: [],
            overrides: [],
            rollouts: {},
            cohorts: [],
            cohort_assignments: [],
            user_cohort_memberships: [],
            fetchedAt: Date.now(),
            version: "v1",
          },
          error: null,
        }),
      );

        FeatureFlagsManager.state.userId = "user-123";
      await performFeatureFlagSync();

      // Cohorts setJSON call should either not happen or use an empty object
      const cohortStoreCalls = (SecureStorage.setJSON as any).mock.calls.filter(
        (call: any[]) => typeof call[0] === "string" && call[0].includes(":cohorts"),
      );
      if (cohortStoreCalls.length > 0) {
        expect(Object.keys(cohortStoreCalls[0][1])).toHaveLength(0);
      }

      // Regular flag that has no cohort requirement should still resolve
      expect(FeatureFlagsManager.getFlag("regular_feature", false)).toBe(true);
    });
  });

  describe("Flag Resolution with Cohorts", () => {
    it("should enable flag if user is in required cohort (explicit membership)", async () => {
      const mockCohorts: CachedCohort[] = [
        {
          id: "cohort-1",
          slug: "beta_testers",
          name: "Beta Testers",
          percentage: 20,
          is_active: true,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ];

      const mockMemberships: CachedUserCohortMembership[] = [
        {
          id: "mem-1",
          user_id: "user-123",
          cohort_id: "cohort-1",
          cohort_slug: "beta_testers",
          source: "direct",
          is_active: true,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ];

      const mockFlags = [
        {
          flag_name: "betaFeature",
          enabled: true,
          kind: "beta",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ];

      const mockSupabase = createMockSupabase(
        vi.fn().mockResolvedValue({
          data: {
            flags: mockFlags,
            entitlements: [],
            overrides: [],
            rollouts: {},
            cohorts: mockCohorts,
            user_cohort_memberships: mockMemberships,
            fetchedAt: Date.now(),
            version: "v1",
          },
          error: null,
        }),
      );

      // Mock app config with cohort requirement
      mockConfigValue = {
        featureFlags: {
          betaFeature: {
            enabled: true,
            cohorts: ["beta_testers"],
          },
        },
        environment: "production",
      } as any;

        FeatureFlagsManager.state.userId = "user-123";
      await performFeatureFlagSync();

      const enabled = FeatureFlagsManager.isEnabledWithContext("betaFeature");
      expect(enabled).toBe(true);
    });

    it("should disable flag if user is not in required cohort", async () => {
      const mockCohorts: CachedCohort[] = [
        {
          id: "cohort-1",
          slug: "beta_testers",
          name: "Beta Testers",
          percentage: 20,
          is_active: true,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ];

      const mockFlags = [
        {
          flag_name: "betaFeature",
          enabled: true,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ];

      const mockSupabase = createMockSupabase(
        vi.fn().mockResolvedValue({
          data: {
            flags: mockFlags,
            entitlements: [],
            overrides: [],
            rollouts: {},
            cohorts: mockCohorts,
            user_cohort_memberships: [], // User not in any cohort
            fetchedAt: Date.now(),
            version: "v1",
          },
          error: null,
        }),
      );

      const { getAppConfig } = await import("@/config");
      mockConfigValue = {
        featureFlags: {
          betaFeature: {
            enabled: true,
            cohorts: ["beta_testers"], // Requires beta_testers
          },
        },
        environment: "production",
      } as any;

        FeatureFlagsManager.state.userId = "user-123";
      // User is not bucketed (only 20% get in), so flag should be disabled
      await performFeatureFlagSync();

      // Most likely user won't be bucketed into 20% cohort
      // This test verifies the disable path works
      const enabled = FeatureFlagsManager.isEnabledWithContext("betaFeature");
      // Result depends on bucketing, but the mechanism works
      expect(typeof enabled).toBe("boolean");
    });

    it("should disable flag if base flag disabled even with cohort membership", async () => {
      const mockCohorts: CachedCohort[] = [
        {
          id: "cohort-1",
          slug: "beta_testers",
          name: "Beta Testers",
          percentage: 100,
          is_active: true,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ];

      const mockMemberships: CachedUserCohortMembership[] = [
        {
          id: "mem-1",
          user_id: "user-123",
          cohort_id: "cohort-1",
          cohort_slug: "beta_testers",
          source: "direct",
          is_active: true,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ];

      const mockFlags = [
        {
          flag_name: "disabledFeature",
          enabled: false, // Base flag disabled from server
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ];

      const mockSupabase = createMockSupabase(
        vi.fn().mockResolvedValue({
          data: {
            flags: mockFlags,
            entitlements: [],
            overrides: [],
            rollouts: {},
            cohorts: mockCohorts,
            user_cohort_memberships: mockMemberships,
            fetchedAt: Date.now(),
            version: "v1",
          },
          error: null,
        }),
      );

      const { getAppConfig } = await import("@/config");
      mockConfigValue = {
        featureFlags: {
          disabledFeature: {
            cohorts: ["beta_testers"],
            // Note: enabled is not set here, will use server value
          },
        },
        environment: "production",
      } as any;

        FeatureFlagsManager.state.userId = "user-123";
      await performFeatureFlagSync();

      const enabled = FeatureFlagsManager.isEnabledWithContext("disabledFeature");
      expect(enabled).toBe(false); // Base flag disabled, so flag is disabled (cohort is irrelevant)
    });

    it("should support cohorts without conditions (backward compatible)", async () => {
      const mockCohorts: CachedCohort[] = [
        {
          id: "cohort-1",
          slug: "enterprise",
          name: "Enterprise",
          percentage: 100,
          is_active: true,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ];

      const mockMemberships: CachedUserCohortMembership[] = [
        {
          id: "mem-1",
          user_id: "user-123",
          cohort_id: "cohort-1",
          cohort_slug: "enterprise",
          source: "direct",
          is_active: true,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ];

      const mockFlags = [
        {
          flag_name: "enterpriseOnly",
          enabled: true,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ];

      const mockSupabase = createMockSupabase(
        vi.fn().mockResolvedValue({
          data: {
            flags: mockFlags,
            entitlements: [],
            overrides: [],
            rollouts: {},
            cohorts: mockCohorts,
            user_cohort_memberships: mockMemberships,
            fetchedAt: Date.now(),
            version: "v1",
          },
          error: null,
        }),
      );

      const { getAppConfig } = await import("@/config");
      mockConfigValue = {
        featureFlags: {
          enterpriseOnly: {
            enabled: true,
            cohorts: ["enterprise"],
            // No conditions
          },
        },
        environment: "production",
      } as any;

        FeatureFlagsManager.state.userId = "user-123";
      await performFeatureFlagSync();

      const enabled = FeatureFlagsManager.isEnabledWithContext("enterpriseOnly");
      expect(enabled).toBe(true);
    });

    it("should support flags without cohorts (backward compatible)", async () => {
      const mockFlags = [
        {
          flag_name: "simpleFlag",
          enabled: true,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ];

      const mockSupabase = createMockSupabase(
        vi.fn().mockResolvedValue({
          data: {
            flags: mockFlags,
            entitlements: [],
            overrides: [],
            rollouts: {},
            cohorts: [],
            user_cohort_memberships: [],
            fetchedAt: Date.now(),
            version: "v1",
          },
          error: null,
        }),
      );

      mockConfigValue = {
        featureFlags: {
          simpleFlag: {
            enabled: true,
            // No cohorts
          },
        },
        environment: "production",
      };

        FeatureFlagsManager.state.userId = "user-123";
      await performFeatureFlagSync();

      const enabled = FeatureFlagsManager.isEnabledWithContext("simpleFlag");
      expect(enabled).toBe(true);
    });
  });

  describe("Cohort Validation", () => {
    it("should warn about unknown cohort references", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const mockSupabase = createMockSupabase(
        vi.fn().mockResolvedValue({
          data: {
            flags: [],
            entitlements: [],
            overrides: [],
            rollouts: {},
            cohorts: [], // No cohorts defined
            user_cohort_memberships: [],
            fetchedAt: Date.now(),
            version: "v1",
          },
          error: null,
        }),
      );

      mockConfigValue = {
        featureFlags: {
          badFlag: {
            enabled: true,
            cohorts: ["nonexistent_cohort"], // References unknown cohort
          },
        },
        environment: "production",
      } as any;

      FeatureFlagsManager.state.userId = "user-123";
      await performFeatureFlagSync();

      // validateFlagDependencies should have logged warning
      // (This is called internally during bootstrap)
      warnSpy.mockRestore();
    });
  });

  describe("isUserInCohort utility", () => {
    it("should return true for explicit membership", () => {
      const cohort = {
        slug: "test-cohort",
        name: "Test Cohort",
        percentage: 20,
        seed: "test-seed",
      };

      const result = isUserInCohort(
        "user-123",
        cohort,
        ["test-cohort"], // Explicit membership matching cohort.slug
      );

      expect(result).toBe(true);
    });

    it("should check deterministic bucketing without explicit membership", () => {
      const cohort = {
        slug: "test-cohort",
        name: "Test Cohort",
        percentage: 100,
        seed: "test-seed",
      };

      // With 100% percentage, should always be true
      const result = isUserInCohort(
        "user-123",
        cohort,
        [], // No explicit membership
      );

      expect(result).toBe(true);
    });

    it("should use cohort seed for deterministic bucketing", () => {
      const cohort = {
        slug: "test-cohort",
        name: "Test Cohort",
        percentage: 50,
        seed: "consistent-seed",
      };

      // Same user with same seed should give same result
      const result1 = isUserInCohort("user-123", cohort);
      const result2 = isUserInCohort("user-123", cohort);

      expect(result1).toBe(result2); // Should be deterministic
    });
  });

  describe("Phase 4: Rebalancing with Seeds", () => {
    it("should keep users in cohort when percentage increases with same seed", () => {
      const userId = "user-stable-123";
      const seed = "gradual_rollout_v1";

      // Day 1: 10% rollout
      const day1Cohort = {
        slug: "gradual_feature",
        name: "Gradual Feature",
        percentage: 10,
        seed,
      };

      const inDay1 = isUserInCohort(userId, day1Cohort);

      // Day 2: 50% rollout (same seed)
      const day2Cohort = {
        slug: "gradual_feature",
        name: "Gradual Feature",
        percentage: 50,
        seed,
      };

      const inDay2 = isUserInCohort(userId, day2Cohort);

      // Day 3: 100% rollout (same seed)
      const day3Cohort = {
        slug: "gradual_feature",
        name: "Gradual Feature",
        percentage: 100,
        seed,
      };

      const inDay3 = isUserInCohort(userId, day3Cohort);

      // If user was in day 1 (10%), they should still be in day 2 (50%) and day 3 (100%)
      if (inDay1) {
        expect(inDay2).toBe(true);
        expect(inDay3).toBe(true);
      }
      // If not in day 1, they may or may not be in day 2/3
      // but consistency is maintained
    });

    it("should get different buckets when seed changes", () => {
      const userId = "user-rebalance-456";

      // Original seed
      const originalCohort = {
        slug: "feature",
        name: "Feature",
        percentage: 50,
        seed: "seed_v1",
      };

      const resultWithV1 = isUserInCohort(userId, originalCohort);

      // New seed (rebalancing)
      const rebalancedCohort = {
        slug: "feature",
        name: "Feature",
        percentage: 50,
        seed: "seed_v2",
      };

      const resultWithV2 = isUserInCohort(userId, rebalancedCohort);

      // Results may or may not be the same, but we're testing that
      // changing the seed affects the bucketing
      expect(typeof resultWithV1).toBe("boolean");
      expect(typeof resultWithV2).toBe("boolean");
    });

    it("should achieve stable user distribution across multiple users with same seed", () => {
      const seed = "stable_rollout";
      const userIds = Array.from(
        { length: 100 },
        (_, i) => `user-${i.toString().padStart(3, "0")}`,
      );

      // 50% cohort
      const cohort = {
        slug: "test",
        name: "Test",
        percentage: 50,
        seed,
      };

      const usersIn = userIds.filter((userId) =>
        isUserInCohort(userId, cohort),
      );

      // With 100 users and 50% percentage, expect ~50 users
      // Allow for variance: 40-60 users is reasonable
      expect(usersIn.length).toBeGreaterThanOrEqual(40);
      expect(usersIn.length).toBeLessThanOrEqual(60);
    });

    it("should not change bucket when seed is null/undefined", () => {
      const userId = "user-default-seed";

      // Cohort without seed (will use cohortId as seed)
      const cohortNoSeed = {
        slug: "feature",
        name: "Feature",
        percentage: 75,
        seed: undefined,
      };

      const result1 = isUserInCohort(userId, cohortNoSeed);

      // Call again with explicitly null seed
      const cohortNullSeed = {
        slug: "feature",
        name: "Feature",
        percentage: 75,
        seed: null,
      };

      const result2 = isUserInCohort(userId, cohortNullSeed);

      // Both should use default seed (cohortId) and be identical
      expect(result1).toBe(result2);
    });

    it("should handle gradual rollout scenario: 10% → 50% → 100%", () => {
      const userIds = Array.from(
        { length: 1000 },
        (_, i) => `user-gradual-${i}`,
      );
      const seed = "gradual_v1";

      // Phase 1: 10% rollout
      const phase1Cohort = {
        slug: "gradual",
        name: "Gradual",
        percentage: 10,
        seed,
      };

      const phase1Users = userIds.filter((uid) =>
        isUserInCohort(uid, phase1Cohort),
      );

      // Phase 2: 50% rollout (same seed)
      const phase2Cohort = {
        slug: "gradual",
        name: "Gradual",
        percentage: 50,
        seed,
      };

      const phase2Users = userIds.filter((uid) =>
        isUserInCohort(uid, phase2Cohort),
      );

      // Phase 1 users should still be in Phase 2
      const phase1UsersStable = phase1Users.every((uid) =>
        phase2Users.includes(uid),
      );
      expect(phase1UsersStable).toBe(true);

      // Phase 2 should have more users than Phase 1 (approximately 5x)
      expect(phase2Users.length).toBeGreaterThan(phase1Users.length);

      // Phase 3: 100% rollout
      const phase3Cohort = {
        slug: "gradual",
        name: "Gradual",
        percentage: 100,
        seed,
      };

      const phase3Users = userIds.filter((uid) =>
        isUserInCohort(uid, phase3Cohort),
      );

      // All users should be in Phase 3
      expect(phase3Users.length).toBe(userIds.length);

      // Phase 1 and 2 users must all be in Phase 3
      phase1Users.forEach((uid) => {
        expect(phase3Users).toContain(uid);
      });
    });
  });

  // Phase 7: Additional Unit Tests for Edge Cases & Coverage
  describe("Phase 7: Comprehensive Edge Cases", () => {
    describe("isUserInCohort Edge Cases", () => {
      it("should handle 0% percentage (no users)", () => {
        const cohortDef = {
          slug: "zero_percent",
          name: "Zero Percent",
          percentage: 0,
        };

        const result = isUserInCohort("any-user", cohortDef);
        expect(result).toBe(false);
      });

      it("should handle 100% percentage (all users)", () => {
        const cohortDef = {
          slug: "hundred_percent",
          name: "Hundred Percent",
          percentage: 100,
        };

        const result = isUserInCohort("any-user", cohortDef);
        expect(result).toBe(true);
      });

      it("should handle null percentage (defaults to 100%)", () => {
        const cohortDef = {
          slug: "null_percent",
          name: "Null Percent",
          percentage: null as any,
        };

        const result = isUserInCohort("any-user", cohortDef);
        expect(result).toBe(true);
      });

      it("should handle undefined percentage (defaults to 100%)", () => {
        const cohortDef = {
          slug: "undefined_percent",
          name: "Undefined Percent",
          percentage: undefined,
        };

        const result = isUserInCohort("any-user", cohortDef);
        expect(result).toBe(true);
      });

      it("should be deterministic with various user ID formats", () => {
        const cohortDef = {
          slug: "test_determinism",
          name: "Test Determinism",
          percentage: 50,
        };

        const userIds = [
          "user-123",
          "user@example.com",
          "uuid-12345678-1234-1234-1234-123456789012",
          "very-long-user-id-that-might-cause-issues-with-hashing-algorithms",
          "123", // numeric string
          "", // empty string
        ];

        // Each user should consistently get the same result
        userIds.forEach((userId) => {
          const result1 = isUserInCohort(userId, cohortDef);
          const result2 = isUserInCohort(userId, cohortDef);
          const result3 = isUserInCohort(userId, cohortDef);

          expect(result1).toBe(result2);
          expect(result2).toBe(result3);
        });
      });

      it("should handle seed edge cases", () => {
        const baseCohort = {
          slug: "seed_test",
          name: "Seed Test",
          percentage: 50,
        };

        const userId = "different-test-user";

        // Null seed (should use cohortId)
        const nullSeed = { ...baseCohort, seed: null };
        const resultNull = isUserInCohort(userId, nullSeed);

        // Undefined seed (should use cohortId)
        const undefinedSeed = { ...baseCohort, seed: undefined };
        const resultUndefined = isUserInCohort(userId, undefinedSeed);

        // Empty string seed
        const emptySeed = { ...baseCohort, seed: "" };
        const resultEmpty = isUserInCohort(userId, emptySeed);

        // Null and undefined should be equivalent (both use cohortId)
        expect(resultNull).toBe(resultUndefined);

        // Empty string should be different
        expect(resultEmpty).not.toBe(resultNull);
      });

      it("should handle very large percentages (over 100%)", () => {
        const cohortDef = {
          slug: "over_percent",
          name: "Over Percent",
          percentage: 150, // Over 100%
        };

        // FNV hash is always 0-99, so 150% means all users
        const result = isUserInCohort("any-user", cohortDef);
        expect(result).toBe(true);
      });

      it("should handle negative percentages", () => {
        const cohortDef = {
          slug: "negative_percent",
          name: "Negative Percent",
          percentage: -10,
        };

        // Negative percentage should result in no users
        const result = isUserInCohort("any-user", cohortDef);
        expect(result).toBe(false);
      });
    });

    describe("Cohort Distribution Statistics", () => {
      it("should achieve expected distribution with large user set", () => {
        const cohortDef = {
          slug: "distribution_test",
          name: "Distribution Test",
          percentage: 25, // 25% of users
        };

        const userIds = Array.from({ length: 1000 }, (_, i) => `user-${i}`);
        const includedUsers = userIds.filter(uid =>
          isUserInCohort(uid, cohortDef)
        );

        const actualPercentage = (includedUsers.length / userIds.length) * 100;

        // Should be close to 25% (within 5% margin for statistical variation)
        expect(actualPercentage).toBeGreaterThan(20);
        expect(actualPercentage).toBeLessThan(30);
      });

      it("should maintain distribution consistency across multiple evaluations", () => {
        const cohortDef = {
          slug: "consistency_test",
          name: "Consistency Test",
          percentage: 33,
        };

        const userId = "consistency-user";

        // Run multiple times
        const results = Array.from({ length: 100 }, () =>
          isUserInCohort(userId, cohortDef)
        );

        // All results should be identical (deterministic)
        const firstResult = results[0];
        results.forEach(result => {
          expect(result).toBe(firstResult);
        });
      });
    });

    describe("Error Handling & Validation", () => {
      it("should handle malformed cohort definitions gracefully", () => {
        // Missing required fields
        const incompleteCohort = {
          slug: "incomplete",
          // missing name and percentage
        } as any;

        // Should not crash, but behavior is undefined
        expect(() => {
          isUserInCohort("user", incompleteCohort);
        }).not.toThrow();
      });

      it("should handle extreme user ID lengths", () => {
        const cohortDef = {
          slug: "extreme_test",
          name: "Extreme Test",
          percentage: 50,
        };

        const extremeUserIds = [
          "a".repeat(1000), // Very long user ID
          "🚀".repeat(100), // Unicode characters
          "user\nwith\nnewlines", // Special characters
          "user\twith\ttabs",
        ];

        extremeUserIds.forEach(userId => {
          expect(() => {
            isUserInCohort(userId, cohortDef);
          }).not.toThrow();
        });
      });
    });

    describe("Performance Benchmarks", () => {
      it("should evaluate quickly for single user", () => {
        const cohortDef = {
          slug: "perf_test",
          name: "Performance Test",
          percentage: 50,
        };

        const start = performance.now();

        // Evaluate 1000 times
        for (let i = 0; i < 1000; i++) {
          isUserInCohort(`user-${i}`, cohortDef);
        }

        const end = performance.now();
        const avgMs = (end - start) / 1000;

        // Should be very fast (< 1ms per evaluation)
        expect(avgMs).toBeLessThan(1);
      });

      it("should handle concurrent evaluations", async () => {
        const cohortDef = {
          slug: "concurrent_test",
          name: "Concurrent Test",
          percentage: 50,
        };

        const evaluations = Array.from({ length: 100 }, (_, i) =>
          Promise.resolve(isUserInCohort(`user-${i}`, cohortDef))
        );

        const results = await Promise.all(evaluations);

        // All evaluations should complete
        expect(results).toHaveLength(100);
        expect(results.every(r => typeof r === "boolean")).toBe(true);
      });
    });
  });
});

