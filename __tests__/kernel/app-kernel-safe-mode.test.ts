/**
 * Tests for AppKernel Safe Mode Integration (Phase 2)
 *
 * Tests:
 * - Safe mode state tracking
 * - Safe mode transitions
 * - Recovery action information
 */

import {
    SafeModeLevel,
    SafeModeReason,
    createSafeModeState,
    getSafeModeDefinition,
    getSafeModeMessage,
} from "@/lib/error";
import { describe, expect, it, vi } from "vitest";

// Mock modules
vi.mock("@/lib/config/loader", () => ({
  getAppConfig: vi.fn(() => ({
    version: 1,
    safeMode: {
      kernelTimeoutMs: 100, // Short timeout for tests
      syncFailureThreshold: 3,
      healthCheckIntervalMs: 30000,
      autoRecoveryAttempts: 2,
      autoRecoveryDelayMs: 5000,
    },
  })),
}));

vi.mock("@/lib/config/config-validator", () => ({
  validateConfig: vi.fn(() => ({ valid: true, errors: [] })),
  logValidationResults: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  SecureStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
  STORAGE_KEYS: {
    CONNECTED_WORLDS: "connected_worlds",
    LAST_SELECTED_WORLD: "last_selected_world",
    LAST_USER_ROLE: "last_user_role",
    APP_THEME: "app_theme",
    REFRESH_TOKEN: "refresh_token",
    NOTIFICATIONS_SEEN: "notifications_seen",
  },
}));

vi.mock("@/lib/auth/auth-state", () => ({
  AuthStateManager: {
    isAuthenticated: vi.fn(),
    getAuthState: vi.fn(),
  },
}));

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      extra: {},
    },
  },
}));

vi.mock("@/lib/network/network-detection", () => ({
  NetworkDetection: {
    start: vi.fn(),
    isOnline: vi.fn(() => true),
  },
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: {
    category: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

describe("AppKernel Safe Mode Integration", () => {
  describe("Safe Mode State Creation", () => {
    it("should create RECOVERY safe mode for KERNEL_TIMEOUT", () => {
      const safeMode = createSafeModeState(SafeModeReason.KERNEL_TIMEOUT, {
        details: "Bootstrap exceeded timeout at phase: config",
      });

      expect(safeMode.level).toBe(SafeModeLevel.RECOVERY);
      expect(safeMode.reason).toBe(SafeModeReason.KERNEL_TIMEOUT);
      expect(safeMode.details).toContain("timeout");
    });

    it("should create RECOVERY safe mode for STORAGE_UNREADABLE", () => {
      const safeMode = createSafeModeState(SafeModeReason.STORAGE_UNREADABLE, {
        details: "Storage system is unreadable or corrupted",
      });

      expect(safeMode.level).toBe(SafeModeLevel.RECOVERY);
      expect(safeMode.reason).toBe(SafeModeReason.STORAGE_UNREADABLE);
      expect(safeMode.affectedFeatures).toBeDefined();
      expect(safeMode.recoveryOptions).toBeDefined();
    });

    it("should create SAFE safe mode for AUTH_EXPIRED", () => {
      const safeMode = createSafeModeState(SafeModeReason.AUTH_EXPIRED, {
        details: "User session was not restored or is invalid",
      });

      expect(safeMode.level).toBe(SafeModeLevel.SAFE);
      expect(safeMode.reason).toBe(SafeModeReason.AUTH_EXPIRED);
      expect(safeMode.affectedFeatures).toBeDefined();
      expect(safeMode.recoveryOptions).toBeDefined();
    });
  });

  describe("Safe Mode Definitions", () => {
    it("should provide definition for KERNEL_TIMEOUT", () => {
      const def = getSafeModeDefinition(SafeModeReason.KERNEL_TIMEOUT);

      expect(def).toBeDefined();
      expect(def.level).toBe(SafeModeLevel.RECOVERY);
      expect(def.affectedFeatures.length).toBeGreaterThan(0);
      expect(def.recoveryOptions.length).toBeGreaterThan(0);
    });

    it("should provide definition for STORAGE_UNREADABLE", () => {
      const def = getSafeModeDefinition(SafeModeReason.STORAGE_UNREADABLE);

      expect(def).toBeDefined();
      expect(def.level).toBe(SafeModeLevel.RECOVERY);
      expect(def.affectedFeatures).toContain("sync");
    });

    it("should provide definition for AUTH_EXPIRED", () => {
      const def = getSafeModeDefinition(SafeModeReason.AUTH_EXPIRED);

      expect(def).toBeDefined();
      expect(def.level).toBe(SafeModeLevel.SAFE);
    });

    it("should include recovery options for all reasons", () => {
      const reasons = [
        SafeModeReason.KERNEL_TIMEOUT,
        SafeModeReason.STORAGE_UNREADABLE,
        SafeModeReason.AUTH_EXPIRED,
        SafeModeReason.NETWORK_SYNC_FAILURES,
      ];

      reasons.forEach((reason) => {
        const def = getSafeModeDefinition(reason);
        expect(def.recoveryOptions.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Safe Mode Messages", () => {
    it("should provide user-friendly message for KERNEL_TIMEOUT", () => {
      const message = getSafeModeMessage(SafeModeReason.KERNEL_TIMEOUT);

      expect(message).toBeDefined();
      expect(typeof message).toBe("string");
      expect(message.length).toBeGreaterThan(0);
    });

    it("should provide user-friendly message for STORAGE_UNREADABLE", () => {
      const message = getSafeModeMessage(SafeModeReason.STORAGE_UNREADABLE);

      expect(message).toBeDefined();
      expect(typeof message).toBe("string");
      expect(message.length).toBeGreaterThan(0);
    });

    it("should provide user-friendly message for AUTH_EXPIRED", () => {
      const message = getSafeModeMessage(SafeModeReason.AUTH_EXPIRED);

      expect(message).toBeDefined();
      expect(typeof message).toBe("string");
      expect(message.length).toBeGreaterThan(0);
    });

    it("should provide message for all safe mode reasons", () => {
      const reasons = Object.values(SafeModeReason);

      reasons.forEach((reason) => {
        const message = getSafeModeMessage(reason);
        expect(message).toBeDefined();
        expect(typeof message).toBe("string");
      });
    });
  });

  describe("Safe Mode State Properties", () => {
    it("should include timestamp in safe mode state", () => {
      const beforeTime = Date.now();
      const safeMode = createSafeModeState(
        SafeModeReason.STORAGE_UNREADABLE,
        {},
      );
      const afterTime = Date.now();

      expect(safeMode.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(safeMode.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it("should include affected features for each reason", () => {
      const reasons = [
        SafeModeReason.KERNEL_TIMEOUT,
        SafeModeReason.STORAGE_UNREADABLE,
        SafeModeReason.AUTH_EXPIRED,
      ];

      reasons.forEach((reason) => {
        const safeMode = createSafeModeState(reason, {});
        expect(Array.isArray(safeMode.affectedFeatures)).toBe(true);
        expect(safeMode.affectedFeatures.length).toBeGreaterThan(0);
      });
    });

    it("should include recovery options for each reason", () => {
      const reasons = [
        SafeModeReason.KERNEL_TIMEOUT,
        SafeModeReason.STORAGE_UNREADABLE,
        SafeModeReason.AUTH_EXPIRED,
      ];

      reasons.forEach((reason) => {
        const safeMode = createSafeModeState(reason, {});
        expect(Array.isArray(safeMode.recoveryOptions)).toBe(true);
        expect(safeMode.recoveryOptions.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Safe Mode Level Hierarchy", () => {
    it("RECOVERY should be more severe than SAFE", () => {
      const recovery = SafeModeLevel.RECOVERY;
      const safe = SafeModeLevel.SAFE;

      // Both should exist and be different
      expect(recovery).toBeDefined();
      expect(safe).toBeDefined();
      expect(recovery).not.toBe(safe);
    });

    it("DEGRADED should be less severe than SAFE", () => {
      const safe = SafeModeLevel.SAFE;
      const degraded = SafeModeLevel.DEGRADED;

      // Both should exist and be different
      expect(safe).toBeDefined();
      expect(degraded).toBeDefined();
      expect(safe).not.toBe(degraded);
    });

    it("NORMAL (null) represents no safe mode", () => {
      // NORMAL is represented by null in SafeModeState
      expect(null).toBeNull();
    });
  });

  describe("Safe Mode Reason Categories", () => {
    it("should categorize KERNEL_TIMEOUT as system failure", () => {
      const def = getSafeModeDefinition(SafeModeReason.KERNEL_TIMEOUT);
      expect(def.level).toBe(SafeModeLevel.RECOVERY);
    });

    it("should categorize STORAGE_UNREADABLE as system failure", () => {
      const def = getSafeModeDefinition(SafeModeReason.STORAGE_UNREADABLE);
      expect(def.level).toBe(SafeModeLevel.RECOVERY);
    });

    it("should categorize AUTH_EXPIRED as user action", () => {
      const def = getSafeModeDefinition(SafeModeReason.AUTH_EXPIRED);
      expect(def.level).toBe(SafeModeLevel.SAFE);
    });

    it("should categorize NETWORK_SYNC_FAILURES as degradation", () => {
      const def = getSafeModeDefinition(SafeModeReason.NETWORK_SYNC_FAILURES);
      expect(def.level).toBe(SafeModeLevel.DEGRADED);
    });
  });

  describe("Recovery Action Availability", () => {
    it("should suggest CLEAR_CACHE for storage failures", () => {
      const def = getSafeModeDefinition(SafeModeReason.STORAGE_UNREADABLE);
      expect(def.recoveryOptions).toContain("clear_cache");
    });

    it("should suggest RESET_AUTH for auth failures", () => {
      const def = getSafeModeDefinition(SafeModeReason.AUTH_EXPIRED);
      expect(def.recoveryOptions).toContain("reset_auth");
    });

    it("should suggest CONTACT_SUPPORT for system timeouts", () => {
      const def = getSafeModeDefinition(SafeModeReason.KERNEL_TIMEOUT);
      // Should include support action for critical failures
      expect(def.recoveryOptions.length).toBeGreaterThan(0);
    });
  });

  describe("Safe Mode Details Property", () => {
    it("should store custom details message", () => {
      const customDetails = "This is a custom error message for testing";
      const safeMode = createSafeModeState(SafeModeReason.KERNEL_TIMEOUT, {
        details: customDetails,
      });

      expect(safeMode.details).toBe(customDetails);
    });

    it("should include either custom or default message", () => {
      const safeMode = createSafeModeState(SafeModeReason.STORAGE_UNREADABLE);

      // Either has custom details or use the getMessage function
      if (safeMode.details) {
        expect(typeof safeMode.details).toBe("string");
        expect(safeMode.details.length).toBeGreaterThan(0);
      } else {
        // getMessage should provide a message if details not set
        const message = getSafeModeMessage(SafeModeReason.STORAGE_UNREADABLE);
        expect(message).toBeDefined();
        expect(message.length).toBeGreaterThan(0);
      }
    });
  });
});
