import { ReactNode } from 'react';
import {
    AppParamsStableProvider,
    useAppParamsStable,
    useConnectedWorlds,
    useUserId,
} from './AppParamsStableProvider';
import {
    AppParamsVolatileProvider,
    useAppParamsVolatile,
    useUserRole,
    useWorldId,
} from './AppParamsVolatileProvider';

/**
 * 🗺️ AppParamsProvider
 *
 * Combined provider for all app-level routing and context parameters.
 * Groups AppParamsStable + AppParamsVolatile into a single provider hierarchy.
 *
 * Wraps:
 * - AppParamsStableProvider: Persistent params (userId, connectedWorldIds)
 *   Loaded from storage on app start, updated when auth state changes, gated on servicesReady phase
 *
 * - AppParamsVolatileProvider: Session params (worldId, userRole)
 *   Set during world selection flow, cleared when navigating away, gated on storageReady phase
 *
 * All hooks remain individually available:
 * - useUserId() — Get current user ID (stable)
 * - useConnectedWorlds() — Get list of accessible worlds (stable)
 * - useAppParamsStable() — Get/set all stable params
 * - useWorldId() — Get current world ID (volatile)
 * - useUserRole() — Get current user role in world (volatile)
 * - useAppParamsVolatile() — Get/set all volatile params
 *
 * Usage: Wrap with SubscriptionProvider above and OverlayProvider below
 */

interface AppParamsProviderProps {
  children: ReactNode;
}

export function AppParamsProvider({ children }: AppParamsProviderProps) {
  return (
    <AppParamsStableProvider>
      <AppParamsVolatileProvider>
        {children}
      </AppParamsVolatileProvider>
    </AppParamsStableProvider>
  );
}

// Re-export all hooks for convenience
export {
    useAppParamsStable, useAppParamsVolatile, useConnectedWorlds,
    useUserId, useUserRole,
    useWorldId
};

