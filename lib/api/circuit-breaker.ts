import { getAppConfig } from "../config";
import { logger } from "../utils/logger";

/**
 * Circuit Breaker: Fails fast for unhealthy endpoints, allows controlled recovery
 *
 * States: Closed (OK) → Open (too many failures, fast-fail) → Half-Open (test recovery) → Closed or back to Open
 */

export class CircuitBreakerOpenError extends Error {
  constructor(
    public endpoint: string,
    public state: "Open",
    public recoveryAt: number, // timestamp when Half-Open test will be allowed
  ) {
    super(`Circuit breaker open for endpoint: ${endpoint}`);
    this.name = "CircuitBreakerOpenError";
  }
}

export interface CircuitThresholds {
  /** Consecutive failures before opening circuit (default: from config) */
  failures?: number;
  /** Failure rate percentage in sliding window before opening (default: from config) */
  ratePercent?: number;
  /** Sliding window duration in ms for rate calculation (default: from config) */
  rateWindowMs?: number;
  /** Base recovery timeout in ms before allowing Half-Open test (default: from config) */
  baseTimeoutMs?: number;
  /** Maximum recovery timeout after repeated Half-Open failures (default: from config) */
  maxTimeoutMs?: number;
  /** Whether network errors count toward failure threshold (default: from config) */
  treatNetworkErrors?: boolean;
}

export interface CircuitStats {
  key: string;
  state: "Closed" | "Open" | "Half-Open" | undefined;
  failureCount: number;
  failureWindowCount: number;
  lastTransitionAt?: number;
  nextRecoveryAt?: number;
  consecutiveHalfOpenFailures: number;
}

interface CircuitState {
  state: "Closed" | "Open" | "Half-Open";
  consecutiveFailures: number;
  failureWindow: number[]; // timestamps of failures in sliding window
  requestWindow: number[]; // timestamps of all requests (success or failure) in sliding window
  lastTransitionAt: number;
  nextRecoveryAt: number;
  consecutiveHalfOpenFailures: number;
  halfOpenProbeInFlight: boolean;
}

/**
 * Get default circuit breaker thresholds from config
 */
function getDefaultThresholds(): Required<CircuitThresholds> {
  const config = getAppConfig();
  const cb = config.circuitBreaker;
  return {
    failures: cb?.failures ?? 10,
    ratePercent: cb?.ratePercent ?? 50,
    rateWindowMs: cb?.rateWindowMs ?? 60000,
    baseTimeoutMs: cb?.baseTimeoutMs ?? 30000,
    maxTimeoutMs: cb?.maxTimeoutMs ?? 300000,
    treatNetworkErrors: cb?.treatNetworkErrors ?? true,
  };
}

const DEFAULT_THRESHOLDS: Required<CircuitThresholds> = getDefaultThresholds();

export { DEFAULT_THRESHOLDS };

/**
 * Circuit Breaker Manager: Singleton managing per-endpoint circuit state
 *
 * Thread-safe (single-process, in-memory)
 */
class CircuitBreakerManagerClass {
  private circuits = new Map<string, CircuitState>();
  private static instance: CircuitBreakerManagerClass | null = null;

  private constructor() {}

  static getInstance(): CircuitBreakerManagerClass {
    if (!this.instance) {
      this.instance = new CircuitBreakerManagerClass();
    }
    return this.instance;
  }

  /**
   * Get current state of a circuit
   */
  getState(key: string): "Closed" | "Open" | "Half-Open" | undefined {
    const circuit = this.circuits.get(key);
    if (!circuit) return undefined;

    // If Open and recovery timeout elapsed, transition to Half-Open
    if (circuit.state === "Open" && Date.now() >= circuit.nextRecoveryAt) {
      circuit.state = "Half-Open";
      circuit.lastTransitionAt = Date.now();
      circuit.halfOpenProbeInFlight = false;
      logger.warn("api", `Circuit breaker Half-Open (recovery test): ${key}`, {
        endpoint: key,
        nextRecoveryAt: circuit.nextRecoveryAt,
      });
    }

    return circuit.state;
  }

  /**
   * Get stats for one or all circuits
   */
  getStats(key: string): CircuitStats;
  getStats(): CircuitStats[];
  getStats(key?: string): CircuitStats | CircuitStats[] {
    if (key) {
      const circuit = this.circuits.get(key);
      return {
        key,
        state: circuit?.state,
        failureCount: circuit?.consecutiveFailures ?? 0,
        failureWindowCount: circuit?.failureWindow.length ?? 0,
        lastTransitionAt: circuit?.lastTransitionAt,
        nextRecoveryAt: circuit?.nextRecoveryAt,
        consecutiveHalfOpenFailures: circuit?.consecutiveHalfOpenFailures ?? 0,
      };
    }

    // Return all circuits
    return Array.from(this.circuits.entries()).map(([k, circuit]) => ({
      key: k,
      state: circuit.state,
      failureCount: circuit.consecutiveFailures,
      failureWindowCount: circuit.failureWindow.length,
      lastTransitionAt: circuit.lastTransitionAt,
      nextRecoveryAt: circuit.nextRecoveryAt,
      consecutiveHalfOpenFailures: circuit.consecutiveHalfOpenFailures,
    }));
  }

  /**
   * Record a successful request
   * If Half-Open, transition to Closed
   * If Closed, no change
   */
  recordSuccess(key: string): void {
    const circuit = this.circuits.get(key);
    if (!circuit) return; // No circuit for this key yet

    // Add successful request to sliding window for failure rate calculation
    const now = Date.now();
    circuit.requestWindow.push(now);
    circuit.requestWindow = circuit.requestWindow.filter(
      (t) => now - t < DEFAULT_THRESHOLDS.rateWindowMs,
    );

    if (circuit.state === "Half-Open") {
      circuit.state = "Closed";
      circuit.consecutiveFailures = 0;
      circuit.failureWindow = [];
      circuit.consecutiveHalfOpenFailures = 0;
      circuit.lastTransitionAt = Date.now();
      logger.debug(
        "api",
        `Circuit breaker Closed (recovery successful): ${key}`,
        {
          endpoint: key,
        },
      );
    } else if (circuit.state === "Closed") {
      circuit.consecutiveFailures = 0;
    }

    circuit.halfOpenProbeInFlight = false;
  }

  /**
   * Record a failed request
   * If Closed, may transition to Open based on thresholds
   * If Half-Open, transition back to Open with increased timeout
   */
  recordFailure(
    key: string,
    isNetworkError: boolean,
    thresholds: Required<CircuitThresholds> = DEFAULT_THRESHOLDS,
  ): void {
    // Skip network errors if configured to ignore them
    if (isNetworkError && !thresholds.treatNetworkErrors) {
      return;
    }

    let circuit = this.circuits.get(key);
    if (!circuit) {
      circuit = {
        state: "Closed",
        consecutiveFailures: 0,
        failureWindow: [],
        requestWindow: [],
        lastTransitionAt: Date.now(),
        nextRecoveryAt: 0,
        consecutiveHalfOpenFailures: 0,
        halfOpenProbeInFlight: false,
      };
      this.circuits.set(key, circuit);
    }

    circuit.halfOpenProbeInFlight = false;

    // Add request and failure to sliding windows
    const now = Date.now();
    circuit.requestWindow.push(now);
    circuit.failureWindow.push(now);
    circuit.requestWindow = circuit.requestWindow.filter(
      (t) => now - t < thresholds.rateWindowMs,
    );
    circuit.failureWindow = circuit.failureWindow.filter(
      (t) => now - t < thresholds.rateWindowMs,
    );

    // Increment consecutive failures
    circuit.consecutiveFailures++;

    // Check if should open circuit
    // Either: N consecutive failures, OR failure rate > ratePercent (actual percentage)
    const failureRate =
      circuit.requestWindow.length > 0
        ? (circuit.failureWindow.length / circuit.requestWindow.length) * 100
        : 0;
    const shouldOpen =
      circuit.consecutiveFailures >= thresholds.failures ||
      failureRate >= thresholds.ratePercent;

    if (circuit.state === "Closed" && shouldOpen) {
      circuit.state = "Open";
      circuit.nextRecoveryAt = now + thresholds.baseTimeoutMs;
      circuit.lastTransitionAt = now;
      logger.warn("api", `Circuit breaker Open: ${key}`, {
        endpoint: key,
        failures: circuit.consecutiveFailures,
        failureRate: failureRate.toFixed(1),
        recoveryAt: circuit.nextRecoveryAt,
      });
    } else if (circuit.state === "Half-Open") {
      // Half-Open failure: revert to Open with increased timeout
      circuit.state = "Open";
      circuit.consecutiveHalfOpenFailures++;
      const backoffMultiplier = Math.pow(
        2,
        circuit.consecutiveHalfOpenFailures - 1,
      );
      const nextTimeout = Math.min(
        thresholds.baseTimeoutMs * backoffMultiplier,
        thresholds.maxTimeoutMs,
      );
      circuit.nextRecoveryAt = now + nextTimeout;
      circuit.lastTransitionAt = now;
      logger.warn(
        "api",
        `Circuit breaker Open (Half-Open recovery failed): ${key}`,
        {
          endpoint: key,
          consecutiveHalfOpenFailures: circuit.consecutiveHalfOpenFailures,
          nextRecoveryAt: circuit.nextRecoveryAt,
        },
      );
    }
  }

  /**
   * Try to acquire a probe slot for Half-Open testing
   * Returns true if allowed (was marked as inFlight), false if another probe is already in flight
   */
  tryAcquireProbe(key: string): boolean {
    const circuit = this.circuits.get(key);
    if (!circuit || circuit.state !== "Half-Open") {
      return false;
    }

    if (circuit.halfOpenProbeInFlight) {
      return false;
    }

    circuit.halfOpenProbeInFlight = true;
    return true;
  }

  /**
   * Phase 4: Check if Half-Open recovery probe is allowed
   * Used by NetworkRecoveryRetryJobManager to coordinate recovery attempts
   */
  isHalfOpenProbeAllowed(key: string): boolean {
    const circuit = this.circuits.get(key);
    if (!circuit) return false;

    // Only allow probe if circuit is Open and recovery window has passed
    if (circuit.state === "Open" && Date.now() >= circuit.nextRecoveryAt) {
      if (!circuit.halfOpenProbeInFlight) {
        circuit.halfOpenProbeInFlight = true;
        circuit.state = "Half-Open";
        circuit.lastTransitionAt = Date.now();

        logger.info(
          "api",
          `Circuit breaker Half-Open (recovery probe): ${key}`,
          {
            endpoint: key,
            consecutiveHalfOpenFailures: circuit.consecutiveHalfOpenFailures,
          },
        );

        return true;
      }
    }

    return false;
  }

  /**
   * Manually reset a circuit or all circuits to Closed
   */
  reset(key?: string): void {
    if (key) {
      const circuit = this.circuits.get(key);
      if (circuit) {
        circuit.state = "Closed";
        circuit.consecutiveFailures = 0;
        circuit.failureWindow = [];
        circuit.requestWindow = [];
        circuit.nextRecoveryAt = 0;
        circuit.consecutiveHalfOpenFailures = 0;
        circuit.lastTransitionAt = Date.now();
        logger.debug("api", `Circuit breaker manually reset: ${key}`, {
          endpoint: key,
        });
      }
    } else {
      // Reset all
      for (const circuit of this.circuits.values()) {
        circuit.state = "Closed";
        circuit.consecutiveFailures = 0;
        circuit.failureWindow = [];
        circuit.requestWindow = [];
        circuit.nextRecoveryAt = 0;
        circuit.consecutiveHalfOpenFailures = 0;
        circuit.lastTransitionAt = Date.now();
      }
      logger.debug("api", "Circuit breaker manually reset (all)", {});
    }
  }

  /**
   * Clear all state (for testing)
   */
  clearAll(): void {
    this.circuits.clear();
  }
}

export const CircuitBreakerManager = CircuitBreakerManagerClass.getInstance();
