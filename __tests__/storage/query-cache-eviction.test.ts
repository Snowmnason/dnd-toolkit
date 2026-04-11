import { QueryCacheInternals } from "@/middleware/storage";
import { beforeEach, describe, expect, it } from "vitest";

describe("QueryCache LRU Eviction", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = new QueryCacheInternals();
    // Small defaults for test determinism
    ctx.config.maxEntries = 1000;
    ctx.config.maxBytes = 100; // force small max to trigger eviction
  });

  it("evicts oldest entries when maxBytes exceeded", async () => {
    // Create three entries with predictable sizes
    const makeEntry = (n: number) => ({
      data: "x".repeat(n),
      timestamp: Date.now(),
      staleTime: 1000,
      cacheTime: 10000,
    });

    ctx.inMemoryCache.set("a", makeEntry(60));
    ctx.trackEntrySize("a", ctx.inMemoryCache.get("a"));

    ctx.inMemoryCache.set("b", makeEntry(60));
    ctx.trackEntrySize("b", ctx.inMemoryCache.get("b"));

    ctx.inMemoryCache.set("c", makeEntry(10));
    ctx.trackEntrySize("c", ctx.inMemoryCache.get("c"));

    // At this point total size > 100, eviction should remove oldest entries
    await ctx.evictLRU();

    // After eviction, total entries should be less than 3
    expect(ctx.inMemoryCache.size).toBeLessThan(3);
  });
});
