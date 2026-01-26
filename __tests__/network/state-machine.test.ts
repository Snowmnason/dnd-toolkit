/// <reference types="vitest" />

/**
 * Network State Machine Tests
 *
 * Tests for:
 * - Valid state transitions
 * - Invalid transition rejection
 * - Transition hooks execution
 * - Recovery backoff logic
 * - State machine reset for testing
 */

import {
  NetworkStateManager,
  VALID_TRANSITIONS,
  type NetworkState,
} from "@/lib/network/state-machine";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("NetworkStateManager", () => {
  beforeEach(() => {
    NetworkStateManager.reset();
  });

  describe("Valid Transitions", () => {
    it("should allow INITIALIZING → GOOD", async () => {
      await NetworkStateManager.transitionTo("GOOD");
      expect(NetworkStateManager.getState()).toBe("GOOD");
    });

    it("should allow INITIALIZING → OFFLINE", async () => {
      await NetworkStateManager.transitionTo("OFFLINE");
      expect(NetworkStateManager.getState()).toBe("OFFLINE");
    });

    it("should allow GOOD → BAD", async () => {
      await NetworkStateManager.transitionTo("GOOD");
      await NetworkStateManager.transitionTo("BAD");
      expect(NetworkStateManager.getState()).toBe("BAD");
    });

    it("should allow OFFLINE → RECOVERING", async () => {
      await NetworkStateManager.transitionTo("OFFLINE");
      await NetworkStateManager.transitionTo("RECOVERING");
      expect(NetworkStateManager.getState()).toBe("RECOVERING");
    });

    it("should allow RECOVERING → GOOD", async () => {
      await NetworkStateManager.transitionTo("OFFLINE");
      await NetworkStateManager.transitionTo("RECOVERING");
      await NetworkStateManager.transitionTo("GOOD");
      expect(NetworkStateManager.getState()).toBe("GOOD");
    });

    it("should allow NO_WIFI → OFFLINE", async () => {
      await NetworkStateManager.transitionTo("NO_WIFI");
      await NetworkStateManager.transitionTo("OFFLINE");
      expect(NetworkStateManager.getState()).toBe("OFFLINE");
    });
  });

  describe("Invalid Transitions", () => {
    it("should reject GOOD → INITIALIZING", async () => {
      await NetworkStateManager.transitionTo("GOOD");
      await expect(
        NetworkStateManager.transitionTo("INITIALIZING"),
      ).rejects.toThrow();
    });

    it("should reject OFFLINE → GOOD (must go through RECOVERING)", async () => {
      await NetworkStateManager.transitionTo("OFFLINE");
      await expect(NetworkStateManager.transitionTo("GOOD")).rejects.toThrow();
    });

    it("should reject BAD → INITIALIZING", async () => {
      await NetworkStateManager.transitionTo("BAD");
      await expect(
        NetworkStateManager.transitionTo("INITIALIZING"),
      ).rejects.toThrow();
    });

    it("should allow NO_WIFI → GOOD (switching from cellular to WiFi)", async () => {
      await NetworkStateManager.transitionTo("NO_WIFI");
      await NetworkStateManager.transitionTo("GOOD");
      expect(NetworkStateManager.getState()).toBe("GOOD");
    });
  });

  describe("Transition Hooks", () => {
    it("should execute specific transition hook", async () => {
      const hookFn = vi.fn();
      await NetworkStateManager.transitionTo("GOOD");
      NetworkStateManager.onSpecificTransition("GOOD", "BAD", hookFn);

      await NetworkStateManager.transitionTo("BAD");
      expect(hookFn).toHaveBeenCalled();
    });

    it("should not execute hook for non-matching transition", async () => {
      const hookFn = vi.fn();
      await NetworkStateManager.transitionTo("GOOD");
      NetworkStateManager.onSpecificTransition("GOOD", "BAD", hookFn);

      await NetworkStateManager.transitionTo("NO_WIFI");
      expect(hookFn).not.toHaveBeenCalled();
    });

    it("should handle async hooks", async () => {
      const hookFn = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
      await NetworkStateManager.transitionTo("GOOD");
      NetworkStateManager.onSpecificTransition("GOOD", "BAD", hookFn);

      await NetworkStateManager.transitionTo("BAD");
      expect(hookFn).toHaveBeenCalled();
    });

    it("should execute global hooks on any transition", async () => {
      const hookFn = vi.fn();
      NetworkStateManager.onTransition(hookFn);

      await NetworkStateManager.transitionTo("GOOD");
      expect(hookFn).toHaveBeenCalledWith("INITIALIZING", "GOOD");

      await NetworkStateManager.transitionTo("BAD");
      expect(hookFn).toHaveBeenCalledWith("GOOD", "BAD");
      expect(hookFn).toHaveBeenCalledTimes(2);
    });

    it("should support unsubscribe from hooks", async () => {
      const hookFn = vi.fn();
      await NetworkStateManager.transitionTo("GOOD");

      const unsubscribe = NetworkStateManager.onSpecificTransition(
        "GOOD",
        "BAD",
        hookFn,
      );
      unsubscribe();

      await NetworkStateManager.transitionTo("BAD");
      expect(hookFn).not.toHaveBeenCalled();
    });
  });

  describe("Recovery Backoff", () => {
    it("should provide backoff time for recovery", () => {
      const backoff = NetworkStateManager.getRecoveryBackoff();
      expect(backoff).toBeGreaterThan(0);
      expect(backoff).toBeLessThanOrEqual(30000);
    });

    it("should implement exponential backoff on retries", async () => {
      await NetworkStateManager.transitionTo("OFFLINE");
      await NetworkStateManager.transitionTo("RECOVERING");

      const firstBackoff = NetworkStateManager.getRecoveryBackoff();
      expect(firstBackoff).toBe(1000); // 1s initial

      // Simulate failed recovery
      await NetworkStateManager.transitionTo("OFFLINE");
      await NetworkStateManager.transitionTo("RECOVERING");

      const secondBackoff = NetworkStateManager.getRecoveryBackoff();
      expect(secondBackoff).toBeGreaterThan(firstBackoff);
    });

    it("should cap backoff at 30 seconds", async () => {
      // Simulate many failed recoveries
      for (let i = 0; i < 10; i++) {
        await NetworkStateManager.transitionTo("OFFLINE");
        await NetworkStateManager.transitionTo("RECOVERING");
      }

      const backoff = NetworkStateManager.getRecoveryBackoff();
      expect(backoff).toBeLessThanOrEqual(30000);
    });

    it("should reset backoff on successful recovery", async () => {
      await NetworkStateManager.transitionTo("OFFLINE");
      await NetworkStateManager.transitionTo("RECOVERING");

      // Simulate successful recovery
      await NetworkStateManager.transitionTo("GOOD");
      const afterReset = NetworkStateManager.getRecoveryRetries();

      expect(afterReset).toBe(0);
    });
  });

  describe("State Queries", () => {
    it("should report recovering state", async () => {
      await NetworkStateManager.transitionTo("OFFLINE");
      expect(NetworkStateManager.isRecovering()).toBe(false);

      await NetworkStateManager.transitionTo("RECOVERING");
      expect(NetworkStateManager.isRecovering()).toBe(true);
    });

    it("should report offline state", async () => {
      expect(NetworkStateManager.isOffline()).toBe(false);

      await NetworkStateManager.transitionTo("OFFLINE");
      expect(NetworkStateManager.isOffline()).toBe(true);
    });

    it("should return current state", async () => {
      expect(NetworkStateManager.getState()).toBe("INITIALIZING");

      await NetworkStateManager.transitionTo("GOOD");
      expect(NetworkStateManager.getState()).toBe("GOOD");

      await NetworkStateManager.transitionTo("OFFLINE");
      expect(NetworkStateManager.getState()).toBe("OFFLINE");
    });

    it("should report healthy state (GOOD or NO_WIFI)", async () => {
      expect(NetworkStateManager.isHealthy()).toBe(false); // INITIALIZING

      await NetworkStateManager.transitionTo("GOOD");
      expect(NetworkStateManager.isHealthy()).toBe(true);

      await NetworkStateManager.transitionTo("NO_WIFI");
      expect(NetworkStateManager.isHealthy()).toBe(true);

      await NetworkStateManager.transitionTo("BAD");
      expect(NetworkStateManager.isHealthy()).toBe(false);

      await NetworkStateManager.transitionTo("OFFLINE");
      expect(NetworkStateManager.isHealthy()).toBe(false);
    });

    it("should report connected state (anything except OFFLINE)", async () => {
      expect(NetworkStateManager.isConnected()).toBe(true); // INITIALIZING

      await NetworkStateManager.transitionTo("GOOD");
      expect(NetworkStateManager.isConnected()).toBe(true);

      await NetworkStateManager.transitionTo("BAD");
      expect(NetworkStateManager.isConnected()).toBe(true);

      await NetworkStateManager.transitionTo("NO_WIFI");
      expect(NetworkStateManager.isConnected()).toBe(true);

      await NetworkStateManager.transitionTo("OFFLINE");
      expect(NetworkStateManager.isConnected()).toBe(false);

      await NetworkStateManager.transitionTo("RECOVERING");
      expect(NetworkStateManager.isConnected()).toBe(true);
    });

    it("should report can perform heavy ops (GOOD state only)", async () => {
      expect(NetworkStateManager.canPerformHeavyOps()).toBe(false);

      await NetworkStateManager.transitionTo("GOOD");
      expect(NetworkStateManager.canPerformHeavyOps()).toBe(true);

      await NetworkStateManager.transitionTo("NO_WIFI");
      expect(NetworkStateManager.canPerformHeavyOps()).toBe(false);

      await NetworkStateManager.transitionTo("BAD");
      expect(NetworkStateManager.canPerformHeavyOps()).toBe(false);

      await NetworkStateManager.transitionTo("OFFLINE");
      expect(NetworkStateManager.canPerformHeavyOps()).toBe(false);
    });
  });

  describe("Transition Validation", () => {
    it("should validate transitions before executing", () => {
      const isValid = NetworkStateManager.isValidTransition("GOOD", "BAD");
      expect(isValid).toBe(true);

      const isInvalid = NetworkStateManager.isValidTransition(
        "GOOD",
        "INITIALIZING",
      );
      expect(isInvalid).toBe(false);
    });

    it("should match VALID_TRANSITIONS map", () => {
      Object.entries(VALID_TRANSITIONS).forEach(([fromState, toStates]) => {
        toStates.forEach((toState) => {
          const isValid = NetworkStateManager.isValidTransition(
            fromState as NetworkState,
            toState,
          );
          expect(isValid).toBe(true);
        });
      });
    });
  });

  describe("Complex Scenarios", () => {
    it("should handle offline → recovering → offline cycle", async () => {
      await NetworkStateManager.transitionTo("OFFLINE");
      expect(NetworkStateManager.isOffline()).toBe(true);

      await NetworkStateManager.transitionTo("RECOVERING");
      expect(NetworkStateManager.isRecovering()).toBe(true);

      // Failed recovery
      await NetworkStateManager.transitionTo("OFFLINE");
      expect(NetworkStateManager.isOffline()).toBe(true);
      expect(NetworkStateManager.getRecoveryRetries()).toBe(1);
    });

    it("should track multiple recovery attempts", async () => {
      for (let i = 0; i < 3; i++) {
        await NetworkStateManager.transitionTo("OFFLINE");
        await NetworkStateManager.transitionTo("RECOVERING");
        expect(NetworkStateManager.getRecoveryRetries()).toBe(i + 1);
      }
    });

    it("should execute OFFLINE → RECOVERING → GOOD with hooks", async () => {
      const recoveringHook = vi.fn();
      const goodHook = vi.fn();

      NetworkStateManager.onSpecificTransition(
        "OFFLINE",
        "RECOVERING",
        recoveringHook,
      );
      NetworkStateManager.onSpecificTransition("RECOVERING", "GOOD", goodHook);

      await NetworkStateManager.transitionTo("OFFLINE");
      await NetworkStateManager.transitionTo("RECOVERING");
      expect(recoveringHook).toHaveBeenCalled();

      await NetworkStateManager.transitionTo("GOOD");
      expect(goodHook).toHaveBeenCalled();
    });
  });

  describe("Reset for Testing", () => {
    it("should reset state to INITIALIZING", async () => {
      await NetworkStateManager.transitionTo("GOOD");
      NetworkStateManager.reset();
      expect(NetworkStateManager.getState()).toBe("INITIALIZING");
    });

    it("should clear all hooks on reset", async () => {
      const hookFn = vi.fn();
      NetworkStateManager.onTransition(hookFn);

      NetworkStateManager.reset();
      await NetworkStateManager.transitionTo("GOOD");
      expect(hookFn).not.toHaveBeenCalled();
    });

    it("should reset recovery retries", async () => {
      await NetworkStateManager.transitionTo("OFFLINE");
      await NetworkStateManager.transitionTo("RECOVERING");
      expect(NetworkStateManager.getRecoveryRetries()).toBe(1);

      NetworkStateManager.reset();
      expect(NetworkStateManager.getRecoveryRetries()).toBe(0);
    });
  });
});
