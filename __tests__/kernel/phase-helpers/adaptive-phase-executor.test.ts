import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    calculateEffectiveTimeout,
    calculateSlowdownFactor,
    createSlowdownAnalytics,
    executePhaseWithTimeout,
} from "@/system/Kernel/phase-helpers/adaptive-phase-executor";

// Mock config to use small baseMs values for fast tests
vi.mock("@/config", () => ({
  getAppConfig: vi.fn(() => ({
    kernel: {
      phaseTiming: {
        services: { baseMs: 30 },
        config: { baseMs: 20 },
        network: { baseMs: 25 },
      },
    },
  })),
}));

// Mock error classifier to deterministic return values
vi.mock("@/system/Kernel/phase-helpers/phase-error-classifier", () => ({
  classifyPhaseError: vi.fn((err: any) => {
    if (!err) return "non-recoverable";
    const msg = (err && err.message) || String(err);
    if (/ENOTFOUND/i.test(msg)) return "unreachable";
    if (/TIMEOUT/i.test(msg)) return "timeout";
    return "non-recoverable";
  }),
  isTimeout: vi.fn((t: string) => t === "timeout"),
}));

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

describe("adaptive-phase-executor (unit)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("calculateSlowdownFactor: handles edge cases and normal ratios", () => {
    expect(calculateSlowdownFactor(0, 100)).toBe(1.0);
    expect(calculateSlowdownFactor(50, 100)).toBe(1.0); // faster than baseline -> clamp to 1
    expect(calculateSlowdownFactor(200, 100)).toBeCloseTo(2.0);
    expect(calculateSlowdownFactor(-10, 100)).toBe(1.0);
    expect(calculateSlowdownFactor(100, 0)).toBe(1.0);
  });

  it("calculateSlowdownFactor: faster and slower config timings (measured)", async () => {
    // slower-than-baseline: actual > baseline -> factor > 1
    const baseline = 20;
    const t0 = Date.now();
    await sleep(60);
    const actualMs = Date.now() - t0;
    const slowFactor = calculateSlowdownFactor(actualMs, baseline);
    expect(slowFactor).toBeGreaterThan(1.0);

    // faster-than-baseline: actual < baseline -> clamp to 1
    const baseline2 = 50;
    const t1 = Date.now();
    await sleep(5);
    const actualMs2 = Date.now() - t1;
    const fastFactor = calculateSlowdownFactor(actualMs2, baseline2);
    expect(fastFactor).toBe(1.0);
  });

  it("createSlowdownAnalytics: computes factor and percentage correctly", () => {
    const analytics = createSlowdownAnalytics(1950, 700);
    const expectedFactor = 1950 / 700;
    expect(analytics.factor).toBeCloseTo(expectedFactor);
    expect(analytics.percentageOverBaseline).toBe(
      Math.round((expectedFactor - 1) * 100)
    );
  });

  it("calculateEffectiveTimeout: uses configured baseMs and fallback", () => {
    // services baseMs from mocked config = 30
    const t1 = calculateEffectiveTimeout("services", 1.0, 1.0);
    expect(typeof t1).toBe("number");
    expect(t1).toBe(Math.ceil(30 * 1.0 * 1.0));

    const t2 = calculateEffectiveTimeout("services", 1.5, 1.25);
    expect(t2).toBe(Math.ceil(30 * 1.5 * 1.25));

    // unknown phase -> fallback to 3000 baseline
    const t3 = calculateEffectiveTimeout("no-such-phase", 1.0, 1.5);
    expect(t3).toBe(Math.ceil(3000 * 1.0 * 1.5));
  });

  it("executePhaseWithTimeout: resolves success when fn completes before timeout", async () => {
    const fastFn = async (_signal: AbortSignal) => {
      await sleep(10);
    };

    const res = await executePhaseWithTimeout("services", fastFn, 1.0, 1.0);
    expect(res.status).toBe("success");
    expect(res.durationMs).toBeGreaterThanOrEqual(10);
  });

  it("executePhaseWithTimeout: resolves skipped timeout when fn takes too long", async () => {
    // services baseMs = 30ms, use default multipliers => timeout ~30ms
    const longFn = async (_signal: AbortSignal) => {
      await sleep(150);
    };

    const res = await executePhaseWithTimeout("services", longFn, 1.0, 1.0);
    expect(res.status).toBe("skipped");
    expect(res.reason).toBe("timeout");
    expect(res.retriable).toBe(true);
    // durationMs on timeout path is set to the timeout
    expect(typeof res.durationMs).toBe("number");
    expect(res.durationMs).toBeGreaterThanOrEqual(30);
  });

  it("executePhaseWithTimeout: maps thrown errors via classifier and isTimeout", async () => {
    const errFn = async (_signal: AbortSignal) => {
      throw new Error("ENOTFOUND: service host not found");
    };

    const res = await executePhaseWithTimeout("services", errFn, 1.0, 1.0);
    expect(res.status).toBe("skipped");
    expect(res.reason).toBe("unreachable");
    // isTimeout mocked to return true only for 'timeout', so retriable should be false here
    expect(res.retriable).toBe(false);
    expect(res.error).toBeDefined();
  });

  it("post-timeout cancellation: fn respects AbortSignal and stops mutating state", async () => {
    let mutated = false;

    const sideEffectFn = async (signal: AbortSignal) => {
      // Simulate slow work — check signal before committing the state mutation
      await sleep(80);
      if (!signal.aborted) mutated = true;
    };

    const res = await executePhaseWithTimeout("services", sideEffectFn, 1.0, 1.0);
    // Should have timed out
    expect(res.status).toBe("skipped");
    // Wait a bit longer to allow the background fn to run its signal check
    await sleep(120);
    // Mutation must NOT have occurred — abort signal prevented post-timeout side effect
    expect(mutated).toBe(false);
  });

  it("stress: calculateEffectiveTimeout over a range of slowdowns and network multipliers", () => {
    const slowdowns = [1.0, 1.25, 1.5, 2.0, 3.0];
    const nets = [0.5, 1.0, 1.5, 3.5];
    const phases = ["services", "network", "config", "missing-phase"];

    for (const s of slowdowns) {
      for (const n of nets) {
        for (const p of phases) {
          const t = calculateEffectiveTimeout(p, s, n);
          expect(Number.isFinite(t)).toBe(true);
          expect(t).toBeGreaterThan(0);
        }
      }
    }
  });
});
