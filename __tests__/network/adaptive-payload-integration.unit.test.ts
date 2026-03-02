import { invalidateAdaptivePayloadCache } from "@/hooks/network/useAdaptivePayloadCacheInvalidation";
import { getAdaptivePayloadOptions, getAdaptiveQueryParams, getQualityAwareCacheKey, getStaleTimeForQuality } from "@/lib/network";
import { QueryCache } from "@/lib/storage";
import { NetworkDetection } from "@/system/Network";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/system/Network/network-detection", () => ({
  NetworkDetection: { getStatus: vi.fn(), subscribe: vi.fn() },
  ConnectionQuality: {
    GOOD: "good",
    BAD: "bad",
    CELLULAR: "cellular",
    OFFLINE: "offline",
  },
}));

vi.mock("@/lib/cache/query-cache", () => ({
  QueryCache: { invalidateByTags: vi.fn() },
}));

describe("Adaptive Payload Integration helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getQualityAwareCacheKey includes quality component for string base key", () => {
    (NetworkDetection.getStatus as any).mockReturnValue({ effectiveType: "4g" });

    const key = getQualityAwareCacheKey({ baseCacheKey: "worlds:list", cacheTagsToInvalidate: ["worlds"] });
    expect(key).toBe("worlds:list:4g");
  });

  it("getQualityAwareCacheKey includes quality component for array base key", () => {
    (NetworkDetection.getStatus as any).mockReturnValue({ effectiveType: "2g" });

    const key = getQualityAwareCacheKey({ baseCacheKey: ["worlds", "list"], cacheTagsToInvalidate: ["worlds"] });
    expect(key).toBe("worlds:list:2g");
  });

  it("getAdaptiveQueryParams returns params consistent with payload options for 2G", () => {
    (NetworkDetection.getStatus as any).mockReturnValue({ effectiveType: "2g" });
    const params = getAdaptiveQueryParams();

    const expectedOptions = getAdaptivePayloadOptions({ isOnline: true, isInternetReachable: true, effectiveType: "2g" } as any);
    const expectedParams = {
      imageQuality: expectedOptions.imageQuality,
      summaryOnly: true,
      excludeMaps: true,
      maxPayloadBytes: expectedOptions.maxPayloadSize,
      compress: true,
    };

    // Ensure key aspects match (don't require exact object equality because buildAdaptiveQueryParams may omit undefined fields)
    expect(params.imageQuality).toBe(expectedParams.imageQuality);
    expect(params.summaryOnly).toBe(true);
    expect(params.excludeMaps).toBe(true);
    expect(params.compress).toBe(true);
  });

  it("invalidateAdaptivePayloadCache calls QueryCache.invalidateByTags", async () => {
    await invalidateAdaptivePayloadCache(["worlds", "characters"]);
    expect((QueryCache.invalidateByTags as any)).toHaveBeenCalledWith(["worlds", "characters"]);
  });

  it("getStaleTimeForQuality returns expected stale times", () => {
    expect(getStaleTimeForQuality("worlds:list:4g")).toBe(2 * 60 * 1000);
    expect(getStaleTimeForQuality("worlds:list:3g")).toBe(5 * 60 * 1000);
    expect(getStaleTimeForQuality("worlds:list:2g")).toBe(15 * 60 * 1000);
    expect(getStaleTimeForQuality("worlds:list:offline")).toBe(Infinity);
  });
});
