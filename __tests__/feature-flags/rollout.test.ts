/**
 * Rollout Bucketing Tests
 *
 * Tests deterministic user bucketing for feature flag rollouts.
 * Covers FNV-1a hashing, percentage boundaries, seed rebalancing, and memoization.
 */

import {
  bucketPercent,
  clearBucketCache,
  getBucketMemoized,
  isInRollout,
  isInRolloutMemoized,
} from "@/pure-algo-immutables/rollout";
import { beforeEach, describe, expect, it } from "vitest";

describe("bucketPercent", () => {
  it("should return deterministic buckets (0-99)", () => {
    const userId = "test-user-123";
    const flagName = "test-flag";

    // Same inputs should always return same bucket
    const bucket1 = bucketPercent(userId, flagName);
    const bucket2 = bucketPercent(userId, flagName);
    const bucket3 = bucketPercent(userId, flagName);

    expect(bucket1).toBe(bucket2);
    expect(bucket2).toBe(bucket3);
    expect(bucket1).toBeGreaterThanOrEqual(0);
    expect(bucket1).toBeLessThanOrEqual(99);
  });

  it("should return different buckets for different users", () => {
    const flagName = "test-flag";

    const bucket1 = bucketPercent("user-1", flagName);
    const bucket2 = bucketPercent("user-2", flagName);

    // Different users should generally get different buckets
    // (though theoretically possible to collide, very unlikely with good hash)
    expect(bucket1).not.toBe(bucket2);
  });

  it("should return different buckets for different flags", () => {
    const userId = "test-user";

    const bucket1 = bucketPercent(userId, "flag-a");
    const bucket2 = bucketPercent(userId, "flag-b");

    expect(bucket1).not.toBe(bucket2);
  });

  it("should handle seed for rebalancing", () => {
    const userId = "test-user";
    const flagName = "test-flag";

    const bucket1 = bucketPercent(userId, flagName, "seed-v1");
    const bucket2 = bucketPercent(userId, flagName, "seed-v2");

    // Different seeds should generally produce different buckets
    expect(bucket1).not.toBe(bucket2);
  });

  it("should be consistent with same seed", () => {
    const userId = "test-user";
    const flagName = "test-flag";
    const seed = "consistent-seed";

    const bucket1 = bucketPercent(userId, flagName, seed);
    const bucket2 = bucketPercent(userId, flagName, seed);

    expect(bucket1).toBe(bucket2);
  });

  it("should handle empty seed as default", () => {
    const userId = "test-user";
    const flagName = "test-flag";

    const bucket1 = bucketPercent(userId, flagName);
    const bucket2 = bucketPercent(userId, flagName, "");

    expect(bucket1).toBe(bucket2);
  });
});

describe("isInRollout", () => {
  const userId = "test-user";
  const flagName = "test-flag";

  it("should return true for 100% rollout", () => {
    const result = isInRollout(userId, flagName, 100);
    expect(result).toBe(true);
  });

  it("should return false for 0% rollout", () => {
    const result = isInRollout(userId, flagName, 0);
    expect(result).toBe(false);
  });

  it("should clamp negative percentages to 0", () => {
    const result = isInRollout(userId, flagName, -10);
    expect(result).toBe(false);
  });

  it("should clamp percentages over 100 to 100", () => {
    const result = isInRollout(userId, flagName, 150);
    expect(result).toBe(true);
  });

  it("should floor non-integer percentages", () => {
    const result1 = isInRollout(userId, flagName, 50.7);
    const result2 = isInRollout(userId, flagName, 50);

    expect(result1).toBe(result2);
  });

  it("should be deterministic for same inputs", () => {
    const result1 = isInRollout(userId, flagName, 50);
    const result2 = isInRollout(userId, flagName, 50);

    expect(result1).toBe(result2);
  });

  it("should respect seed for rebalancing", () => {
    const result1 = isInRollout(userId, flagName, 50, "seed1");
    const result2 = isInRollout(userId, flagName, 50, "seed2");

    // Results may differ due to different seeds
    // We can't assert they differ, but they should be consistent
    const result1Again = isInRollout(userId, flagName, 50, "seed1");
    expect(result1).toBe(result1Again);
  });
});

describe("getBucketMemoized", () => {
  beforeEach(() => {
    clearBucketCache();
  });

  it("should return same result as bucketPercent", () => {
    const userId = "test-user";
    const flagName = "test-flag";
    const seed = "test-seed";

    const direct = bucketPercent(userId, flagName, seed);
    const memoized = getBucketMemoized(userId, flagName, seed);

    expect(memoized).toBe(direct);
  });

  it("should cache results for performance", () => {
    const userId = "test-user";
    const flagName = "test-flag";

    // First call should calculate
    const bucket1 = getBucketMemoized(userId, flagName);

    // Second call should use cache
    const bucket2 = getBucketMemoized(userId, flagName);

    expect(bucket1).toBe(bucket2);
  });

  it("should use separate cache keys for different seeds", () => {
    const userId = "test-user";
    const flagName = "test-flag";

    const bucket1 = getBucketMemoized(userId, flagName, "seed1");
    const bucket2 = getBucketMemoized(userId, flagName, "seed2");

    // Should be different (or same by coincidence, but unlikely)
    // More importantly, they should be consistent
    const bucket1Again = getBucketMemoized(userId, flagName, "seed1");
    expect(bucket1).toBe(bucket1Again);
  });
});

describe("isInRolloutMemoized", () => {
  beforeEach(() => {
    clearBucketCache();
  });

  it("should return same result as isInRollout", () => {
    const userId = "test-user";
    const flagName = "test-flag";
    const percentage = 50;
    const seed = "test-seed";

    const direct = isInRollout(userId, flagName, percentage, seed);
    const memoized = isInRolloutMemoized(userId, flagName, percentage, seed);

    expect(memoized).toBe(direct);
  });

  it("should handle percentage clamping like isInRollout", () => {
    const userId = "test-user";
    const flagName = "test-flag";

    const result1 = isInRolloutMemoized(userId, flagName, -5);
    const result2 = isInRolloutMemoized(userId, flagName, 150);

    expect(result1).toBe(false); // Clamped to 0
    expect(result2).toBe(true); // Clamped to 100
  });

  it("should be consistent across multiple calls", () => {
    const userId = "test-user";
    const flagName = "test-flag";
    const percentage = 25;

    const result1 = isInRolloutMemoized(userId, flagName, percentage);
    const result2 = isInRolloutMemoized(userId, flagName, percentage);
    const result3 = isInRolloutMemoized(userId, flagName, percentage);

    expect(result1).toBe(result2);
    expect(result2).toBe(result3);
  });
});

describe("clearBucketCache", () => {
  it("should clear the memoization cache", () => {
    const userId = "test-user";
    const flagName = "test-flag";

    // Fill cache
    getBucketMemoized(userId, flagName);

    // Clear cache
    clearBucketCache();

    // Cache should be empty (though we can't directly test this)
    // The function should not throw and subsequent calls should work
    expect(() => {
      getBucketMemoized(userId, flagName);
    }).not.toThrow();
  });
});

describe("rollout distribution", () => {
  it("should distribute users roughly evenly across buckets", () => {
    const flagName = "distribution-test";
    const sampleSize = 1000;
    const buckets = new Array(100).fill(0);

    // Sample many users
    for (let i = 0; i < sampleSize; i++) {
      const bucket = bucketPercent(`user-${i}`, flagName);
      buckets[bucket]++;
    }

    // Check that no bucket is completely empty (with large sample)
    const emptyBuckets = buckets.filter((count) => count === 0).length;
    expect(emptyBuckets).toBeLessThan(10); // Allow some variance

    // Check that distribution is roughly uniform
    const average = sampleSize / 100;
    const variance =
      buckets.reduce((sum, count) => {
        return sum + Math.pow(count - average, 2);
      }, 0) / 100;

    // Variance should be reasonable (not too high)
    expect(variance).toBeLessThan(average * 2);
  });

  it("should provide expected rollout percentages", () => {
    const flagName = "percentage-test";
    const sampleSize = 10000;
    const testPercentages = [1, 5, 10, 25, 50, 75, 90, 99];

    testPercentages.forEach((percentage) => {
      let inRolloutCount = 0;

      for (let i = 0; i < sampleSize; i++) {
        if (isInRollout(`user-${i}`, flagName, percentage)) {
          inRolloutCount++;
        }
      }

      const actualPercentage = (inRolloutCount / sampleSize) * 100;
      const tolerance = 2; // Allow 2% variance

      expect(actualPercentage).toBeGreaterThanOrEqual(percentage - tolerance);
      expect(actualPercentage).toBeLessThanOrEqual(percentage + tolerance);
    });
  });
});
