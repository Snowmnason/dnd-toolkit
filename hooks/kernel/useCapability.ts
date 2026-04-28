/**
 * React hook to check a single capability's status.
 *
 * Subscribes to degradation state and returns whether the specified capability is operational.
 * Automatically unsubscribes on unmount.
 *
 * @param capability - The capability to check
 * @returns `true` if the capability is operational, `false` if degraded/down
 *
 * @example
 * ```tsx
 * import { useCapability } from '@/hooks/kernel';
 *
 * export function QueryComponent() {
 *   const canQuery = useCapability('database');
 *
 *   if (!canQuery) {
 *     return <div>Database offline, showing cached data</div>;
 *   }
 *
 *   return <div>Querying live data...</div>;
 * }
 * ```
 */

import { subscribeToDegradation } from '@/lib/error/degrade/degrade-manager';
import { DegradeCapability } from '@/type-definitions/degrade';
import { useEffect, useState } from 'react';

/**
 * Safely access capability state from degradation state.
 * Uses `in` operator to guard property access (prevents object injection sink warnings).
 */
function getCapabilityState(
  capabilities: Record<string, any>,
  cap: DegradeCapability,
): boolean {
  if (cap in capabilities) {
    const state = capabilities[cap as keyof typeof capabilities];
    // If capability exists in object, return its `value` property (true = operational)
    return state?.value ?? true;
  }
  // Safety default: assume capability is operational if not found
  return true;
}

export function useCapability(capability: DegradeCapability): boolean {
  const [isOperational, setIsOperational] = useState(true);

  useEffect(() => {
    // Subscribe to degradation state changes
    const unsubscribe = subscribeToDegradation((state) => {
      const capState = getCapabilityState(state.capabilities, capability);
      setIsOperational(capState);
    });

    // Unsubscribe on unmount
    return () => {
      unsubscribe();
    };
  }, [capability]);

  return isOperational;
}
