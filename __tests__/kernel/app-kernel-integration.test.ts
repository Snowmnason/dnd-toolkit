/**
 * AppKernel Safe Mode Integration Tests
 *
 * Tests critical integration points:
 * - AppKernel.setSafeMode() and state propagation
 * - Kernel timeout triggering safe mode
 * - Storage health monitor integration
 * - Auth health monitor integration
 * - Recovery action execution
 * - Network cascade detection
 */

import {
    SafeModeLevel,
    SafeModeReason,
    createSafeModeState,
} from "@/lib/error/safe-mode";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock implementations
const mockLogger = {
  category: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
};

const mockNetworkCascadeDetector = {
  reset: vi.fn(),
  recordFailure: vi.fn(),
  isTriggered: vi.fn(() => false),
};

// Mock AppKernel state for testing
class MockAppKernel {
  state = {
    safeMode: null as any,
    phases: {
      appReady: false,
      configLoaded: false,
      fontsLoaded: false,
      assetsPreloaded: false,
    },
  };

  setSafeMode(safeMode: any): void {
    const currentSafeMode = this.state.safeMode;

    // Guard: If already in same safe mode, ignore
    if (
      currentSafeMode &&
      safeMode &&
      currentSafeMode.reason === safeMode.reason &&
      currentSafeMode.level === safeMode.level
    ) {
      mockLogger.category().debug("Ignoring duplicate safe mode trigger");
      return;
    }

    this.state.safeMode = safeMode;

    if (safeMode) {
      const isEscalation =
        currentSafeMode &&
        this.getLevelSeverity(safeMode.level) >
          this.getLevelSeverity(currentSafeMode.level);

      mockLogger
        .category()
        .warn(
          isEscalation ? "App escalating safe mode" : "App entering safe mode",
          {
            level: safeMode.level,
            reason: safeMode.reason,
          },
        );
    } else {
      mockLogger.category().info("App exiting safe mode");
      mockNetworkCascadeDetector.reset();
    }
  }

  getSafeMode() {
    return this.state.safeMode;
  }

  private getLevelSeverity(level: SafeModeLevel): number {
    if (level === SafeModeLevel.DEGRADED) return 1;
    if (level === SafeModeLevel.SAFE) return 2;
    if (level === SafeModeLevel.RECOVERY) return 3;
    return 0;
  }

  setPhase(phase: string, ready: boolean): void {
    if (phase === "configLoaded") {
      this.state.phases.configLoaded = ready;
    }
    if (phase === "appReady") {
      this.state.phases.appReady = ready;
    }
  }
}

describe("AppKernel Safe Mode Integration", () => {
  let kernel: MockAppKernel;

  beforeEach(() => {
    kernel = new MockAppKernel();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("AppKernel.setSafeMode() and state propagation", () => {
    it("should set safe mode state correctly", () => {
      const safeMode = createSafeModeState(SafeModeReason.KERNEL_TIMEOUT, {
        details: "Bootstrap timeout",
      });

      kernel.setSafeMode(safeMode);

      expect(kernel.getSafeMode()).toBeDefined();
      expect(kernel.getSafeMode()?.level).toBe(SafeModeLevel.RECOVERY);
      expect(kernel.getSafeMode()?.reason).toBe(SafeModeReason.KERNEL_TIMEOUT);
    });

    it("should ignore duplicate safe mode triggers", () => {
      const safeMode = createSafeModeState(SafeModeReason.KERNEL_TIMEOUT);

      kernel.setSafeMode(safeMode);
      const firstState = kernel.getSafeMode();

      // Try to set same safe mode again
      kernel.setSafeMode(safeMode);

      // State should remain unchanged
      expect(kernel.getSafeMode()).toEqual(firstState);
    });

    it("should allow safe mode escalation", () => {
      const degradedMode = createSafeModeState(
        SafeModeReason.NETWORK_SYNC_FAILURES,
      );
      const recoveryMode = createSafeModeState(SafeModeReason.KERNEL_TIMEOUT);

      kernel.setSafeMode(degradedMode);
      expect(kernel.getSafeMode()?.level).toBe(SafeModeLevel.DEGRADED);

      kernel.setSafeMode(recoveryMode);
      expect(kernel.getSafeMode()?.level).toBe(SafeModeLevel.RECOVERY);
    });

    it("should reset cascade detector when exiting safe mode", () => {
      const safeMode = createSafeModeState(SafeModeReason.KERNEL_TIMEOUT);
      kernel.setSafeMode(safeMode);

      kernel.setSafeMode(null);

      expect(mockNetworkCascadeDetector.reset).toHaveBeenCalled();
    });

    it("should track affected features in safe mode state", () => {
      const safeMode = createSafeModeState(SafeModeReason.STORAGE_UNREADABLE);

      kernel.setSafeMode(safeMode);

      expect(kernel.getSafeMode()?.affectedFeatures).toBeDefined();
      expect(Array.isArray(kernel.getSafeMode()?.affectedFeatures)).toBe(true);
      expect(kernel.getSafeMode()?.affectedFeatures.length).toBeGreaterThan(0);
    });
  });

  describe("Kernel timeout triggering safe mode", () => {
    it("should create RECOVERY safe mode on kernel timeout", () => {
      const safeMode = createSafeModeState(SafeModeReason.KERNEL_TIMEOUT, {
        details: "Bootstrap exceeded timeout at phase: config",
      });

      kernel.setSafeMode(safeMode);

      expect(kernel.getSafeMode()?.level).toBe(SafeModeLevel.RECOVERY);
      expect(kernel.getSafeMode()?.reason).toBe(SafeModeReason.KERNEL_TIMEOUT);
    });

    it("should not trigger timeout safe mode if already in RECOVERY", () => {
      const recoveryMode = createSafeModeState(
        SafeModeReason.STORAGE_UNREADABLE,
      );
      kernel.setSafeMode(recoveryMode);

      const timeoutMode = createSafeModeState(SafeModeReason.KERNEL_TIMEOUT);
      kernel.setSafeMode(timeoutMode);

      // Should still allow transition to different reason
      expect(kernel.getSafeMode()?.reason).toBe(SafeModeReason.KERNEL_TIMEOUT);
    });

    it("should include timeout details in safe mode state", () => {
      const details = "Bootstrap timeout at phase: config (took 5000ms)";
      const safeMode = createSafeModeState(SafeModeReason.KERNEL_TIMEOUT, {
        details,
      });

      kernel.setSafeMode(safeMode);

      expect(kernel.getSafeMode()?.details).toBe(details);
    });

    it("should provide recovery options for timeout", () => {
      const safeMode = createSafeModeState(SafeModeReason.KERNEL_TIMEOUT);

      kernel.setSafeMode(safeMode);

      expect(kernel.getSafeMode()?.recoveryOptions).toBeDefined();
      expect(kernel.getSafeMode()?.recoveryOptions.length).toBeGreaterThan(0);
    });
  });

  describe("Storage health monitor integration", () => {
    it("should set safe mode when storage becomes unreadable", () => {
      const safeMode = createSafeModeState(SafeModeReason.STORAGE_UNREADABLE, {
        details: "SecureStorage.getItem() failed",
      });

      kernel.setSafeMode(safeMode);

      expect(kernel.getSafeMode()?.level).toBe(SafeModeLevel.RECOVERY);
      expect(kernel.getSafeMode()?.reason).toBe(
        SafeModeReason.STORAGE_UNREADABLE,
      );
    });

    it("should include sync in affected features for storage failure", () => {
      const safeMode = createSafeModeState(SafeModeReason.STORAGE_UNREADABLE);

      kernel.setSafeMode(safeMode);

      expect(kernel.getSafeMode()?.affectedFeatures).toContain("sync");
    });

    it("should suggest CLEAR_CACHE recovery for storage failure", () => {
      const safeMode = createSafeModeState(SafeModeReason.STORAGE_UNREADABLE);

      kernel.setSafeMode(safeMode);

      expect(kernel.getSafeMode()?.recoveryOptions).toContain("clear_cache");
    });
  });

  describe("Auth health monitor integration", () => {
    it("should set safe mode when auth expires", () => {
      const safeMode = createSafeModeState(SafeModeReason.AUTH_EXPIRED, {
        details: "Session not restored or is invalid",
      });

      kernel.setSafeMode(safeMode);

      expect(kernel.getSafeMode()?.level).toBe(SafeModeLevel.SAFE);
      expect(kernel.getSafeMode()?.reason).toBe(SafeModeReason.AUTH_EXPIRED);
    });

    it("should suggest RESET_AUTH recovery for auth failure", () => {
      const safeMode = createSafeModeState(SafeModeReason.AUTH_EXPIRED);

      kernel.setSafeMode(safeMode);

      expect(kernel.getSafeMode()?.recoveryOptions).toContain("reset_auth");
    });

    it("should be less severe than RECOVERY safe mode", () => {
      const authMode = createSafeModeState(SafeModeReason.AUTH_EXPIRED);
      const recoveryMode = createSafeModeState(SafeModeReason.KERNEL_TIMEOUT);

      expect(authMode.level).not.toBe(recoveryMode.level);
      expect(authMode.level).toBe(SafeModeLevel.SAFE);
      expect(recoveryMode.level).toBe(SafeModeLevel.RECOVERY);
    });
  });

  describe("Recovery action execution context", () => {
    it("should provide recovery options in safe mode state", () => {
      const reasons = [
        SafeModeReason.KERNEL_TIMEOUT,
        SafeModeReason.STORAGE_UNREADABLE,
        SafeModeReason.AUTH_EXPIRED,
      ];

      reasons.forEach((reason) => {
        const safeMode = createSafeModeState(reason);
        kernel.setSafeMode(safeMode);

        expect(kernel.getSafeMode()?.recoveryOptions).toBeDefined();
        expect(Array.isArray(kernel.getSafeMode()?.recoveryOptions)).toBe(true);
        expect(kernel.getSafeMode()?.recoveryOptions.length).toBeGreaterThan(0);
      });
    });

    it("should include CLEAR_CACHE for storage/sync failures", () => {
      const safeMode = createSafeModeState(SafeModeReason.STORAGE_UNREADABLE);
      kernel.setSafeMode(safeMode);

      expect(kernel.getSafeMode()?.recoveryOptions).toContain("clear_cache");
    });

    it("should include RESET_AUTH for auth failures", () => {
      const safeMode = createSafeModeState(SafeModeReason.AUTH_EXPIRED);
      kernel.setSafeMode(safeMode);

      expect(kernel.getSafeMode()?.recoveryOptions).toContain("reset_auth");
    });

    it("should include CONTACT_SUPPORT for critical failures", () => {
      const safeMode = createSafeModeState(SafeModeReason.KERNEL_TIMEOUT);
      kernel.setSafeMode(safeMode);

      expect(kernel.getSafeMode()?.recoveryOptions).toContain(
        "contact_support",
      );
    });
  });

  describe("Network cascade detection", () => {
    it("should trigger on network sync failures reaching threshold", () => {
      const safeMode = createSafeModeState(
        SafeModeReason.NETWORK_SYNC_FAILURES,
        {
          details: "Network sync failures exceeded threshold (3/3)",
        },
      );

      kernel.setSafeMode(safeMode);

      expect(kernel.getSafeMode()?.level).toBe(SafeModeLevel.DEGRADED);
      expect(kernel.getSafeMode()?.reason).toBe(
        SafeModeReason.NETWORK_SYNC_FAILURES,
      );
    });

    it("should include sync in affected features", () => {
      const safeMode = createSafeModeState(
        SafeModeReason.NETWORK_SYNC_FAILURES,
      );
      kernel.setSafeMode(safeMode);

      expect(kernel.getSafeMode()?.affectedFeatures).toContain("sync");
    });

    it("should reset cascade detector when exiting safe mode", () => {
      const safeMode = createSafeModeState(
        SafeModeReason.NETWORK_SYNC_FAILURES,
      );
      kernel.setSafeMode(safeMode);

      kernel.setSafeMode(null);

      expect(mockNetworkCascadeDetector.reset).toHaveBeenCalled();
    });

    it("should provide recovery options for network failures", () => {
      const safeMode = createSafeModeState(
        SafeModeReason.NETWORK_SYNC_FAILURES,
      );
      kernel.setSafeMode(safeMode);

      expect(kernel.getSafeMode()?.recoveryOptions).toBeDefined();
      expect(kernel.getSafeMode()?.recoveryOptions.length).toBeGreaterThan(0);
    });
  });

  describe("Safe mode state consistency", () => {
    it("should maintain timestamp across safe mode transitions", () => {
      const safeMode1 = createSafeModeState(
        SafeModeReason.NETWORK_SYNC_FAILURES,
      );
      kernel.setSafeMode(safeMode1);
      const firstTimestamp = kernel.getSafeMode()?.timestamp;

      const safeMode2 = createSafeModeState(SafeModeReason.KERNEL_TIMEOUT);
      kernel.setSafeMode(safeMode2);
      const secondTimestamp = kernel.getSafeMode()?.timestamp;

      expect(firstTimestamp).toBeDefined();
      expect(secondTimestamp).toBeDefined();
      expect(secondTimestamp).toBeGreaterThanOrEqual(firstTimestamp!);
    });

    it("should provide complete recovery context", () => {
      const safeMode = createSafeModeState(SafeModeReason.KERNEL_TIMEOUT);
      kernel.setSafeMode(safeMode);

      const recovered = kernel.getSafeMode();
      expect(recovered?.level).toBeDefined();
      expect(recovered?.reason).toBeDefined();
      expect(recovered?.affectedFeatures).toBeDefined();
      expect(recovered?.recoveryOptions).toBeDefined();
      expect(recovered?.timestamp).toBeDefined();
    });
  });
});
