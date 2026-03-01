// Prevent importing flow-typed react-native entry during tests
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  appendAdaptiveParams,
  getAdaptiveQueryString,
  NetworkDetection,
  shouldDowngradeResource
} from "@/lib/network";
vi.mock("react-native", () => ({ Platform: { OS: "ios" }, NativeModules: {} }));
// Mock expo-constants (used by RequestManager via getAppConfig)
vi.mock("expo-constants", () => ({ default: { expoConfig: { extra: { sentryDsn: null } } } }));

let RequestManager: typeof import("@/lib/api/request-manager").RequestManager;

// Ensure network-detection module is mocked (appendAdaptiveParams imports it directly)
vi.mock("@/lib/network/network-detection", () => ({ NetworkDetection: { getStatus: vi.fn(), subscribe: vi.fn() } }));

// Minimal mocks to isolate RequestManager behaviour
vi.mock("@/lib/utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    category: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  },
}));

vi.mock("@/lib/config", () => ({ getAppConfig: vi.fn(() => ({ api: { retryDelayMs: 10, requestTimeoutMs: 500 } })) }));
vi.mock("@/lib/api/interceptor", () => ({ InterceptorManager: { executeBeforeRequestHooks: vi.fn(), executeAfterResponseHooks: vi.fn(), executeErrorHooks: vi.fn() }, parseEndpoint: vi.fn().mockReturnValue("test") }));
vi.mock("@/lib/auth/auth-layer", () => ({ AuthLayer: { injectAuthHeader: vi.fn(), handle401Response: vi.fn() } }));
vi.mock("@/lib/analytics", () => ({ Analytics: { track: vi.fn(), enabled: vi.fn().mockReturnValue(false), getThreshold: vi.fn() }, sanitizeError: vi.fn() }));

// Mock QueryCache and NetworkDetection selectively in tests below
vi.mock("@/lib/cache/query-cache", () => ({
  QueryCache: {
    get: vi.fn(),
    set: vi.fn(),
    isStale: vi.fn(),
    getCurrentVersion: vi.fn(() => 1),
    invalidateByTags: vi.fn(),
  },
}));

vi.mock("@/lib/network", () => ({
  NetworkDetection: {
    getStatus: vi.fn(),
    subscribe: vi.fn(),
  },
}));

describe("Adaptive Payload Request helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("appendAdaptiveParams appends correct adaptive params for /api URLs (3G)", () => {
    (NetworkDetection.getStatus as any).mockReturnValue({ effectiveType: "3g" });

    const out = appendAdaptiveParams("/api/worlds");
    expect(out).toContain("/api/worlds?");
    expect(out).toContain("imageQuality=sd");
    expect(out).toContain("excludeMaps=true");
  });

  it("appendAdaptiveParams merges with existing query params", () => {
    (NetworkDetection.getStatus as any).mockReturnValue({ effectiveType: "4g" });

    // Sanity-check mock installed correctly
    expect((NetworkDetection.getStatus as any)()).toEqual({ effectiveType: "4g" });

    const out = appendAdaptiveParams("/api/worlds?page=1&limit=10");
    expect(out).toContain("page=1");
    expect(out).toContain("limit=10");
    expect(out).toContain("imageQuality=hd");
  });

  it("getAdaptiveQueryString produces the same params as buildAdaptiveQueryParams wrapper", () => {
    (NetworkDetection.getStatus as any).mockReturnValue({ effectiveType: "2g" });

    // Sanity-check mock installed correctly
    expect((NetworkDetection.getStatus as any)()).toEqual({ effectiveType: "2g" });

    const qs = getAdaptiveQueryString();
    expect(qs).toContain("thumb");
    expect(qs).toContain("summaryOnly");
  });

  it("shouldDowngradeResource returns false for loaded resources and true for stale downgrade", () => {
    // loaded resources should not be downgraded
    expect(shouldDowngradeResource('hd', 'sd', 'loaded')).toBe(false);

    // stale resource with lower current quality should be downgraded
    expect(shouldDowngradeResource('hd', 'thumb', 'stale')).toBe(true);

    // loading resource never downgraded
    expect(shouldDowngradeResource('hd', 'sd', 'loading')).toBe(false);
  });
});
