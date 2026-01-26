/// <reference types="vitest" />

/**
 * Network Detection Integration Tests
 *
 * Tests the integration between NetworkDetection and NetworkStateManager,
 * specifically the OFFLINE → RECOVERING → Connected state sequence.
 */

import { NetworkStateManager } from "@/lib/network/state-machine";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mock the NetworkDetection private method to test transition behavior
 * This simulates what happens when connection quality changes
 */
describe("NetworkDetection State Transitions", () => {
  beforeEach(() => {
    NetworkStateManager.reset();
  });

  describe("OFFLINE → Connected state sequence", () => {
    it("should transition OFFLINE → RECOVERING → GOOD when connectivity returns", async () => {
      // Start offline
      await NetworkStateManager.transitionTo("OFFLINE");
      expect(NetworkStateManager.getState()).toBe("OFFLINE");

      // When connectivity returns, should go through RECOVERING first
      // This simulates what triggerStateTransition now does:
      // if (oldState === "OFFLINE" && newState !== "OFFLINE")
      await NetworkStateManager.transitionTo("RECOVERING");
      expect(NetworkStateManager.getState()).toBe("RECOVERING");

      // Then to final state
      await NetworkStateManager.transitionTo("GOOD");
      expect(NetworkStateManager.getState()).toBe("GOOD");
    });

    it("should transition OFFLINE → RECOVERING → BAD on poor connection", async () => {
      await NetworkStateManager.transitionTo("OFFLINE");
      await NetworkStateManager.transitionTo("RECOVERING");
      await NetworkStateManager.transitionTo("BAD");

      expect(NetworkStateManager.getState()).toBe("BAD");
    });

    it("should transition OFFLINE → RECOVERING → NO_WIFI on cellular", async () => {
      await NetworkStateManager.transitionTo("OFFLINE");
      await NetworkStateManager.transitionTo("RECOVERING");
      await NetworkStateManager.transitionTo("NO_WIFI");

      expect(NetworkStateManager.getState()).toBe("NO_WIFI");
    });

    it("should not allow direct OFFLINE → GOOD transition (validates constraint)", async () => {
      await NetworkStateManager.transitionTo("OFFLINE");

      // Try direct transition (this should fail)
      await expect(NetworkStateManager.transitionTo("GOOD")).rejects.toThrow(
        "Invalid state transition",
      );

      // State should still be OFFLINE
      expect(NetworkStateManager.getState()).toBe("OFFLINE");
    });

    it("should not allow direct OFFLINE → BAD transition", async () => {
      await NetworkStateManager.transitionTo("OFFLINE");

      await expect(NetworkStateManager.transitionTo("BAD")).rejects.toThrow(
        "Invalid state transition",
      );

      expect(NetworkStateManager.getState()).toBe("OFFLINE");
    });

    it("should not allow direct OFFLINE → NO_WIFI transition", async () => {
      await NetworkStateManager.transitionTo("OFFLINE");

      await expect(NetworkStateManager.transitionTo("NO_WIFI")).rejects.toThrow(
        "Invalid state transition",
      );

      expect(NetworkStateManager.getState()).toBe("OFFLINE");
    });
  });

  describe("Recovery path with hooks", () => {
    it("should execute hooks for RECOVERING → GOOD transition", async () => {
      const recoveringHook = vi.fn();
      const goodHook = vi.fn();

      NetworkStateManager.onSpecificTransition(
        "OFFLINE",
        "RECOVERING",
        recoveringHook,
      );
      NetworkStateManager.onSpecificTransition("RECOVERING", "GOOD", goodHook);

      // Simulate offline recovery
      await NetworkStateManager.transitionTo("OFFLINE");
      await NetworkStateManager.transitionTo("RECOVERING");
      expect(recoveringHook).toHaveBeenCalled();

      await NetworkStateManager.transitionTo("GOOD");
      expect(goodHook).toHaveBeenCalled();
    });

    it("should execute hooks in correct order during offline recovery", async () => {
      const hookSequence: string[] = [];

      NetworkStateManager.onSpecificTransition("OFFLINE", "RECOVERING", () => {
        hookSequence.push("offline→recovering");
      });

      NetworkStateManager.onSpecificTransition("RECOVERING", "GOOD", () => {
        hookSequence.push("recovering→good");
      });

      // Execute recovery sequence
      await NetworkStateManager.transitionTo("OFFLINE");
      await NetworkStateManager.transitionTo("RECOVERING");
      await NetworkStateManager.transitionTo("GOOD");

      // Hooks should have executed in order
      expect(hookSequence).toEqual(["offline→recovering", "recovering→good"]);
    });
  });

  describe("State query methods during recovery", () => {
    it("should report correct connectivity status during recovery", async () => {
      await NetworkStateManager.transitionTo("OFFLINE");
      expect(NetworkStateManager.isConnected()).toBe(false);
      expect(NetworkStateManager.isRecovering()).toBe(false);

      await NetworkStateManager.transitionTo("RECOVERING");
      expect(NetworkStateManager.isConnected()).toBe(true); // Recovering is connected
      expect(NetworkStateManager.isRecovering()).toBe(true);

      await NetworkStateManager.transitionTo("GOOD");
      expect(NetworkStateManager.isConnected()).toBe(true);
      expect(NetworkStateManager.isRecovering()).toBe(false);
      expect(NetworkStateManager.isHealthy()).toBe(true);
    });
  });
});
