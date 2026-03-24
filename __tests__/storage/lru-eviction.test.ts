import { lruEvictionManager } from '@/system/Storage';
import { LRUEviction, measureEntrySize } from "@/system/Storage/cache-invalidation/lru-eviction";
import { describe, expect, it } from 'vitest';


describe('LRU Eviction Manager', () => {
  it('tracks entries and reports size', () => {
    lruEvictionManager.clear();
    const delta = lruEvictionManager.trackEntry('a', 100);
    expect(typeof delta).toBe('number');
    expect(lruEvictionManager.getEntryCount()).toBeGreaterThanOrEqual(1);
    expect(lruEvictionManager.getTotalSizeBytes()).toBeGreaterThanOrEqual(100);
  });

  it('evicts entries to target size', async () => {
    lruEvictionManager.clear();
    lruEvictionManager.initialize({ hardMaxBytes: 500, softThreshold: 0.9, targetAfterEviction: 0.5 });

    // Provide entries larger than target
    const entries = [
      { key: 'k1', sizeBytes: 300, lastAccessTime: Date.now() - 1000 },
      { key: 'k2', sizeBytes: 300, lastAccessTime: Date.now() - 500 },
    ];

    // Track entries so totalSizeBytes reflects their sizes
    for (const e of entries) {
      lruEvictionManager.trackEntry(e.key, e.sizeBytes);
    }

    const evictCalled: string[] = [];
    const evictEntries = async (keys: string[]) => { evictCalled.push(...keys); };

    const res = await lruEvictionManager.evict(() => entries as any, evictEntries);
    expect(res.evictedCount).toBeGreaterThanOrEqual(1);
    expect(evictCalled.length).toBeGreaterThanOrEqual(1);
  });

  it('measures entry size', () => {
    const size = measureEntrySize({ foo: 'bar' });
    expect(size).toBeGreaterThan(0);
  });
});

describe("LRU Eviction Tracker", () => {
  it("tracks sizes and updates access times", () => {
    const tracker = new LRUEviction();

    const aSize = tracker.trackEntry("a", 10);
    expect(aSize).toBe(10);
    expect(tracker.getTotalSizeBytes()).toBe(10);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const bSize = tracker.trackEntry("b", 20);
    expect(tracker.getTotalSizeBytes()).toBe(30);

    // Update existing key with larger size
    const aDelta = tracker.trackEntry("a", 30);
    expect(aDelta).toBe(20);
    expect(tracker.getTotalSizeBytes()).toBe(50);

    // getOldestN returns entries sorted by lastAccessTime (oldest first)
    const oldest = tracker.getOldestN(2);
    expect(oldest.length).toBe(2);

    // untrackEntry removes size
    const freed = tracker.untrackEntry("b");
    expect(freed).toBe(20);
    expect(tracker.getTotalSizeBytes()).toBe(30);
  });

  it("measures entry size consistently", () => {
    const obj = { foo: "bar", n: 123 };
    const size = measureEntrySize(obj);
    expect(typeof size).toBe("number");
    expect(size).toBeGreaterThan(0);
  });
});
