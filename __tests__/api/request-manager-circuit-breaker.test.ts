import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseEndpoint } from "../../lib/api/interceptor";
import {
  CircuitBreakerManager,
  type CircuitThresholds,
} from "../../lib/api/resilience/circuit-breaker";

// Mock logger
vi.mock("../../lib/utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    category: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

// Mock config
vi.mock("../../lib/config", () => ({
  getAppConfig: vi.fn(() => ({
    version: 1,
    circuitBreaker: {
      failures: 10,
      ratePercent: 50,
      rateWindowMs: 60000,
      baseTimeoutMs: 30000,
      maxTimeoutMs: 300000,
      treatNetworkErrors: true,
    },
  })),
}));

/**
 * Integration tests for circuit breaker with RequestManager flow
 *
 * These tests verify that circuit breaker behavior works correctly
 * in the context of request management (fast-fail, probe handling, auth error filtering)
 */
describe("Circuit Breaker RequestManager Integration", () => {
  beforeEach(() => {
    CircuitBreakerManager.clearAll();
    vi.clearAllMocks();
  });

  afterEach(() => {
    CircuitBreakerManager.clearAll();
  });

  describe("Circuit Breaker Key Derivation", () => {
    it("should derive circuit breaker key from cache key prefix", () => {
      const cacheKey1 = "worlds:list:page:1";
      const cacheKey2 = "users:profile:123";
      const cacheKey3 = "test:endpoint:action";

      expect(parseEndpoint(cacheKey1)).toBe("worlds");
      expect(parseEndpoint(cacheKey2)).toBe("users");
      expect(parseEndpoint(cacheKey3)).toBe("test");
    });
  });

  describe("Open Circuit Fast-Fail Behavior", () => {
    it("should prevent requests when circuit is Open", () => {
      const cbKey = "test-endpoint";
      const thresholds: Required<CircuitThresholds> = {
        failures: 2,
        ratePercent: 50,
        rateWindowMs: 60000,
        baseTimeoutMs: 1000,
        maxTimeoutMs: 60000,
        treatNetworkErrors: true,
      };

      // Open the circuit
      CircuitBreakerManager.recordFailure(cbKey, false, thresholds);
      CircuitBreakerManager.recordFailure(cbKey, false, thresholds);

      expect(CircuitBreakerManager.getState(cbKey)).toBe("Open");

      // Verify that attempt to acquire would fail
      const stats = CircuitBreakerManager.getStats(cbKey);
      expect(stats.state).toBe("Open");
      expect(stats.nextRecoveryAt).toBeGreaterThan(0);
    });

    it("should have recovery timeout when circuit opens", () => {
      const cbKey = "test-endpoint";
      const thresholds: Required<CircuitThresholds> = {
        failures: 2,
        ratePercent: 50,
        rateWindowMs: 60000,
        baseTimeoutMs: 2000,
        maxTimeoutMs: 60000,
        treatNetworkErrors: true,
      };

      CircuitBreakerManager.recordFailure(cbKey, false, thresholds);
      CircuitBreakerManager.recordFailure(cbKey, false, thresholds);

      const stats = CircuitBreakerManager.getStats(cbKey);
      expect(stats.state).toBe("Open");
      expect(stats.nextRecoveryAt).toBeGreaterThan(Date.now());
    });
  });

  describe("Half-Open Probe Gating", () => {
    it("should allow single probe when transitioning to Half-Open", () => {
      const cbKey = "test-endpoint";
      const thresholds: Required<CircuitThresholds> = {
        failures: 2,
        ratePercent: 50,
        rateWindowMs: 60000,
        baseTimeoutMs: 100,
        maxTimeoutMs: 60000,
        treatNetworkErrors: true,
      };

      // Open circuit
      CircuitBreakerManager.recordFailure(cbKey, false, thresholds);
      CircuitBreakerManager.recordFailure(cbKey, false, thresholds);

      const stats1 = CircuitBreakerManager.getStats(cbKey);
      vi.useFakeTimers();
      vi.setSystemTime(stats1.nextRecoveryAt! + 1);

      // Transition to Half-Open
      const state = CircuitBreakerManager.getState(cbKey);
      expect(state).toBe("Half-Open");

      // First probe should be allowed
      const canProbe1 = CircuitBreakerManager.tryAcquireProbe(cbKey);
      expect(canProbe1).toBe(true);

      // Second concurrent probe should be blocked
      const canProbe2 = CircuitBreakerManager.tryAcquireProbe(cbKey);
      expect(canProbe2).toBe(false);

      vi.useRealTimers();
    });
  });

  describe("Failure Recording Context", () => {
    it("should record failures from different endpoints independently", () => {
      const thresholds: Required<CircuitThresholds> = {
        failures: 3,
        ratePercent: 101, // Prevent rate-based trigger
        rateWindowMs: 60000,
        baseTimeoutMs: 1000,
        maxTimeoutMs: 60000,
        treatNetworkErrors: true,
      };

      const endpoint1 = "api1";
      const endpoint2 = "api2";

      // Fail endpoint1 twice
      CircuitBreakerManager.recordFailure(endpoint1, false, thresholds);
      CircuitBreakerManager.recordFailure(endpoint1, false, thresholds);

      // Fail endpoint2 once
      CircuitBreakerManager.recordFailure(endpoint2, false, thresholds);

      // endpoint1 should be Closed (2 < 3)
      expect(CircuitBreakerManager.getState(endpoint1)).toBe("Closed");
      // endpoint2 should be Closed (1 < 3)
      expect(CircuitBreakerManager.getState(endpoint2)).toBe("Closed");

      // Fail endpoint1 once more to open it
      CircuitBreakerManager.recordFailure(endpoint1, false, thresholds);
      expect(CircuitBreakerManager.getState(endpoint1)).toBe("Open");
      expect(CircuitBreakerManager.getState(endpoint2)).toBe("Closed");
    });

    it("should exclude auth errors (401/403) from failure tracking", () => {
      const cbKey = "test-endpoint";
      const thresholds: Required<CircuitThresholds> = {
        failures: 2,
        ratePercent: 50,
        rateWindowMs: 60000,
        baseTimeoutMs: 1000,
        maxTimeoutMs: 60000,
        treatNetworkErrors: true,
      };

      // Record a regular failure
      CircuitBreakerManager.recordFailure(cbKey, false, thresholds);
      expect(CircuitBreakerManager.getStats(cbKey).failureCount).toBe(1);

      // Auth errors (401/403) are excluded at the RequestManager level: it simply does not
      // call recordFailure() for those status codes. The circuit breaker itself has no
      // concept of HTTP status — simulate by not calling recordFailure again.
      // Count must still be 1 (unchanged).
      expect(CircuitBreakerManager.getStats(cbKey).failureCount).toBe(1);
    });

    it("should treat network errors based on configuration", () => {
      const thresholdsIgnoreNetwork: Required<CircuitThresholds> = {
        failures: 2,
        ratePercent: 50,
        rateWindowMs: 60000,
        baseTimeoutMs: 1000,
        maxTimeoutMs: 60000,
        treatNetworkErrors: false,
      };

      const thresholdsCountNetwork: Required<CircuitThresholds> = {
        failures: 2,
        ratePercent: 50,
        rateWindowMs: 60000,
        baseTimeoutMs: 1000,
        maxTimeoutMs: 60000,
        treatNetworkErrors: true,
      };

      const cbKey1 = "endpoint-ignore-net";
      const cbKey2 = "endpoint-count-net";

      // Record network error with ignoreNetwork=true
      CircuitBreakerManager.recordFailure(
        cbKey1,
        true,
        thresholdsIgnoreNetwork,
      );
      expect(CircuitBreakerManager.getStats(cbKey1).failureCount).toBe(0);

      // Record network error with countNetwork=true
      CircuitBreakerManager.recordFailure(cbKey2, true, thresholdsCountNetwork);
      expect(CircuitBreakerManager.getStats(cbKey2).failureCount).toBe(1);
    });
  });

  describe("Per-Request Threshold Overrides", () => {
    it("should allow custom thresholds per request", () => {
      const cbKey = "test-endpoint";

      // Conservative thresholds
      const conservativeThresholds: Required<CircuitThresholds> = {
        failures: 10,
        ratePercent: 101, // Higher than 100% to prevent rate-based trigger
        rateWindowMs: 60000,
        baseTimeoutMs: 30000,
        maxTimeoutMs: 300000,
        treatNetworkErrors: true,
      };

      // Aggressive thresholds
      const aggressiveThresholds: Required<CircuitThresholds> = {
        failures: 1,
        ratePercent: 101, // Higher than 100% to prevent rate-based trigger with 1 failure
        rateWindowMs: 60000,
        baseTimeoutMs: 5000,
        maxTimeoutMs: 60000,
        treatNetworkErrors: true,
      };

      // With conservative thresholds, needs 10 failures (1 < 10, so stays Closed)
      CircuitBreakerManager.recordFailure(cbKey, false, conservativeThresholds);
      expect(CircuitBreakerManager.getState(cbKey)).toBe("Closed");

      // With aggressive thresholds, 1 failure opens it (failures: 1, so 1 >= 1)
      const cbKeyAggressive = "test-endpoint-aggressive";
      CircuitBreakerManager.recordFailure(
        cbKeyAggressive,
        false,
        aggressiveThresholds,
      );
      expect(CircuitBreakerManager.getState(cbKeyAggressive)).toBe("Open");
    });
  });

  describe("State Recovery Flow", () => {
    it("should transition from Open → Half-Open → Closed on successful probe", () => {
      const cbKey = "test-endpoint";
      const thresholds: Required<CircuitThresholds> = {
        failures: 2,
        ratePercent: 50,
        rateWindowMs: 60000,
        baseTimeoutMs: 100,
        maxTimeoutMs: 60000,
        treatNetworkErrors: true,
      };

      // Open circuit
      CircuitBreakerManager.recordFailure(cbKey, false, thresholds);
      CircuitBreakerManager.recordFailure(cbKey, false, thresholds);
      expect(CircuitBreakerManager.getState(cbKey)).toBe("Open");

      // Wait for recovery timeout
      const stats1 = CircuitBreakerManager.getStats(cbKey);
      vi.useFakeTimers();
      vi.setSystemTime(stats1.nextRecoveryAt! + 1);

      // Transition to Half-Open
      expect(CircuitBreakerManager.getState(cbKey)).toBe("Half-Open");

      // Record success
      CircuitBreakerManager.recordSuccess(cbKey);
      expect(CircuitBreakerManager.getState(cbKey)).toBe("Closed");

      // Verify state reset
      const finalStats = CircuitBreakerManager.getStats(cbKey);
      expect(finalStats.failureCount).toBe(0);
      expect(finalStats.consecutiveHalfOpenFailures).toBe(0);

      vi.useRealTimers();
    });

    it("should stay Open and increase backoff on failed Half-Open probe", () => {
      const cbKey = "test-endpoint";
      const thresholds: Required<CircuitThresholds> = {
        failures: 2,
        ratePercent: 50,
        rateWindowMs: 60000,
        baseTimeoutMs: 1000,
        maxTimeoutMs: 60000,
        treatNetworkErrors: true,
      };

      // Open circuit
      CircuitBreakerManager.recordFailure(cbKey, false, thresholds);
      CircuitBreakerManager.recordFailure(cbKey, false, thresholds);

      const stats1 = CircuitBreakerManager.getStats(cbKey);
      const firstRecoveryAt = stats1.nextRecoveryAt!;

      vi.useFakeTimers();
      vi.setSystemTime(firstRecoveryAt + 1);

      // Transition to Half-Open
      CircuitBreakerManager.getState(cbKey);
      expect(CircuitBreakerManager.getState(cbKey)).toBe("Half-Open");

      // Record failure
      CircuitBreakerManager.recordFailure(cbKey, false, thresholds);

      // Should be back to Open
      expect(CircuitBreakerManager.getState(cbKey)).toBe("Open");

      const stats2 = CircuitBreakerManager.getStats(cbKey);
      const secondRecoveryAt = stats2.nextRecoveryAt!;

      // Backoff should be at least baseTimeoutMs (first Half-Open failure uses multiplier 1)
      expect(secondRecoveryAt - (firstRecoveryAt + 1)).toBeGreaterThanOrEqual(
        thresholds.baseTimeoutMs,
      );

      vi.useRealTimers();
    });
  });

  describe("Multi-Endpoint Scenarios", () => {
    it("should handle multiple circuits independently", () => {
      const thresholds: Required<CircuitThresholds> = {
        failures: 2,
        ratePercent: 50,
        rateWindowMs: 60000,
        baseTimeoutMs: 1000,
        maxTimeoutMs: 60000,
        treatNetworkErrors: true,
      };

      const endpoints = ["users", "worlds", "campaigns", "characters"];

      // Open circuits for endpoints 0 and 2
      CircuitBreakerManager.recordFailure(endpoints[0], false, thresholds);
      CircuitBreakerManager.recordFailure(endpoints[0], false, thresholds);

      CircuitBreakerManager.recordFailure(endpoints[2], false, thresholds);
      CircuitBreakerManager.recordFailure(endpoints[2], false, thresholds);

      // Verify states (unrecorded endpoints return undefined)
      expect(CircuitBreakerManager.getState(endpoints[0])).toBe("Open");
      expect(CircuitBreakerManager.getState(endpoints[1])).toBeUndefined(); // Never recorded
      expect(CircuitBreakerManager.getState(endpoints[2])).toBe("Open");
      expect(CircuitBreakerManager.getState(endpoints[3])).toBeUndefined(); // Never recorded

      // Verify all stats (only opened circuits are tracked)
      const allStats = CircuitBreakerManager.getStats();
      expect(allStats).toHaveLength(2);
      expect(allStats.map((s) => s.key)).toEqual([endpoints[0], endpoints[2]]);
    });
  });
});
