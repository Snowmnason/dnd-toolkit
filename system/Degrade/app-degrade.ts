/**
 * Degradation Manager
 * 
 * Central registry for tracking app capability degradation across multiple sources.
 * Supports reference counting: capability is available only when NO sources report it as degraded.
 * 
 * Multiple sources can report on the same capability, and ANY degraded source disables it.
 * Example: SYNC capability can be degraded by sync-manager OR offline system;
 * SYNC is only available when ALL sources report it as available.
 */

import { DegradeCapability, DegradeCapabilityState, DegradeResponseHandler, DegradeState, DegradeSubscriber } from '@/type-definitions/degrade';

/**
 * Central degradation manager singleton
 */
export class DegradeManager {
  private sourceStates: Map<string, Map<DegradeCapability | string, DegradeCapabilityState>> = new Map();
  private subscribers: Set<DegradeSubscriber> = new Set();
  private lastNotificationTime = 0;
  private notificationDebounceMs = 0; // No debounce for now, can be added later
  private handlerCleanups: Map<string, () => void> = new Map();

  /**
   * System-level response handlers — centralized registry.
   * Each capability maps to ONE handler that runs automatically when its state changes.
   * Handlers are registered once during bootstrap and execute on every state transition.
   *
   * These are SYSTEM-LEVEL responses: stop processes, capture mutations, pause queues.
   * For lib/UI-level responses, see lib/error/degrade/degrade-manager.ts.
   */
  private systemResponses: Map<DegradeCapability, DegradeResponseHandler> = new Map();

  /** Track previous capability values to detect transitions (avoid re-firing on same state) */
  private previousCapabilityValues: Map<DegradeCapability, boolean> = new Map();

  /**
   * Update degradation state for a capability from a specific source
   * 
   * @param capability Capability being updated (can use enum or string literal)
   * @param value Is capability available (true) or degraded (false)
   * @param options Source tracking metadata
   */
  set(
    capability: DegradeCapability | string,
    value: boolean,
    options: { source: string; reason: string },
  ): void {
    // Ensure source entry exists
    if (!this.sourceStates.has(options.source)) {
      this.sourceStates.set(options.source, new Map());
    }

    const sourceCapabilities = this.sourceStates.get(options.source)!;
    const now = Date.now();

    // Update capability state for this source
    sourceCapabilities.set(capability, {
      value,
      reason: options.reason,
      source: options.source,
      updatedAt: now,
    });

    // Check if aggregate capability value actually changed — fire system response if so
    if (typeof capability === 'string' && Object.values(DegradeCapability).includes(capability as DegradeCapability)) {
      const enumCap = capability as DegradeCapability;
      const currentValue = this.isCapable(enumCap);
      const previousValue = this.previousCapabilityValues.get(enumCap);

      if (previousValue === undefined || previousValue !== currentValue) {
        this.previousCapabilityValues.set(enumCap, currentValue);
        this.executeSystemResponse(enumCap, currentValue, options);
      }
    }

    // Notify subscribers of state change
    this.notifySubscribers();
  }

  // ──────────────────────────────────────────────────────
  // System Response Registry
  // ──────────────────────────────────────────────────────

  /**
   * Register a system-level response handler for a capability.
   * Only ONE handler per capability — last registration wins.
   * Handler fires automatically when the capability's aggregate value transitions.
   *
   * System responses handle infrastructure concerns:
   * - Stopping background processes
   * - Pausing job queues
   * - Capturing offline mutations
   * - Switching to fallback transports
   *
   * @returns Unregister function
   */
  registerResponse(capability: DegradeCapability, handler: DegradeResponseHandler): () => void {
    this.systemResponses.set(capability, handler);
    return () => {
      // Only delete if it's still the same handler (avoids removing a newer registration)
      if (this.systemResponses.get(capability) === handler) {
        this.systemResponses.delete(capability);
      }
    };
  }

  /**
   * Execute the registered system response for a capability.
   * Called internally by set() when aggregate value transitions.
   * Wrapped in try/catch — response errors must never crash the degradation system itself.
   */
  private executeSystemResponse(
    capability: DegradeCapability,
    available: boolean,
    options: { source: string; reason: string },
  ): void {
    const handler = this.systemResponses.get(capability);
    if (!handler) return;

    try {
      handler({
        capability,
        available,
        reason: options.reason,
        source: options.source,
        isCrash: false, // System layer doesn't distinguish — lib layer handles crash semantics
      });
    } catch (error) {
      // Response handler must never take down the degradation system
      console.error(`[DegradeManager] System response error for ${capability}:`, error);
    }
  }

  /**
   * Get count of registered system response handlers (for debugging/testing)
   */
  getResponseCount(): number {
    return this.systemResponses.size;
  }

  // ──────────────────────────────────────────────────────
  // Subscriptions
  // ──────────────────────────────────────────────────────

  /**
   * Subscribe to degradation state changes
   * 
   * Returns unsubscribe function (standard pattern)
   * 
   * @param callback Called whenever any degradation state changes
   * @returns Unsubscribe function
   */
  subscribe(callback: DegradeSubscriber): () => void {
    this.subscribers.add(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Get current full degradation state
   * Synchronous read with per-capability metadata
   * 
   * Aggregation logic:
   * - Capability is available (true) only if ALL sources report it as available
   * - If ANY source reports degraded, capability is degraded
   * - Returns that source's metadata explaining why
   */
  getState(): DegradeState {
    // Use Object.create(null) to prevent prototype pollution
    const capabilities = Object.create(null) as Record<DegradeCapability, DegradeCapabilityState>;

    // Initialize all capabilities to ready state using only enum values
    const allCapabilities = Object.values(DegradeCapability).filter(
      (cap): cap is DegradeCapability => typeof cap === 'string',
    );

    for (const cap of allCapabilities) {
      const state: DegradeCapabilityState = {
        value: true,
        reason: 'ready',
        source: 'system',
        updatedAt: Date.now(),
      };

      // Use Object.defineProperty for explicit, safe property assignment
      // Prevents generic object injection warnings while maintaining type safety
      Object.defineProperty(capabilities, cap, {
        value: state,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }

    // Aggregate state: if any source is degraded, capability is degraded
    // Iterate only over the initialized capabilities (validated enum values)
    for (const capEnum of allCapabilities) {
      // Collect all source opinions for this capability
      const sourceOpinions: DegradeCapabilityState[] = [];
      for (const sourceCapabilities of this.sourceStates.values()) {
        const state = sourceCapabilities.get(capEnum);
        if (state) {
          sourceOpinions.push(state);
        }
      }

      // If any source reports degraded, use that source's metadata
      const degradedOpinion = sourceOpinions.find((s) => !s.value);
      if (degradedOpinion) {
        Object.defineProperty(capabilities, capEnum, {
          value: degradedOpinion,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      } else if (sourceOpinions.length > 0) {
        // All sources report available; use most recent
        Object.defineProperty(capabilities, capEnum, {
          value: sourceOpinions[sourceOpinions.length - 1],
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }
    }

    return {
      capabilities,
      timestamp: Date.now(),
    };
  }

  /**
   * Check if a capability is available (true) or degraded (false)
   * 
   * Aggregation logic: true only if NO sources report it as degraded
   * 
   * @param capability Capability to check
   * @returns true if capable, false if any source reports degraded
   */
  isCapable(capability: DegradeCapability): boolean {
    // If any source reports degraded for this capability, it's not capable
    for (const sourceCapabilities of this.sourceStates.values()) {
      const state = sourceCapabilities.get(capability);
      if (state && !state.value) {
        return false; // This source reports it as degraded
      }
    }

    // All sources either haven't opined or report it as available
    return true;
  }

  /**
   * Register a handler cleanup function by name.
   * Called by handlers during initialization so DegradeManager owns all cleanup.
   * All registered cleanups fire on destroy().
   *
   * @param name Unique handler name (e.g., 'connectivity', 'sync')
   * @param cleanup Unsubscribe / teardown function
   */
  registerHandlerCleanup(name: string, cleanup: () => void): void {
    // If a handler with same name already registered, clean it up first
    const existing = this.handlerCleanups.get(name);
    if (existing) {
      try { existing(); } catch { /* ignore teardown errors */ }
    }
    this.handlerCleanups.set(name, cleanup);
  }

  /**
   * Clear all degradation state for a specific source
   * Called during cleanup, testing, or app reset
   *
   * @param source Source to clear
   */
  clearSource(source: string): void {
    this.sourceStates.delete(source);
    this.notifySubscribers();
  }

  /**
   * Clear all degradation state for all sources and run all handler cleanups.
   * Called during app shutdown or full reset (via AppKernel.destroy())
   */
  clear(): void {
    this.sourceStates.clear();
    this.previousCapabilityValues.clear();
    this.systemResponses.clear();
    // Run all registered handler cleanups (unsubscribes, teardowns)
    for (const [name, cleanup] of this.handlerCleanups) {
      try {
        cleanup();
      } catch (error) {
        console.error(`[DegradeManager] Cleanup error for handler "${name}":`, error);
      }
    }
    this.handlerCleanups.clear();
    this.notifySubscribers();
  }

  /**
   * Notify all subscribers of state change
   * Private method called after state updates
   */
  private notifySubscribers(): void {
    // Simple debounce: don't notify more than once per debounce window
    const now = Date.now();
    if (now - this.lastNotificationTime < this.notificationDebounceMs) {
      return;
    }

    this.lastNotificationTime = now;
    const currentState = this.getState();

    // Call all subscribers (synchronously, in order)
    for (const subscriber of this.subscribers) {
      try {
        subscriber(currentState);
      } catch (error) {
        // Log but don't crash if a subscriber throws
        console.error('[DegradeManager] Subscriber error:', error);
      }
    }
  }

  /**
   * Get count of active subscribers (for debugging/testing)
   */
  getSubscriberCount(): number {
    return this.subscribers.size;
  }

  /**
   * Get count of active sources that have reported state (for debugging/testing)
   */
  getSourceCount(): number {
    return this.sourceStates.size;
  }
}

/**
 * Global degradation manager singleton
 * Initialized once, reused throughout app lifecycle
 */
export const appDegrade = new DegradeManager();
