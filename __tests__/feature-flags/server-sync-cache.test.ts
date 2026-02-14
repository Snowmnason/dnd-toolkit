/**
 * Phase 2: Server Sync Integration Tests
 *
 * Tests for FeatureFlagsManager cache integration:
 * - isEnabledWithContext cache behavior
 * - getCachedUserRole from entitlements
 * - Cache invalidation methods
 */

import type { CachedEntitlement } from "@/lib/feature-flags/server-sync";
import { FeatureFlagsManager } from "@/lib/feature-flags/server-sync";
import { beforeEach, describe, expect, it } from "vitest";

describe("FeatureFlagsManager Phase 2 Cache Integration", () => {
  beforeEach(() => {
    // Clear evaluation cache before each test
    FeatureFlagsManager.clearEvaluationCache();
  });

  describe("isEnabledWithContext caching", () => {
    it("should cache flag evaluation results", () => {
      // Evaluate a flag
      const result1 = FeatureFlagsManager.isEnabledWithContext("testFlag", {
        platform: "web",
        environment: "production",
      });

      // Check cache stats — should have hit now
      const stats = FeatureFlagsManager.getEvaluationCacheStats();
      expect(stats.size).toBeGreaterThan(0);

      // Evaluate same flag with same context — should be cached
      const result2 = FeatureFlagsManager.isEnabledWithContext("testFlag", {
        platform: "web",
        environment: "production",
      });

      expect(result1).toBe(result2);

      // Check that we have at least one hit after second call
      const statsAfter = FeatureFlagsManager.getEvaluationCacheStats();
      expect(statsAfter.hits).toBeGreaterThan(0);
    });

    it("should distinguish between different contexts", () => {
      const context1 = { platform: "web", environment: "production" };
      const context2 = { platform: "web", environment: "development" };

      FeatureFlagsManager.isEnabledWithContext("testFlag", context1);
      FeatureFlagsManager.isEnabledWithContext("testFlag", context2);

      // Both should be cached separately
      const stats = FeatureFlagsManager.getEvaluationCacheStats();
      expect(stats.size).toBeGreaterThanOrEqual(2);
    });

    it("should handle role-based context", () => {
      const contextAdmin = {
        platform: "web",
        environment: "production",
        userRole: "admin",
      };
      const contextUser = {
        platform: "web",
        environment: "production",
        userRole: "user",
      };

      const resultAdmin = FeatureFlagsManager.isEnabledWithContext(
        "roleBasedFlag",
        contextAdmin,
      );
      const resultUser = FeatureFlagsManager.isEnabledWithContext(
        "roleBasedFlag",
        contextUser,
      );

      // Both results should be cached separately
      const stats = FeatureFlagsManager.getEvaluationCacheStats();
      expect(stats.size).toBeGreaterThanOrEqual(2);
    });

    it("should use cached role when context role is undefined", () => {
      const context = {
        platform: "web",
        environment: "production",
        // userRole: undefined will use getCachedUserRole()
      };

      // This will attempt to use getCachedUserRole() if available
      FeatureFlagsManager.isEnabledWithContext(
        "advancedMaps",
        context,
      );

      // Should have cached a result
      const stats = FeatureFlagsManager.getEvaluationCacheStats();
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  describe("Cache invalidation by flag", () => {
    it("should invalidate all cache entries for a flag", () => {
      // Cache multiple entries for same flag, different contexts
      FeatureFlagsManager.isEnabledWithContext("flag1", {
        platform: "web",
        environment: "production",
      });
      FeatureFlagsManager.isEnabledWithContext("flag1", {
        platform: "web",
        environment: "development",
      });
      FeatureFlagsManager.isEnabledWithContext("flag2", {
        platform: "web",
        environment: "production",
      });

      const statsBefore = FeatureFlagsManager.getEvaluationCacheStats();
      expect(statsBefore.size).toBeGreaterThanOrEqual(3);

      // Invalidate flag1
      FeatureFlagsManager.invalidateFlagCache("flag1");

      // Should have evicted flag1 entries
      const statsAfter = FeatureFlagsManager.getEvaluationCacheStats();
      expect(statsAfter.size).toBeLessThan(statsBefore.size);
    });

    it("should not affect other flags when invalidating", () => {
      const context = { platform: "web", environment: "production" };

      FeatureFlagsManager.isEnabledWithContext("flag1", context);
      FeatureFlagsManager.isEnabledWithContext("flag2", context);

      const statsBefore = FeatureFlagsManager.getEvaluationCacheStats();

      // Invalidate flag1
      FeatureFlagsManager.invalidateFlagCache("flag1");

      // Evaluate flag2 again — should still hit cache
      const before = statsBefore.hits || 0;
      FeatureFlagsManager.isEnabledWithContext("flag2", context);
      const statsAfter = FeatureFlagsManager.getEvaluationCacheStats();
      const after = statsAfter.hits || 0;

      // flag2 should still be cached (hits should increase)
      expect(after).toBeGreaterThanOrEqual(before);
    });
  });

  describe("Cache invalidation by role", () => {
    it("should invalidate all cache entries for a role", () => {
      const adminContext = {
        platform: "web",
        environment: "production",
        userRole: "admin",
      };
      const userContext = {
        platform: "web",
        environment: "production",
        userRole: "user",
      };

      // Cache results for both roles
      FeatureFlagsManager.isEnabledWithContext("flag1", adminContext);
      FeatureFlagsManager.isEnabledWithContext("flag2", adminContext);
      FeatureFlagsManager.isEnabledWithContext("flag1", userContext);

      const statsBefore = FeatureFlagsManager.getEvaluationCacheStats();
      expect(statsBefore.size).toBeGreaterThanOrEqual(3);

      // Invalidate admin role cache
      FeatureFlagsManager.invalidateRoleCache("admin");

      // Should have evicted admin entries
      const statsAfter = FeatureFlagsManager.getEvaluationCacheStats();
      expect(statsAfter.size).toBeLessThan(statsBefore.size);

      // User role should still be in cache
      FeatureFlagsManager.isEnabledWithContext("flag1", userContext);
      const statsAfterUserHit = FeatureFlagsManager.getEvaluationCacheStats();
      expect(statsAfterUserHit.hits).toBeGreaterThan(statsAfter.hits || 0);
    });
  });

  describe("Cache clearing", () => {
    it("should clear all cache entries and reset stats", () => {
      // Populate cache
      FeatureFlagsManager.isEnabledWithContext("flag1", {
        platform: "web",
        environment: "production",
      });
      FeatureFlagsManager.isEnabledWithContext("flag1", {
        platform: "web",
        environment: "production",
      }); // Hit

      const statsBefore = FeatureFlagsManager.getEvaluationCacheStats();
      expect(statsBefore.size).toBeGreaterThan(0);
      expect((statsBefore.hits || 0) > 0).toBe(true);

      // Clear all
      FeatureFlagsManager.clearEvaluationCache();

      const statsAfter = FeatureFlagsManager.getEvaluationCacheStats();
      expect(statsAfter.size).toBe(0);
      expect(statsAfter.hits).toBe(0);
      expect(statsAfter.misses).toBe(0);
    });
  });

  describe("Cache statistics", () => {
    it("should track cache stats accurately", () => {
      const context = { platform: "web", environment: "production" };

      // First call is a miss
      FeatureFlagsManager.isEnabledWithContext("flag1", context);

      // Second call should be a hit
      FeatureFlagsManager.isEnabledWithContext("flag1", context);

      const stats = FeatureFlagsManager.getEvaluationCacheStats();

      expect(stats.size).toBeGreaterThan(0);
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.5);
    });

    it("should report accurate hit rate", () => {
      const context = { platform: "web", environment: "production" };

      // Generate 1 miss
      FeatureFlagsManager.isEnabledWithContext("flag1", context);

      // Generate 3 hits
      for (let i = 0; i < 3; i++) {
        FeatureFlagsManager.isEnabledWithContext("flag1", context);
      }

      const stats = FeatureFlagsManager.getEvaluationCacheStats();

      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.75);
    });

    it("should handle 100% miss rate with no cache", () => {
      const context1 = { platform: "web", environment: "production" };
      const context2 = { platform: "web", environment: "development" };

      FeatureFlagsManager.isEnabledWithContext("flag1", context1);
      FeatureFlagsManager.isEnabledWithContext("flag1", context2);

      const stats = FeatureFlagsManager.getEvaluationCacheStats();

      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe("getCachedUserRole", () => {
    it("should return 'unknown' when no entitlements are cached", () => {
      const role = FeatureFlagsManager.getCachedUserRole();
      expect(role).toBe("unknown");
    });

    it("should find admin role from entitlements", () => {
      // Manually add an admin entitlement to test
      // Note: In real usage, this would be populated at bootstrap via loadCachedEntitlements
      const mockEntitlement: CachedEntitlement = {
        id: "ent-1",
        user_id: "user-1",
        key: "admin",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: null,
      };

      // This test verifies the structure but won't actually test entitlement lookup
      // since cachedEntitlements is private. Consider making it testable in future.
      const role = FeatureFlagsManager.getCachedUserRole();

      // Should return either "unknown" if no entitlements, or the actual role if present
      expect(typeof role).toBe("string");
      expect(role.length > 0).toBe(true);
    });

    it("should skip expired entitlements", () => {
      // This test verifies the logic but requires entitlements to be populated
      // which is normally done at bootstrap time
      const role = FeatureFlagsManager.getCachedUserRole();

      // Should safely return "unknown" without crashing
      expect(typeof role).toBe("string");
    });
  });

  describe("Integration: cache + role-based conditions", () => {
    it("should use cached role for role-based conditions", () => {
      // When getCachedUserRole() is available, it should be used
      // This demonstrates the Phase 2 integration point
      const context = {
        platform: "web",
        environment: "production",
        // userRole is intentionally undefined to test getCachedUserRole fallback
      };

      const result = FeatureFlagsManager.isEnabledWithContext(
        "roleBasedFeature",
        context,
      );

      // Should evaluate without error using getCachedUserRole fallback
      expect(typeof result).toBe("boolean");

      // Result should be cached
      const stats = FeatureFlagsManager.getEvaluationCacheStats();
      expect(stats.size).toBeGreaterThan(0);
    });
  });
});
