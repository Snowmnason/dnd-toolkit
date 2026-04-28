/**
 * React hook to subscribe to degradation status with automatic level calculation.
 *
 * Returns a smart object with:
 * - `level`: 'normal' | 'degraded' | 'critical' (calculated from state)
 * - `capabilities`: Record of all capabilities and their status
 * - `timestamp`: When this snapshot was taken
 * - `reason`: Primary fault reason (if any)
 *
 * Automatically unsubscribes on unmount.
 *
 * @example
 * ```tsx
 * import { useDegradationStatus } from '@/hooks/kernel';
 *
 * export function MyComponent() {
 *   const { level, capabilities, reason } = useDegradationStatus();
 *
 *   if (level === 'critical') {
 *     return <div>System critical: {reason}</div>;
 *   }
 *
 *   return (
 *     <div>
 *       Database: {capabilities.database ? '✓' : '✗'}
 *     </div>
 *   );
 * }
 * ```
 */

import { getDegradationState, getPrimaryFault, subscribeToDegradation } from '@/lib/error/degrade/degrade-manager';
import { DegradationLevel, DegradeCapability, DegradeState } from '@/type-definitions/degrade';
import { useEffect, useState } from 'react';

export interface DegradationStatus {
  /**
   * Calculated severity level:
   * - 'normal': all capabilities operational
   * - 'degraded': 1+ capabilities down but app continues (network, sync, analytics)
   * - 'critical': crash-level capability down (database, auth, storage)
   */
  level: DegradationLevel;

  /** All capabilities and their individual states */
  capabilities: Record<string, boolean>;

  /** When this snapshot was taken (ms) */
  timestamp: number;

  /** Primary fault reason (highest-priority degraded capability) */
  reason?: string;

  /** Is safe mode active (unrecoverable failure) */
  isSafeMode: boolean;
}

/**
 * Safely access capability state from degradation state.
 * Uses `in` operator to guard property access (prevents object injection sink warnings).
 */
function getCapabilityState(
  capabilities: DegradeState['capabilities'],
  cap: DegradeCapability,
) {
  if (cap in capabilities) {
    return capabilities[cap as keyof typeof capabilities];
  }
  return undefined;
}

/**
 * Calculate degradation level from state.
 * Logic: if any crash-level capability is down → 'critical'
 *        else if any degradable capability is down → 'degraded'
 *        else → 'normal'
 *
 * Uses DegradeCapability enum as whitelist to prevent object injection sinks.
 */
function calculateDegradationLevel(state: DegradeState): DegradationLevel {
  // Crash-level capabilities: database, auth, storage
  const criticalCapabilities = [DegradeCapability.DATABASE, DegradeCapability.AUTH, DegradeCapability.STORAGE];
  const hasCritical = criticalCapabilities.some((cap) => {
    const capState = getCapabilityState(state.capabilities, cap);
    return capState && !capState.value;
  });
  if (hasCritical) return 'critical';

  // Degradable capabilities: connectivity, sync, background jobs, analytics, error tracking
  const degradableCapabilities = [
    DegradeCapability.CONNECTIVITY,
    DegradeCapability.SYNC,
    DegradeCapability.BACKGROUND_JOBS,
    DegradeCapability.ANALYTICS,
    DegradeCapability.ERROR_TRACKING,
  ];
  const hasDegraded = degradableCapabilities.some((cap) => {
    const capState = getCapabilityState(state.capabilities, cap);
    return capState && !capState.value;
  });
  if (hasDegraded) return 'degraded';

  return 'normal';
}

/**
 * Extract capabilities as simple Record<string, boolean> for easy access.
 * Uses Object.fromEntries with DegradeCapability enum values (prevents object injection sinks).
 */
function extractCapabilities(state: DegradeState): Record<string, boolean> {
  // Build entries array from whitelisted capabilities only
  const entries = Object.values(DegradeCapability).map((capability) => {
    const capState = getCapabilityState(state.capabilities, capability);
    const value = capState?.value ?? true; // Default to true (operational) if missing
    return [capability, value] as const;
  });

  // Object.fromEntries safely constructs object from known, whitelisted entries
  return Object.fromEntries(entries);
}

/**
 * Hook: Subscribe to degradation state with smart calculations.
 */
export function useDegradationStatus(): DegradationStatus {
  const initialState = getDegradationState();
  const initialPrimary = getPrimaryFault();

  const [status, setStatus] = useState<DegradationStatus>(() => ({
    level: calculateDegradationLevel(initialState),
    capabilities: extractCapabilities(initialState),
    timestamp: initialState.timestamp || Date.now(),
    reason: initialPrimary?.reason,
    isSafeMode: initialPrimary?.isCrash ?? false,
  }));

  useEffect(() => {
    // Subscribe to changes
    const unsubscribe = subscribeToDegradation((state: DegradeState) => {
      const primaryFault = getPrimaryFault();
      setStatus({
        level: calculateDegradationLevel(state),
        capabilities: extractCapabilities(state),
        timestamp: state.timestamp,
        reason: primaryFault?.reason,
        isSafeMode: primaryFault?.isCrash ?? false,
      });
    });

    // Cleanup on unmount
    return () => {
      unsubscribe();
    };
  }, []);

  return status;
}
