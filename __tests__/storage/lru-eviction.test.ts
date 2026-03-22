import { LRUEvictionTracker, measureEntrySize } from "@/lib/middleware/storage/helpers/lru-eviction";
import { describe, expect, it } from "vitest";

describe("LRU Eviction Tracker", () => {
  it("tracks sizes and updates access times", () => {
    const tracker = new LRUEvictionTracker();

    const aSize = tracker.trackEntry("a", 10);
    expect(aSize).toBe(10);
    expect(tracker.getTotalSizeBytes()).toBe(10);

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
