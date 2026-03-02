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
} from "@/system/Network/state-machine";
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

    it("should allow CELLULAR → OFFLINE", async () => {
      await NetworkStateManager.transitionTo("CELLULAR");
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

    it("should allow CELLULAR → GOOD (switching from cellular to WiFi)", async () => {
      await NetworkStateManager.transitionTo("CELLULAR");
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

      await NetworkStateManager.transitionTo("CELLULAR");
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

    it("should report healthy state (GOOD or CELLULAR)", async () => {
      expect(NetworkStateManager.isHealthy()).toBe(false); // INITIALIZING

      await NetworkStateManager.transitionTo("GOOD");
      expect(NetworkStateManager.isHealthy()).toBe(true);

      await NetworkStateManager.transitionTo("CELLULAR");
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

      await NetworkStateManager.transitionTo("CELLULAR");
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

      await NetworkStateManager.transitionTo("CELLULAR");
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

  describe("Concurrency & Serialization", () => {
    it("should serialize concurrent transitions", async () => {
      // Fire multiple transitions without awaiting
      // They should be serialized internally
      const promise1 = NetworkStateManager.transitionTo("OFFLINE");
      const promise2 = NetworkStateManager.transitionTo("RECOVERING");
      const promise3 = NetworkStateManager.transitionTo("GOOD");

      // Wait for all to complete
      await Promise.all([promise1, promise2, promise3]);

      // Final state should be GOOD (last transition applied)
      expect(NetworkStateManager.getState()).toBe("GOOD");
    });

    it("should validate each transition against current state (not stale state)", async () => {
      // Start at INITIALIZING
      // Call 1: INITIALIZING → OFFLINE (valid)
      // Call 2: INITIALIZING → GOOD (valid, but will actually happen after Call 1)
      const call1 = NetworkStateManager.transitionTo("OFFLINE");
      const call2 = NetworkStateManager.transitionTo("RECOVERING");

      // Both should succeed
      await Promise.all([call1, call2]);

      // Final state: OFFLINE → RECOVERING
      expect(NetworkStateManager.getState()).toBe("RECOVERING");
    });

    it("should handle invalid concurrent transitions gracefully", async () => {
      // Set up state: GOOD
      await NetworkStateManager.transitionTo("GOOD");

      // Try two invalid transitions concurrently
      // GOOD → INITIALIZING is invalid
      const promise1 = NetworkStateManager.transitionTo("INITIALIZING").catch(
        () => "rejected",
      );
      const promise2 = NetworkStateManager.transitionTo("BAD");

      const result1 = await promise1;
      await promise2;

      // First should reject, second should succeed
      expect(result1).toBe("rejected");
      expect(NetworkStateManager.getState()).toBe("BAD");
    });

    it("should execute hooks in order for serialized transitions", async () => {
      const sequence: string[] = [];

      NetworkStateManager.onSpecificTransition(
        "INITIALIZING",
        "OFFLINE",
        () => {
          sequence.push("INIT→OFF");
        },
      );

      NetworkStateManager.onSpecificTransition("OFFLINE", "RECOVERING", () => {
        sequence.push("OFF→REC");
      });

      NetworkStateManager.onSpecificTransition("RECOVERING", "GOOD", () => {
        sequence.push("REC→GOOD");
      });

      // Fire all at once (they'll be serialized)
      const p1 = NetworkStateManager.transitionTo("OFFLINE");
      const p2 = NetworkStateManager.transitionTo("RECOVERING");
      const p3 = NetworkStateManager.transitionTo("GOOD");

      await Promise.all([p1, p2, p3]);

      // Hooks should have executed in order
      expect(sequence).toEqual(["INIT→OFF", "OFF→REC", "REC→GOOD"]);
      expect(NetworkStateManager.getState()).toBe("GOOD");
    });
  });
});
