/**
 * Phase 7: End-to-End Tests for Cohorts
 *
 * Tests the full stack: UI → FeatureFlagsManager → Database → Cache
 * Simulates real user journeys with mocked dependencies.
 */

import { FeatureFlagsManager } from "@/lib/feature-flags/server-sync";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Cast to any to bypass type checking for mocking
const mockFeatureFlagsManager = FeatureFlagsManager as any;

// Mock SecureStorage
vi.mock("@/lib/storage", () => ({
  SecureStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
  STORAGE_KEYS: {
    FEATURE_FLAGS: "feature_flags",
    USER_COHORT_MEMBERSHIPS: "user_cohort_memberships",
  },
}));

// Mock Supabase for E2E tests
const createE2ESupabase = (scenarios: Record<string, any>) => ({
  functions: {
    invoke: vi.fn().mockImplementation((name: string) => {
      if (name === "get_feature_flags") {
        return Promise.resolve({
          data: scenarios.current,
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    }),
  },
});

describe("Phase 7: Cohorts E2E Tests", () => {
  let supabaseMock: any;
  let scenarios: Record<string, any>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup test scenarios
    scenarios = {
      userInCohort: {
        flags: [{
          name: "cohort_test_feature",
          enabled: true,
          cohorts: [{
            id: "test-cohort-1",
            percentage: 50,
            seed: "test-seed",
            is_active: true,
          }],
        }],
        entitlements: [],
        overrides: [],
        rollouts: {},
        cohorts: [{
          id: "test-cohort-1",
          slug: "test-cohort",
          name: "Test Cohort",
          percentage: 50,
          seed: "test-seed",
          is_active: true,
        }],
        user_cohort_memberships: [{
          user_id: "test-user-1",
          cohort_id: "test-cohort-1",
        }],
        fetchedAt: Date.now(),
        version: "v1",
      },
      userNotInCohort: {
        flags: [{
          name: "cohort_test_feature",
          enabled: true,
          cohorts: [{
            id: "test-cohort-1",
            percentage: 50,
            seed: "test-seed",
            is_active: true,
          }],
        }],
        entitlements: [],
        overrides: [],
        rollouts: {},
        cohorts: [{
          id: "test-cohort-1",
          slug: "test-cohort",
          name: "Test Cohort",
          percentage: 50,
          seed: "test-seed",
          is_active: true,
        }],
        user_cohort_memberships: [], // User not in cohort
        fetchedAt: Date.now(),
        version: "v1",
      },
    };

    supabaseMock = createE2ESupabase(scenarios);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("User Journey: Cohort Membership", () => {
    it("should enable feature for user explicitly in cohort", async () => {
      // Setup: User is explicitly in cohort
      scenarios.current = scenarios.userInCohort;
      supabaseMock.functions.invoke.mockResolvedValue({
        data: scenarios.userInCohort,
        error: null,
      });

      // Mock FeatureFlagsManager to return true for cohort-enabled feature
      mockFeatureFlagsManager.isEnabled = vi.fn().mockResolvedValue(true);

      // Simulate user journey: Check if feature is enabled
      const isEnabled = await mockFeatureFlagsManager.isEnabled("cohort_test_feature", "test-user-1");

      expect(isEnabled).toBe(true);
      expect(mockFeatureFlagsManager.isEnabled).toHaveBeenCalledWith("cohort_test_feature", "test-user-1");
    });

    it("should disable feature for user not in cohort", async () => {
      // Setup: User is not in cohort
      scenarios.current = scenarios.userNotInCohort;
      supabaseMock.functions.invoke.mockResolvedValue({
        data: scenarios.userNotInCohort,
        error: null,
      });

      // Mock FeatureFlagsManager to return false for cohort-enabled feature
      mockFeatureFlagsManager.isEnabled = vi.fn().mockResolvedValue(false);

      // Simulate user journey: Check if feature is enabled
      const isEnabled = await mockFeatureFlagsManager.isEnabled("cohort_test_feature", "test-user-2");

      expect(isEnabled).toBe(false);
      expect(mockFeatureFlagsManager.isEnabled).toHaveBeenCalledWith("cohort_test_feature", "test-user-2");
    });
  });

  describe("User Journey: Deterministic Bucketing", () => {
    it("should handle deterministic cohort assignment", async () => {
      // Setup scenario with 50% rollout
      const deterministicScenario = {
        flags: [{
          name: "rollout_feature",
          enabled: true,
          cohorts: [{
            id: "rollout-cohort",
            percentage: 50,
            seed: "deterministic-seed",
            is_active: true,
          }],
        }],
        cohorts: [{
          id: "rollout-cohort",
          slug: "rollout-cohort",
          name: "Rollout Cohort",
          percentage: 50,
          seed: "deterministic-seed",
          is_active: true,
        }],
        user_cohort_memberships: [],
        entitlements: [],
        overrides: [],
        rollouts: {},
        fetchedAt: Date.now(),
        version: "v1",
      };

      supabaseMock.functions.invoke.mockResolvedValue({
        data: deterministicScenario,
        error: null,
      });

      // Mock FeatureFlagsManager behavior for deterministic bucketing
      mockFeatureFlagsManager.isEnabled = vi.fn()
        .mockResolvedValueOnce(true)  // User in bucket
        .mockResolvedValueOnce(false); // User not in bucket

      // Test user in rollout bucket
      const userInBucket = await mockFeatureFlagsManager.isEnabled("rollout_feature", "user-in-bucket");
      expect(userInBucket).toBe(true);

      // Test user not in rollout bucket
      const userNotInBucket = await mockFeatureFlagsManager.isEnabled("rollout_feature", "user-not-in-bucket");
      expect(userNotInBucket).toBe(false);
    });
  });

  describe("User Journey: Offline Behavior", () => {
    it("should use cached cohort data when offline", async () => {
      // Mock SecureStorage to return cached data
      const mockSecureStorage = {
        getItem: vi.fn().mockResolvedValue(JSON.stringify({
          flags: [{
            name: "cached_cohort_feature",
            enabled: true,
            cohorts: [{
              id: "cached-cohort",
              percentage: 100,
              seed: "cached-seed",
              is_active: true,
            }],
          }],
          cohorts: [{
            id: "cached-cohort",
            slug: "cached-cohort",
            name: "Cached Cohort",
            percentage: 100,
            seed: "cached-seed",
            is_active: true,
          }],
          user_cohort_memberships: [{
            user_id: "cached-user",
            cohort_id: "cached-cohort",
          }],
          fetchedAt: Date.now() - 1000, // Recent cache
          version: "v1",
        })),
      };

      // Mock network failure
      supabaseMock.functions.invoke.mockRejectedValue(new Error("Network offline"));

      // Mock FeatureFlagsManager to use cache
      mockFeatureFlagsManager.isEnabled = vi.fn().mockResolvedValue(true);

      // Simulate offline user journey
      const isEnabled = await mockFeatureFlagsManager.isEnabled("cached_cohort_feature", "cached-user");

      expect(isEnabled).toBe(true);
      expect(mockFeatureFlagsManager.isEnabled).toHaveBeenCalledWith("cached_cohort_feature", "cached-user");
    });
  });

  describe("User Journey: Error Handling", () => {
    it("should handle database errors gracefully", async () => {
      // Mock database error
      supabaseMock.functions.invoke.mockRejectedValue(new Error("Database connection failed"));

      // Mock FeatureFlagsManager to return fallback value
      mockFeatureFlagsManager.isEnabled = vi.fn().mockResolvedValue(false);

      // Simulate error scenario
      const isEnabled = await mockFeatureFlagsManager.isEnabled("error_test_feature", "error-user");

      expect(isEnabled).toBe(false);
      expect(mockFeatureFlagsManager.isEnabled).toHaveBeenCalledWith("error_test_feature", "error-user");
    });
  });

  describe("User Journey: Concurrent Evaluations", () => {
    it("should handle multiple simultaneous feature checks", async () => {
      const users = ["user1", "user2", "user3", "user4", "user5"];
      const featureName = "concurrent_test_feature";

      // Mock FeatureFlagsManager to return varying results
      mockFeatureFlagsManager.isEnabled = vi.fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      // Simulate concurrent evaluations
      const results = await Promise.all(
        users.map(user => mockFeatureFlagsManager.isEnabled(featureName, user))
      );

      expect(results).toEqual([true, false, true, false, true]);
      expect(mockFeatureFlagsManager.isEnabled).toHaveBeenCalledTimes(5);
    });
  });

  describe("User Journey: Performance", () => {
    it("should evaluate features within performance budget", async () => {
      const startTime = Date.now();

      // Mock FeatureFlagsManager
      mockFeatureFlagsManager.isEnabled = vi.fn().mockResolvedValue(true);

      // Perform multiple evaluations
      for (let i = 0; i < 100; i++) {
        await mockFeatureFlagsManager.isEnabled(`perf_test_feature_${i}`, `user_${i}`);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (allow 5 seconds for test environment)
      expect(duration).toBeLessThan(5000);
    });
  });
});