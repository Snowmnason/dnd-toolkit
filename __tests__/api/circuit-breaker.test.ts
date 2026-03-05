import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CircuitBreakerManager,
  type CircuitThresholds,
} from "../../system/API/resilience/circuit-breaker";

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
 * Tests for Circuit Breaker state machine, state transitions, and backoff timing
 *
 * Covers:
 * - State transitions: Closed → Open → Half-Open → Closed/Open
 * - Failure tracking: consecutive failures and failure rate calculation
 * - Probe acquisition for Half-Open testing
 * - Exponential backoff timing for recovery
 * - Manual reset functionality
 */
describe("Circuit Breaker Manager", () => {
  beforeEach(() => {
    CircuitBreakerManager.clearAll();
    vi.clearAllMocks();
  });

  afterEach(() => {
    CircuitBreakerManager.clearAll();
  });

  describe("Initial State", () => {
    it("should return undefined state for unknown circuit", () => {
      expect(CircuitBreakerManager.getState("unknown")).toBeUndefined();
    });

    it("should return empty stats for unknown circuit", () => {
      const stats = CircuitBreakerManager.getStats("unknown");
      expect(stats).toEqual({
        key: "unknown",
        state: undefined,
        failureCount: 0,
        failureWindowCount: 0,
        lastTransitionAt: undefined,
        nextRecoveryAt: undefined,
        consecutiveHalfOpenFailures: 0,
      });
    });

    it("should return empty array when no circuits exist", () => {
      const stats = CircuitBreakerManager.getStats();
      expect(stats).toEqual([]);
    });
  });

  describe("State Transitions", () => {
    it("should transition Closed → Open on consecutive failures", () => {
      const key = "test-endpoint";
      const thresholds: Required<CircuitThresholds> = {
        failures: 3,
        ratePercent: 101, // Set higher than 100% so individual failures don't trigger (only consecutive count)
        rateWindowMs: 60000,
        baseTimeoutMs: 1000,
        maxTimeoutMs: 60000,
        treatNetworkErrors: true,
      };

      // First failure: no transition (1 < 3, rate 100% < 101%)
      CircuitBreakerManager.recordFailure(key, false, thresholds);
      expect(CircuitBreakerManager.getState(key)).toBe("Closed");

      // Second failure: no transition (2 < 3, rate 100% < 101%)
      CircuitBreakerManager.recordFailure(key, false, thresholds);
      expect(CircuitBreakerManager.getState(key)).toBe("Closed");

      // Third failure: should transition to Open (3 >= 3)
      CircuitBreakerManager.recordFailure(key, false, thresholds);
      expect(CircuitBreakerManager.getState(key)).toBe("Open");

      const stats = CircuitBreakerManager.getStats(key);
      expect(stats.failureCount).toBe(3);
    });

    it("should transition Closed → Open on failure rate threshold", () => {
      const key = "test-endpoint";
      const thresholds: Required<CircuitThresholds> = {
        failures: 100, // High consecutive threshold
        ratePercent: 50, // But 50% failure rate triggers
        rateWindowMs: 60000,
        baseTimeoutMs: 1000,
        maxTimeoutMs: 60000,
        treatNetworkErrors: true,
      };

      // Record 3 successes and 3 failures = 50% rate (should trigger)
      for (let i = 0; i < 3; i++) {
        CircuitBreakerManager.recordSuccess(key);
      }
      for (let i = 0; i < 3; i++) {
        CircuitBreakerManager.recordFailure(key, false, thresholds);
      }

      // Wait for transition check
      const state = CircuitBreakerManager.getState(key);
      expect(state).toBe("Open");
    });

    it("should transition Open → Half-Open after recovery timeout", () => {
      const key = "test-endpoint";
      const thresholds: Required<CircuitThresholds> = {
        failures: 2,
        ratePercent: 50,
        rateWindowMs: 60000,
        baseTimeoutMs: 100, // Short timeout for testing
        maxTimeoutMs: 60000,
        treatNetworkErrors: true,
      };

      // Open the circuit
      CircuitBreakerManager.recordFailure(key, false, thresholds);
      CircuitBreakerManager.recordFailure(key, false, thresholds);
      expect(CircuitBreakerManager.getState(key)).toBe("Open");

      const stats1 = CircuitBreakerManager.getStats(key);
      const recoveryAt = stats1.nextRecoveryAt!;

      // Before timeout: still Open
      expect(CircuitBreakerManager.getState(key)).toBe("Open");

      // Wait for recovery timeout
      vi.useFakeTimers();
      vi.setSystemTime(recoveryAt + 1);

      // After timeout: should transition to Half-Open
      expect(CircuitBreakerManager.getState(key)).toBe("Half-Open");

      vi.useRealTimers();
    });

    it("should transition Half-Open → Closed on success", () => {
      const key = "test-endpoint";
      const thresholds: Required<CircuitThresholds> = {
        failures: 2,
        ratePercent: 50,
        rateWindowMs: 60000,
        baseTimeoutMs: 100,
        maxTimeoutMs: 60000,
        treatNetworkErrors: true,
      };

      // Open the circuit
      CircuitBreakerManager.recordFailure(key, false, thresholds);
      CircuitBreakerManager.recordFailure(key, false, thresholds);
      expect(CircuitBreakerManager.getState(key)).toBe("Open");

      // Transition to Half-Open
      const stats1 = CircuitBreakerManager.getStats(key);
      vi.useFakeTimers();
      vi.setSystemTime(stats1.nextRecoveryAt! + 1);

      expect(CircuitBreakerManager.getState(key)).toBe("Half-Open");

      // Success in Half-Open: transition to Closed
      CircuitBreakerManager.recordSuccess(key);
      expect(CircuitBreakerManager.getState(key)).toBe("Closed");

      // Verify state reset
      const stats2 = CircuitBreakerManager.getStats(key);
      expect(stats2.failureCount).toBe(0);
      expect(stats2.consecutiveHalfOpenFailures).toBe(0);

      vi.useRealTimers();
    });

    it("should transition Half-Open → Open on failure with exponential backoff", () => {
      const key = "test-endpoint";
      const thresholds: Required<CircuitThresholds> = {
        failures: 2,
        ratePercent: 50,
        rateWindowMs: 60000,
        baseTimeoutMs: 1000,
        maxTimeoutMs: 60000,
        treatNetworkErrors: true,
      };

      // Open the circuit
      CircuitBreakerManager.recordFailure(key, false, thresholds);
      CircuitBreakerManager.recordFailure(key, false, thresholds);

      const stats1 = CircuitBreakerManager.getStats(key);
      const firstRecoveryAt = stats1.nextRecoveryAt!;

      // Transition to Half-Open
      vi.useFakeTimers();
      vi.setSystemTime(firstRecoveryAt + 1);
      CircuitBreakerManager.getState(key); // Trigger transition

      // Failure in Half-Open: back to Open with backoff
      CircuitBreakerManager.recordFailure(key, false, thresholds);
      expect(CircuitBreakerManager.getState(key)).toBe("Open");

      const stats2 = CircuitBreakerManager.getStats(key);
      const secondRecoveryAt = stats2.nextRecoveryAt!;

      // Verify exponential backoff: second timeout should be longer
      // baseTimeoutMs * 2^(consecutiveHalfOpenFailures - 1) = 1000 * 2^0 = 1000
      expect(secondRecoveryAt - firstRecoveryAt).toBeGreaterThan(1000);

      vi.useRealTimers();
    });
  });

  describe("Failure Recording", () => {
    it("should skip recording network errors when treatNetworkErrors is false", () => {
      const key = "test-endpoint";
      const thresholds: Required<CircuitThresholds> = {
        failures: 2,
        ratePercent: 50,
        rateWindowMs: 60000,
        baseTimeoutMs: 1000,
        maxTimeoutMs: 60000,
        treatNetworkErrors: false, // Don't count network errors
      };

      // Record one network error (should be skipped, no circuit created)
      CircuitBreakerManager.recordFailure(key, true, thresholds);
      // When network error is skipped, no circuit is created at all
      expect(CircuitBreakerManager.getState(key)).toBeUndefined();

      const stats = CircuitBreakerManager.getStats(key);
      expect(stats.failureCount).toBe(0);
    });

    it("should count network errors when treatNetworkErrors is true", () => {
      const key = "test-endpoint";
      const thresholds: Required<CircuitThresholds> = {
        failures: 2,
        ratePercent: 50,
        rateWindowMs: 60000,
        baseTimeoutMs: 1000,
        maxTimeoutMs: 60000,
        treatNetworkErrors: true, // Count network errors
      };

      CircuitBreakerManager.recordFailure(key, true, thresholds);
      const stats = CircuitBreakerManager.getStats(key);
      expect(stats.failureCount).toBe(1);
    });

    it("should track failure rate percentage correctly", () => {
      const key = "test-endpoint";
      const thresholds: Required<CircuitThresholds> = {
        failures: 100, // High threshold to prevent consecutive failures trigger
        ratePercent: 40, // But 40% rate should trigger
        rateWindowMs: 60000,
        baseTimeoutMs: 1000,
        maxTimeoutMs: 60000,
        treatNetworkErrors: true,
      };

      // Record 5 requests: 2 successes, 3 failures = 60% failure rate (exceeds 40%)
      CircuitBreakerManager.recordSuccess(key);
      CircuitBreakerManager.recordSuccess(key);
      CircuitBreakerManager.recordFailure(key, false, thresholds);
      CircuitBreakerManager.recordFailure(key, false, thresholds);
      CircuitBreakerManager.recordFailure(key, false, thresholds);

      expect(CircuitBreakerManager.getState(key)).toBe("Open");
    });

    it("should clean up old entries from sliding window", () => {
      const key = "test-endpoint";
      const thresholds: Required<CircuitThresholds> = {
        failures: 100,
        ratePercent: 50,
        rateWindowMs: 1000, // 1s window
        baseTimeoutMs: 1000,
        maxTimeoutMs: 60000,
        treatNetworkErrors: true,
      };

      vi.useFakeTimers();

      // Record failures at t=0
      CircuitBreakerManager.recordFailure(key, false, thresholds);
      CircuitBreakerManager.recordFailure(key, false, thresholds);

      // Advance time past window
      vi.setSystemTime(Date.now() + 1500);

      // Record new failure at t=1500
      CircuitBreakerManager.recordFailure(key, false, thresholds);

      // Old failures should be dropped from window
      const stats = CircuitBreakerManager.getStats(key);
      expect(stats.failureWindowCount).toBe(1);
      expect(stats.failureCount).toBe(3); // But consecutive count still 3

      vi.useRealTimers();
    });
  });

  describe("Probe Acquisition", () => {
    it("should allow single probe in Half-Open state", () => {
      const key = "test-endpoint";
      const thresholds: Required<CircuitThresholds> = {
        failures: 2,
        ratePercent: 50,
        rateWindowMs: 60000,
        baseTimeoutMs: 100,
        maxTimeoutMs: 60000,
        treatNetworkErrors: true,
      };

      // Open the circuit
      CircuitBreakerManager.recordFailure(key, false, thresholds);
      CircuitBreakerManager.recordFailure(key, false, thresholds);

      // Transition to Half-Open
      const stats1 = CircuitBreakerManager.getStats(key);
      vi.useFakeTimers();
      vi.setSystemTime(stats1.nextRecoveryAt! + 1);

      CircuitBreakerManager.getState(key); // Trigger transition
      expect(CircuitBreakerManager.getState(key)).toBe("Half-Open");

      // First probe: allowed
      expect(CircuitBreakerManager.tryAcquireProbe(key)).toBe(true);

      // Second probe: blocked (already in flight)
      expect(CircuitBreakerManager.tryAcquireProbe(key)).toBe(false);

      // After success, probe should reset
      CircuitBreakerManager.recordSuccess(key);
      expect(CircuitBreakerManager.tryAcquireProbe(key)).toBe(false); // No longer Half-Open

      vi.useRealTimers();
    });

    it("should reject probe acquisition in Closed state", () => {
      const key = "test-endpoint";
      expect(CircuitBreakerManager.tryAcquireProbe(key)).toBe(false);
    });

    it("should reject probe acquisition in Open state", () => {
      const key = "test-endpoint";
      const thresholds: Required<CircuitThresholds> = {
        failures: 2,
        ratePercent: 50,
        rateWindowMs: 60000,
        baseTimeoutMs: 1000,
        maxTimeoutMs: 60000,
        treatNetworkErrors: true,
      };

      CircuitBreakerManager.recordFailure(key, false, thresholds);
      CircuitBreakerManager.recordFailure(key, false, thresholds);

      expect(CircuitBreakerManager.getState(key)).toBe("Open");
      expect(CircuitBreakerManager.tryAcquireProbe(key)).toBe(false);
    });
  });

  describe("Statistics and Querying", () => {
    it("should return correct stats for single key", () => {
      const key = "test-endpoint";
      const thresholds: Required<CircuitThresholds> = {
        failures: 100, // High threshold to prevent consecutive failures trigger
        ratePercent: 101, // Higher than 100% to prevent rate-based trigger
        rateWindowMs: 60000,
        baseTimeoutMs: 1000,
        maxTimeoutMs: 60000,
        treatNetworkErrors: true,
      };

      CircuitBreakerManager.recordFailure(key, false, thresholds);
      CircuitBreakerManager.recordFailure(key, false, thresholds);

      const stats = CircuitBreakerManager.getStats(key);
      expect(stats.key).toBe(key);
      expect(stats.state).toBe("Closed");
      expect(stats.failureCount).toBe(2);
      expect(stats.failureWindowCount).toBe(2);
      expect(stats.lastTransitionAt).toBeDefined();
      // nextRecoveryAt is 0 when not Open
      expect(stats.nextRecoveryAt).toBe(0);
    });

    it("should return all circuit stats when no key provided", () => {
      const thresholds: Required<CircuitThresholds> = {
        failures: 2,
        ratePercent: 50,
        rateWindowMs: 60000,
        baseTimeoutMs: 1000,
        maxTimeoutMs: 60000,
        treatNetworkErrors: true,
      };

      CircuitBreakerManager.recordFailure("endpoint1", false, thresholds);
      CircuitBreakerManager.recordFailure("endpoint2", false, thresholds);
      CircuitBreakerManager.recordFailure("endpoint2", false, thresholds);

      const allStats = CircuitBreakerManager.getStats();
      expect(allStats).toHaveLength(2);

      const endpoint1Stats = allStats.find((s) => s.key === "endpoint1");
      const endpoint2Stats = allStats.find((s) => s.key === "endpoint2");

      expect(endpoint1Stats?.failureCount).toBe(1);
      expect(endpoint2Stats?.failureCount).toBe(2);
    });
  });

  describe("Manual Reset", () => {
    it("should reset single circuit to Closed", () => {
      const key = "test-endpoint";
      const thresholds: Required<CircuitThresholds> = {
        failures: 2,
        ratePercent: 50,
        rateWindowMs: 60000,
        baseTimeoutMs: 1000,
        maxTimeoutMs: 60000,
        treatNetworkErrors: true,
      };

      CircuitBreakerManager.recordFailure(key, false, thresholds);
      CircuitBreakerManager.recordFailure(key, false, thresholds);
      expect(CircuitBreakerManager.getState(key)).toBe("Open");

      CircuitBreakerManager.reset(key);
      expect(CircuitBreakerManager.getState(key)).toBe("Closed");

      const stats = CircuitBreakerManager.getStats(key);
      expect(stats.failureCount).toBe(0);
      expect(stats.consecutiveHalfOpenFailures).toBe(0);
    });

    it("should reset all circuits", () => {
      const thresholds: Required<CircuitThresholds> = {
        failures: 2,
        ratePercent: 50,
        rateWindowMs: 60000,
        baseTimeoutMs: 1000,
        maxTimeoutMs: 60000,
        treatNetworkErrors: true,
      };

      CircuitBreakerManager.recordFailure("endpoint1", false, thresholds);
      CircuitBreakerManager.recordFailure("endpoint1", false, thresholds);
      CircuitBreakerManager.recordFailure("endpoint2", false, thresholds);
      CircuitBreakerManager.recordFailure("endpoint2", false, thresholds);

      expect(CircuitBreakerManager.getState("endpoint1")).toBe("Open");
      expect(CircuitBreakerManager.getState("endpoint2")).toBe("Open");

      CircuitBreakerManager.reset();

      expect(CircuitBreakerManager.getState("endpoint1")).toBe("Closed");
      expect(CircuitBreakerManager.getState("endpoint2")).toBe("Closed");
    });

    it("should silently handle reset of unknown circuit", () => {
      expect(() => {
        CircuitBreakerManager.reset("unknown");
      }).not.toThrow();
    });
  });

  describe("Exponential Backoff", () => {
    it("should apply exponential backoff on repeated Half-Open failures", () => {
      const key = "test-endpoint";
      const thresholds: Required<CircuitThresholds> = {
        failures: 2,
        ratePercent: 50,
        rateWindowMs: 60000,
        baseTimeoutMs: 1000,
        maxTimeoutMs: 60000,
        treatNetworkErrors: true,
      };

      vi.useFakeTimers();
      const baseTime = Date.now();
      vi.setSystemTime(baseTime);

      // First open
      CircuitBreakerManager.recordFailure(key, false, thresholds);
      CircuitBreakerManager.recordFailure(key, false, thresholds);

      let stats = CircuitBreakerManager.getStats(key);
      let firstRecoveryAt = stats.nextRecoveryAt!;
      expect(firstRecoveryAt - baseTime).toBe(1000); // baseTimeoutMs

      // Transition to Half-Open and fail
      vi.setSystemTime(firstRecoveryAt + 1);
      CircuitBreakerManager.getState(key);
      CircuitBreakerManager.recordFailure(key, false, thresholds);

      stats = CircuitBreakerManager.getStats(key);
      let secondRecoveryAt = stats.nextRecoveryAt!;
      // First Half-Open failure: baseTimeoutMs * 2^(1-1) = baseTimeoutMs * 1
      expect(secondRecoveryAt - (firstRecoveryAt + 1)).toBe(1000);

      // Transition to Half-Open again and fail
      vi.setSystemTime(secondRecoveryAt + 1);
      CircuitBreakerManager.getState(key);
      CircuitBreakerManager.recordFailure(key, false, thresholds);

      stats = CircuitBreakerManager.getStats(key);
      let thirdRecoveryAt = stats.nextRecoveryAt!;
      // Second Half-Open failure: baseTimeoutMs * 2^(2-1) = baseTimeoutMs * 2
      expect(thirdRecoveryAt - (secondRecoveryAt + 1)).toBe(2000);

      vi.useRealTimers();
    });

    it("should cap backoff at maxTimeoutMs", () => {
      const key = "test-endpoint";
      const thresholds: Required<CircuitThresholds> = {
        failures: 2,
        ratePercent: 50,
        rateWindowMs: 60000,
        baseTimeoutMs: 1000,
        maxTimeoutMs: 3000, // Cap at 3s
        treatNetworkErrors: true,
      };

      vi.useFakeTimers();
      const baseTime = Date.now();
      vi.setSystemTime(baseTime);

      CircuitBreakerManager.recordFailure(key, false, thresholds);
      CircuitBreakerManager.recordFailure(key, false, thresholds);

      // Multiple Half-Open failures to exceed cap
      for (let i = 0; i < 3; i++) {
        let stats = CircuitBreakerManager.getStats(key);
        const recoveryAt = stats.nextRecoveryAt!;
        vi.setSystemTime(recoveryAt + 1);
        CircuitBreakerManager.getState(key);
        CircuitBreakerManager.recordFailure(key, false, thresholds);
      }

      const finalStats = CircuitBreakerManager.getStats(key);
      const finalRecoveryAt = finalStats.nextRecoveryAt!;

      // After 3 Half-Open failures, backoff should be capped at maxTimeoutMs
      // Failure 1: 1000 * 2^0 = 1000
      // Failure 2: 1000 * 2^1 = 2000
      // Failure 3: 1000 * 2^2 = 4000 -> capped at 3000
      // Final nextRecoveryAt should be at most baseTime + 1000 + 1 + 1000 + 1 + 2000 + 1 + 3000
      const maxExpectedFinalRecoveryAt = baseTime + 7000 + 3; // Very loose bound

      expect(finalRecoveryAt).toBeLessThanOrEqual(maxExpectedFinalRecoveryAt);
    });
  });
});
