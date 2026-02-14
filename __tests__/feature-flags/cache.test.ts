/**
 * Phase 2: LRU Cache Tests
 *
 * Tests for FlagEvaluationCache and cache integration into FeatureFlagsManager.
 * Covers:
 * - LRU eviction when cache is full
 * - TTL expiry and cleanup
 * - Cache hits and misses
 * - Cache invalidation by flag name
 * - Cache invalidation by user role
 * - Full cache clearing
 * - Cache statistics
 */

import { FlagEvaluationCache, LRUCache } from "@/lib/feature-flags/cache";
import { describe, expect, it } from "vitest";

describe("LRUCache", () => {
  describe("Basic operations", () => {
    it("should store and retrieve values", () => {
      const cache = new LRUCache<string>();
      cache.set("key1", "value1");
      expect(cache.get("key1")).toBe("value1");
    });

    it("should return undefined for missing keys", () => {
      const cache = new LRUCache<string>();
      expect(cache.get("missing")).toBeUndefined();
    });

    it("should update existing keys", () => {
      const cache = new LRUCache<string>();
      cache.set("key1", "value1");
      cache.set("key1", "value2");
      expect(cache.get("key1")).toBe("value2");
    });

    it("should delete a key", () => {
      const cache = new LRUCache<string>();
      cache.set("key1", "value1");
      cache.delete("key1");
      expect(cache.get("key1")).toBeUndefined();
    });

    it("should clear all entries", () => {
      const cache = new LRUCache<string>();
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.clear();
      expect(cache.get("key1")).toBeUndefined();
      expect(cache.get("key2")).toBeUndefined();
    });
  });

  describe("LRU eviction", () => {
    it("should evict LRU entry when cache is full", () => {
      const cache = new LRUCache<number>({ maxSize: 3 });

      // Fill cache
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);

      // Add new entry — should evict "a" (least recently used)
      cache.set("d", 4);

      expect(cache.get("a")).toBeUndefined();
      expect(cache.get("b")).toBe(2);
      expect(cache.get("c")).toBe(3);
      expect(cache.get("d")).toBe(4);
    });

    it("should update LRU order on access", () => {
      const cache = new LRUCache<number>({ maxSize: 3 });

      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);

      // Access "a" to make it recently used
      cache.get("a");

      // Add "d" — should evict "b" (now least recently used)
      cache.set("d", 4);

      expect(cache.get("a")).toBe(1);
      expect(cache.get("b")).toBeUndefined();
      expect(cache.get("c")).toBe(3);
      expect(cache.get("d")).toBe(4);
    });

    it("should update LRU order when setting existing key", () => {
      const cache = new LRUCache<number>({ maxSize: 3 });

      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);

      // Update "a" to make it recently used
      cache.set("a", 10);

      // Add "d" — should evict "b"
      cache.set("d", 4);

      expect(cache.get("a")).toBe(10);
      expect(cache.get("b")).toBeUndefined();
      expect(cache.get("c")).toBe(3);
      expect(cache.get("d")).toBe(4);
    });
  });

  describe("TTL expiry", () => {
    it("should expire entries after TTL", async () => {
      const cache = new LRUCache<string>({ ttlMs: 100 });

      cache.set("key1", "value1");
      expect(cache.get("key1")).toBe("value1");

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(cache.get("key1")).toBeUndefined();
    });

    it("should not expire entries before TTL", async () => {
      const cache = new LRUCache<string>({ ttlMs: 500 });

      cache.set("key1", "value1");

      // Wait briefly
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(cache.get("key1")).toBe("value1");
    });

    it("should evict expired entries on cleanup", async () => {
      const cache = new LRUCache<string>({ ttlMs: 100 });

      cache.set("key1", "value1");
      cache.set("key2", "value2");

      await new Promise((resolve) => setTimeout(resolve, 150));

      // evictExpired should clean up
      cache.evictExpired();

      expect(cache.get("key1")).toBeUndefined();
      expect(cache.get("key2")).toBeUndefined();
    });

    it("should preserve non-expired entries on cleanup", async () => {
      const cache = new LRUCache<string>({ ttlMs: 500 });

      cache.set("key1", "value1");

      await new Promise((resolve) => setTimeout(resolve, 100));

      cache.evictExpired();

      expect(cache.get("key1")).toBe("value1");
    });
  });

  describe("Statistics", () => {
    it("should track hits and misses", () => {
      const cache = new LRUCache<string>();

      cache.set("key1", "value1");

      // Hit
      cache.get("key1");

      // Miss
      cache.get("key2");

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.5);
    });

    it("should track size", () => {
      const cache = new LRUCache<string>();

      cache.set("key1", "value1");
      cache.set("key2", "value2");

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
    });

    it("should reset stats on clear", () => {
      const cache = new LRUCache<string>();

      cache.set("key1", "value1");
      cache.get("key1");
      cache.get("missing");

      cache.clear();

      const stats = cache.getStats();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });
});

describe("FlagEvaluationCache", () => {
  describe("Basic operations", () => {
    it("should set and get flag results", () => {
      const cache = new FlagEvaluationCache();

      cache.setResult("flag1", "web", "production", "admin", true);
      const result = cache.getResult("flag1", "web", "production", "admin");

      expect(result).toBe(true);
    });

    it("should handle undefined userRole in result", () => {
      const cache = new FlagEvaluationCache();

      cache.setResult("flag1", "web", "production", undefined, false);
      const result = cache.getResult("flag1", "web", "production", undefined);

      expect(result).toBe(false);
    });

    it("should distinguish between different contexts", () => {
      const cache = new FlagEvaluationCache();

      cache.setResult("flag1", "web", "production", "admin", true);
      cache.setResult("flag1", "web", "dev", "admin", false);
      cache.setResult("flag1", "ios", "production", "admin", true);

      expect(cache.getResult("flag1", "web", "production", "admin")).toBe(
        true,
      );
      expect(cache.getResult("flag1", "web", "dev", "admin")).toBe(false);
      expect(cache.getResult("flag1", "ios", "production", "admin")).toBe(
        true,
      );
    });
  });

  describe("Invalidation by flag", () => {
    it("should invalidate all entries for a flag", () => {
      const cache = new FlagEvaluationCache();

      // Set multiple results for same flag, different contexts
      cache.setResult("flag1", "web", "production", "admin", true);
      cache.setResult("flag1", "web", "production", "user", false);
      cache.setResult("flag1", "ios", "production", "admin", true);

      // Set result for different flag
      cache.setResult("flag2", "web", "production", "admin", true);

      // Invalidate flag1
      cache.invalidateFlag("flag1");

      // flag1 results should be cleared
      expect(cache.getResult("flag1", "web", "production", "admin")).toBeUndefined();
      expect(cache.getResult("flag1", "web", "production", "user")).toBeUndefined();
      expect(cache.getResult("flag1", "ios", "production", "admin")).toBeUndefined();

      // flag2 result should still be cached
      expect(cache.getResult("flag2", "web", "production", "admin")).toBe(
        true,
      );
    });
  });

  describe("Invalidation by role", () => {
    it("should invalidate all entries for a role", () => {
      const cache = new FlagEvaluationCache();

      cache.setResult("flag1", "web", "production", "admin", true);
      cache.setResult("flag1", "web", "production", "user", false);
      cache.setResult("flag2", "web", "production", "admin", false);
      cache.setResult("flag2", "ios", "production", "user", true);

      // Invalidate admin role
      cache.invalidateRole("admin");

      // admin role results should be cleared
      expect(cache.getResult("flag1", "web", "production", "admin")).toBeUndefined();
      expect(cache.getResult("flag2", "web", "production", "admin")).toBeUndefined();

      // user role results should still be cached
      expect(cache.getResult("flag1", "web", "production", "user")).toBe(false);
      expect(cache.getResult("flag2", "ios", "production", "user")).toBe(true);
    });

    it("should handle undefined role in invalidation", () => {
      const cache = new FlagEvaluationCache();

      cache.setResult("flag1", "web", "production", undefined, true);
      cache.setResult("flag1", "web", "production", "admin", false);

      // Invalidate undefined role
      cache.invalidateRole(undefined);

      // undefined role result should be cleared
      expect(cache.getResult("flag1", "web", "production", undefined)).toBeUndefined();

      // admin role result should still be cached
      expect(cache.getResult("flag1", "web", "production", "admin")).toBe(false);
    });
  });

  describe("Cache clearing", () => {
    it("should clear all cached results", () => {
      const cache = new FlagEvaluationCache();

      cache.setResult("flag1", "web", "production", "admin", true);
      cache.setResult("flag2", "ios", "dev", "user", false);

      cache.clear();

      expect(cache.getResult("flag1", "web", "production", "admin")).toBeUndefined();
      expect(cache.getResult("flag2", "ios", "dev", "user")).toBeUndefined();
    });
  });

  describe("Integration with LRU size limits", () => {
    it("should respect max size when caching many results", () => {
      // Create cache with small max size for testing
      const cache = new FlagEvaluationCache({ maxSize: 5 });

      // Set 10 results — should evict oldest 5
      for (let i = 0; i < 10; i++) {
        cache.setResult(`flag${i}`, "web", "production", "admin", true);
      }

      // Check that roughly only 5 entries are cached
      // (exact number depends on LRU eviction order)
      const stats = cache.getStats();
      expect(stats.size).toBeLessThanOrEqual(5);
    });
  });
});
