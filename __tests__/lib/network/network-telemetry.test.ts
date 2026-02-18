import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Reset module registry between tests to allow mocking imports
beforeEach(() => {
  vi.resetModules();
  // Mock react-native Platform to avoid importing the real react-native package during tests
  vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
  // Ensure analytics consent allows performance data in unit tests
  vi.mock("@/lib/analytics", () => ({ AnalyticsConsent: { isAllowed: (_: string) => true } }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("network-telemetry unit tests", () => {
  it("mapQualityTier maps effectiveType and latency correctly", async () => {
    const mod = await import("@/lib/network/network-telemetry");
    const { mapQualityTier, ConnectionQualityTier } = mod;

    expect(mapQualityTier("4g", 30)).toBe(ConnectionQualityTier.EXCELLENT);
    expect(mapQualityTier("4g", 70)).toBe(ConnectionQualityTier.GOOD);
    expect(mapQualityTier("3g", 50)).toBe(ConnectionQualityTier.GOOD);
    expect(mapQualityTier("3g", 150)).toBe(ConnectionQualityTier.POOR);
    expect(mapQualityTier("2g", 10)).toBe(ConnectionQualityTier.POOR);
    expect(mapQualityTier(undefined)).toBe(ConnectionQualityTier.OFFLINE);
  });

  it("emitHealthCheckEvent emits first check regardless of sampling and subsequent checks respect sample rate", async () => {
    // Mock config to set sample rate to 0 (so sampled checks would not emit)
    vi.mock("@/lib/config", () => ({ getAppConfig: () => ({ network: { telemetry: { healthCheckSampleRate: 0, enabled: true } } }) }));

    // Mock composeNetworkContext to return predictable effectiveType
    vi.mock("@/lib/network/helpers", () => ({ composeNetworkContext: () => ({ effectiveType: "4g", connectionType: "wifi" }) }));

    // Spy on the shared logger mock from setup to capture info calls
    const infoSpy = vi.fn();
    const debugSpy = vi.fn();
    const loggerMod = await import("@/lib/utils/logger");
    vi.spyOn(loggerMod, "logger", "get").mockReturnValue({ category: () => ({ info: infoSpy, warn: vi.fn(), debug: debugSpy }) } as any);

    // Provide a minimal NetworkStatus shape for the call
    vi.mock("@/lib/network/network-detection", () => ({ NetworkDetection: { getStatus: () => ({ isOnline: true, effectiveType: "4g", isExpensive: false }) } }));

    const mod = await import("@/lib/network/network-telemetry");
    const { emitHealthCheckEvent, cleanupTelemetry } = mod;

    // Ensure clean state
    cleanupTelemetry();

    // Deterministic Math.random so sampling is predictable (not sampled)
    const randSpy = vi.spyOn(Math, "random").mockReturnValue(0.99);

    // First health check should emit even with sample rate 0
    emitHealthCheckEvent({} as any);
    expect(infoSpy).toHaveBeenCalledWith("health_check", expect.any(Object));

    // Reset spy and call again; now firstHealthCheckEmitted should be true and sample rate 0 prevents emit
    infoSpy.mockClear();
    emitHealthCheckEvent({} as any);
    expect(infoSpy).not.toHaveBeenCalled();

    randSpy.mockRestore();

    cleanupTelemetry();
  });

  it("captureErrorCorrelation queues events and getErrorQueue returns them", async () => {
    // Mock necessary modules
    vi.mock("@/lib/network/helpers", () => ({ composeNetworkContext: () => ({ effectiveType: "3g", connectionType: "cellular" }) }));
    vi.mock("@/lib/network/network-detection", () => ({ NetworkDetection: { getStatus: () => ({ isOnline: true, effectiveType: "3g", isExpensive: true }) } }));
    const debugSpy = vi.fn();
    vi.mock("@/lib/utils/logger", () => ({ logger: { category: () => ({ debug: debugSpy, info: vi.fn(), warn: vi.fn() }) } }));

    const mod = await import("@/lib/network/network-telemetry");
    const { captureErrorCorrelation, getErrorQueue, getAndClearErrorQueue, cleanupTelemetry } = mod;

    cleanupTelemetry();
    captureErrorCorrelation("timeout", "timed out", undefined);

    const q = getErrorQueue();
    expect(q.length).toBeGreaterThanOrEqual(1);
    expect(q[0].errorType).toBe("timeout");

    // getAndClearErrorQueue clears by default
    const drained = getAndClearErrorQueue();
    expect(drained.length).toBeGreaterThanOrEqual(1);
    const after = getErrorQueue();
    expect(after.length).toBe(0);

    cleanupTelemetry();
  });

  it("emitSampledErrorEvents respects sampling rate when emitting", async () => {
    // Mock config to set errorCorrelationSampleRate to 0.5 and enabled true
    vi.mock("@/lib/config", () => ({ getAppConfig: () => ({ network: { telemetry: { errorCorrelationSampleRate: 0.5, enabled: true } } }) }));
    vi.mock("@/lib/utils/logger", () => ({ logger: { category: () => ({ info: vi.fn(), debug: vi.fn() }) } }));
    const mod = await import("@/lib/network/network-telemetry");
    const { emitSampledErrorEvents } = mod;

    // Create a batch of 10 sample events
    const events = Array.from({ length: 10 }, (_, i) => ({ errorType: "timeout", errorMessage: `err${i}`, currentQuality: "poor", isOnline: true, timestamp: Date.now(), platform: "web" } as any));

    // Mock Math.random to control sampling: alternate returns so roughly half sampled
    const rand = vi.spyOn(Math, "random");
    let calls = 0;
    rand.mockImplementation(() => {
      calls += 1;
      return calls % 2 === 0 ? 0.2 : 0.8; // 0.2 < 0.5 => sampled on even calls
    });

    const loggerMod = await import("@/lib/utils/logger");
    const infoSpy = vi.fn();
    // Override category to use our spy
    vi.spyOn(loggerMod, "logger", "get").mockReturnValue({ category: () => ({ info: infoSpy, debug: vi.fn(), warn: vi.fn() }) } as any);

    emitSampledErrorEvents(events);

    // Expect infoSpy called for roughly half the events (>=1)
    expect(infoSpy.mock.calls.length).toBeGreaterThanOrEqual(1);

    rand.mockRestore();
  });
});
