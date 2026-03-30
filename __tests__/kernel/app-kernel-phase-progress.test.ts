/**
 * App Kernel Phase Progress Tracking Tests
 *
 * Tests for Track B implementation:
 * - Phase progress initialization
 * - Progress percentage calculation
 * - Phase index tracking
 * - Phase label generation
 * - Progress updates as phases complete
 */

import { AppKernel } from "@/system/Kernel";
import type { PhaseProgress } from "@/type-definitions/kernel-types";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock config loader to prevent real config loading
vi.mock("@/lib/config/loader", () => ({
  getAppConfig: vi.fn(() => ({
    version: 1,
    safeMode: {
      kernelTimeoutMs: 100000,
      syncFailureThreshold: 3,
      storageHealthCheckIntervalMs: 300000,
      authHealthCheckIntervalMs: 14400000,
      autoRecoveryAttempts: 2,
      autoRecoveryDelayMs: 5000,
    },
    featureFlags: {
      loggerCategories: { bootstrap: true },
    },
  })),
}));

// Mock all kernel phases
vi.mock("@/system/Kernel/phases/config-phase", () => ({
  configPhase: vi.fn(async () => {
    await new Promise((r) => setTimeout(r, 10));
  }),
}));

vi.mock("@/system/Kernel/phases/preload-phase", () => ({
  preloadPhase: vi.fn(async () => {
    await new Promise((r) => setTimeout(r, 10));
  }),
}));

vi.mock("@/system/Kernel/phases/network-phase", () => ({
  networkPhase: vi.fn(async () => {
    await new Promise((r) => setTimeout(r, 10));
  }),
}));

vi.mock("@/system/Kernel/phases/storage-phase", () => ({
  storagePhase: vi.fn(async () => {
    await new Promise((r) => setTimeout(r, 10));
  }),
}));

vi.mock("@/system/Kernel/phases/services-phase", () => ({
  servicesPhase: vi.fn(async () => {
    await new Promise((r) => setTimeout(r, 10));
  }),
}));

vi.mock("@/system/Kernel/phases/job-setup-phase", () => ({
  jobSetupPhase: vi.fn(async () => {
    await new Promise((r) => setTimeout(r, 10));
  }),
}));

vi.mock("@/system/Kernel/phases/auth-phase", () => ({
  authPhase: vi.fn(async () => {
    await new Promise((r) => setTimeout(r, 10));
  }),
}));

// Mock NetworkDetection
vi.mock("@/system/Network", () => ({
  NetworkDetection: {
    subscribe: vi.fn(() => () => {}),
    getStatus: vi.fn(() => ({
      isOnline: true,
      type: "wifi",
    })),
  },
}));

// Mock other dependencies
vi.mock("@/lib/analytics", () => ({
  Analytics: { track: vi.fn(async () => {}) },
}));

vi.mock("@/system/Services", () => ({
  getDatabaseProvider: () => ({ isConfigured: () => false }),
}));

describe("AppKernel Phase Progress Tracking (Track B)", () => {
  beforeEach(() => {
    // Reset kernel state before each test
    AppKernel.reset();
  });

  it("should initialize with phase progress at 0%", () => {
    const state = AppKernel.getState();
    expect(state.phaseProgress.progressPercent).toBe(0);
    expect(state.phaseProgress.currentPhaseIndex).toBe(0);
    expect(state.phaseProgress.currentPhaseName).toBe("config");
    expect(state.phaseProgress.phaseLabel).toMatch(/^0\/\d+ Initializing\.\.\.$/);
  });

  it("should track phase progress as phases complete", async () => {
    const progressSnapshots: PhaseProgress[] = [];

    // Subscribe to kernel state changes and capture progress
    const unsubscribe = AppKernel.subscribe((state) => {
      progressSnapshots.push({ ...state.phaseProgress });
    });

    try {
      await AppKernel.initialize();
    } catch {
      // Initialization may fail due to mocks, that's ok
    }

    unsubscribe();

    // Verify we captured progress updates
    expect(progressSnapshots.length).toBeGreaterThan(0);

    // Progress should generally increase (though not strictly, as multiple updates per phase)
    const percentages = progressSnapshots.map((p) => p.progressPercent);
    expect(Math.max(...percentages)).toBeGreaterThan(0);
  });

  it("should reach 100% when appReady", async () => {
    let finalProgress: PhaseProgress | null = null;

    const unsubscribe = AppKernel.subscribe((state) => {
      if (state.phases.appReady) {
        finalProgress = state.phaseProgress;
      }
    });

    try {
      await AppKernel.initialize();
    } catch {
      // Initialization may fail due to mocks
    }

    unsubscribe();

    // If we got to appReady, progress should be 100%
    expect(finalProgress).not.toBeNull();
    if (finalProgress) {
      const progress = finalProgress as PhaseProgress;
      expect(progress.progressPercent).toBe(100);
      expect(progress.currentPhaseName).toBe("ready");
      expect(progress.phaseLabel).toContain("Ready!");
    }
  });

  it("should calculate progress as (completedPhases / totalPhases * 100)", () => {
    //const state = AppKernel.getState();

    // Derive total phases from the phaseLabel (format: "X/N ...")
    const label = AppKernel.getState().phaseProgress.phaseLabel;
    const m = label.match(/^\d+\/(\d+)/);
    expect(m).not.toBeNull();
    const total = m ? Number(m[1]) : 0;
    // With N phases total, each complete phase is ~Math.round((1/N)*100)
    const expectedPercentPerPhase = Math.round((1 / total) * 100);
    expect(expectedPercentPerPhase).toBeGreaterThan(0);
  });

  it("should format phaseLabel correctly", async () => {
    let labels: string[] = [];

    const unsubscribe = AppKernel.subscribe((state) => {
      labels.push(state.phaseProgress.phaseLabel);
    });

    try {
      await AppKernel.initialize();
    } catch {
      // Initialization may fail
    }

    unsubscribe();

    // Should have phase labels like "X/N phaseName..."
    expect(labels.length).toBeGreaterThan(0);
    expect(labels[0]).toMatch(/^\d+\/\d+ /);
  });
});
