/**
 * Network State Machine
 *
 * Defines explicit state transitions for network connectivity states.
 * Prevents invalid state transitions and enables hooks for side effects.
 *
 * States:
 * - INITIALIZING: App startup, detecting initial network status
 * - GOOD: Excellent connection, all operations safe
 * - BAD: Poor connection (high latency/packet loss), degrade gracefully
 * - NO_WIFI: On cellular/hotspot, may be metered
 * - OFFLINE: No network connection at all
 * - RECOVERING: Attempting to reconnect from offline state
 */

import { logger } from "@/lib/utils/logger";

/**
 * Network connectivity states
 */
export type NetworkState =
  | "INITIALIZING" // Starting up, detecting initial network
  | "GOOD" // Excellent connection
  | "BAD" // Poor connection, high latency
  | "NO_WIFI" // On cellular/hotspot
  | "OFFLINE" // No connection
  | "RECOVERING"; // Attempting to reconnect

/**
 * Valid state transitions (directed graph)
 * Defines which states can transition to which other states
 */
export const VALID_TRANSITIONS: Record<NetworkState, NetworkState[]> = {
  INITIALIZING: ["GOOD", "BAD", "NO_WIFI", "OFFLINE"],
  GOOD: ["BAD", "NO_WIFI", "OFFLINE", "RECOVERING"],
  BAD: ["GOOD", "NO_WIFI", "OFFLINE", "RECOVERING"],
  NO_WIFI: ["GOOD", "BAD", "OFFLINE", "RECOVERING"],
  OFFLINE: ["INITIALIZING", "RECOVERING"],
  RECOVERING: ["GOOD", "BAD", "NO_WIFI", "OFFLINE"],
};

/**
 * Transition hook callback
 */
export type TransitionHook = (
  from: NetworkState,
  to: NetworkState,
) => Promise<void> | void;

/**
 * Specific transition hook (from → to)
 */
export type SpecificTransitionHook = () => Promise<void> | void;

/**
 * Network state machine
 * Manages state transitions with validation and hooks
 *
 * Transitions are serialized to prevent race conditions where concurrent calls
 * could validate against stale state or leave the machine in an unexpected state.
 */
class NetworkStateMachine {
  private currentState: NetworkState = "INITIALIZING";
  private transitionHooks: Map<string, Set<SpecificTransitionHook>> = new Map();
  private globalHooks: Set<TransitionHook> = new Set();
  private recoveryRetries = 0;
  private maxRecoveryRetries = 5;
  private recoveryBackoffMs = 1000; // Start at 1s, exponential backoff
  private transitionQueue: Promise<void> = Promise.resolve(); // Serialize transitions

  /**
   * Get current network state
   */
  getState(): NetworkState {
    return this.currentState;
  }

  /**
   * Check if transition is valid
   */
  isValidTransition(from: NetworkState, to: NetworkState): boolean {
    // eslint-disable-next-line security/detect-object-injection
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
  }

  /**
   * Transition to a new state
   * Validates transition, executes hooks, and updates state
   *
   * Transitions are serialized internally to prevent race conditions.
   * If multiple transitionTo() calls are made concurrently, they will
   * be applied in call order, each validating against the actual current state.
   *
   * @param toState - Target state
   * @param reason - Optional reason for transition (for logging)
   * @throws Error if transition is invalid
   */
  async transitionTo(toState: NetworkState, reason?: string): Promise<void> {
    // Chain this transition onto the queue to serialize it
    this.transitionQueue = this.transitionQueue.then(
      () => this.performTransition(toState, reason),
      () => this.performTransition(toState, reason), // Even if previous failed, try this one
    );
    return this.transitionQueue;
  }

  /**
   * Perform the actual state transition (serialized via transitionQueue)
   */
  private async performTransition(
    toState: NetworkState,
    reason?: string,
  ): Promise<void> {
    const fromState = this.currentState;

    // Validate transition (against current state, not stale state)
    if (!this.isValidTransition(fromState, toState)) {
      const error = `Invalid state transition: ${fromState} → ${toState}`;
      logger.warn("network", error);
      throw new Error(error);
    }

    logger.info(
      "network",
      `State transition: ${fromState} → ${toState}${reason ? ` (${reason})` : ""}`,
    );

    // Execute global hooks first
    for (const hook of this.globalHooks) {
      try {
        await hook(fromState, toState);
      } catch (error) {
        logger.error(
          "network",
          `Global hook failed during ${fromState} → ${toState}: ${error}`,
        );
      }
    }

    // Execute specific transition hooks
    const hookKey = `${fromState}→${toState}`;
    const hooks = this.transitionHooks.get(hookKey);
    if (hooks) {
      for (const hook of hooks) {
        try {
          await hook();
        } catch (error) {
          logger.error(
            "network",
            `Transition hook failed during ${hookKey}: ${error}`,
          );
        }
      }
    }

    // Update state
    this.currentState = toState;

    // Reset recovery retries on successful transitions
    if (toState === "GOOD" || toState === "BAD" || toState === "NO_WIFI") {
      this.recoveryRetries = 0;
      this.recoveryBackoffMs = 1000; // Reset backoff
    }

    // Track recovery attempts
    if (toState === "RECOVERING") {
      this.recoveryRetries++;
      if (this.recoveryRetries > this.maxRecoveryRetries) {
        logger.warn(
          "network",
          `Max recovery retries (${this.maxRecoveryRetries}) exceeded`,
        );
      }
    }
  }

  /**
   * Register a hook for all transitions
   * Called on every state transition
   */
  onTransition(hook: TransitionHook): () => void {
    this.globalHooks.add(hook);

    // Return unsubscribe function
    return () => {
      this.globalHooks.delete(hook);
    };
  }

  /**
   * Register a hook for a specific transition
   * Called only when transitioning from → to
   */
  onSpecificTransition(
    from: NetworkState,
    to: NetworkState,
    hook: SpecificTransitionHook,
  ): () => void {
    const hookKey = `${from}→${to}`;

    if (!this.transitionHooks.has(hookKey)) {
      this.transitionHooks.set(hookKey, new Set());
    }

    this.transitionHooks.get(hookKey)!.add(hook);

    // Return unsubscribe function
    return () => {
      this.transitionHooks.get(hookKey)?.delete(hook);
    };
  }

  /**
   * Get recovery backoff time (exponential backoff for retries)
   * Used to space out reconnection attempts
   */
  getRecoveryBackoff(): number {
    if (this.recoveryRetries <= 0) {
      return this.recoveryBackoffMs; // 1s
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, then cap at 30s
    const backoff = Math.min(
      this.recoveryBackoffMs * Math.pow(2, this.recoveryRetries - 1),
      30000,
    );
    return backoff;
  }

  /**
   * Get current recovery retry count
   */
  getRecoveryRetries(): number {
    return this.recoveryRetries;
  }

  /**
   * Check if currently in RECOVERING state
   */
  isRecovering(): boolean {
    return this.currentState === "RECOVERING";
  }

  /**
   * Check if currently OFFLINE
   */
  isOffline(): boolean {
    return this.currentState === "OFFLINE";
  }

  /**
   * Check if network is healthy (GOOD or NO_WIFI)
   * Use for operations that don't require excellent connection
   */
  isHealthy(): boolean {
    return this.currentState === "GOOD" || this.currentState === "NO_WIFI";
  }

  /**
   * Check if network is connected (any state except OFFLINE)
   * Use for checks like "can we attempt a request?"
   */
  isConnected(): boolean {
    return this.currentState !== "OFFLINE";
  }

  /**
   * Check if network can perform heavy operations (GOOD state only)
   * Use for bandwidth-intensive operations (uploads, HD images, streaming)
   */
  canPerformHeavyOps(): boolean {
    return this.currentState === "GOOD";
  }

  /**
   * Reset state machine (for testing)
   */
  reset(): void {
    this.currentState = "INITIALIZING";
    this.transitionHooks.clear();
    this.globalHooks.clear();
    this.recoveryRetries = 0;
    this.recoveryBackoffMs = 1000;
    this.transitionQueue = Promise.resolve(); // Reset transition queue
  }
}

/**
 * Singleton instance
 */
export const NetworkStateManager = new NetworkStateMachine();
