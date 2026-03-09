/**
 * Hooks for accessing and managing safe mode state
 * These hooks subscribe to kernel state changes via kernel-manager
 */

import {
  SafeModeLevel,
  SafeModeReason,
  SafeModeState,
  createSafeModeState,
} from "@/lib/error";
import {
  clearSafeMode,
  getSafeMode,
  onKernelStateChange,
  setSafeMode,
  type AppKernelState,
} from "@/lib/kernel";
import { useCallback, useEffect, useState } from "react";

/**
 * Hook to access current safe mode state
 * Returns null if app is in NORMAL state
 */
export function useSafeMode(): SafeModeState | null {
  const [safeMode, setSafeModeState] = useState<SafeModeState | null>(null);

  useEffect(() => {
    // Get initial state
    setSafeModeState(getSafeMode());

    // Subscribe to kernel updates
    const unsubscribe = onKernelStateChange((state: AppKernelState) => {
      setSafeModeState(state.safeMode);
    });

    return unsubscribe;
  }, []);

  return safeMode;
}

/**
 * Hook to check if app is in safe mode (any level)
 */
export function useIsSafeMode(): boolean {
  const safeMode = useSafeMode();
  return safeMode !== null;
}

/**
 * Hook to check if app is in a specific safe mode level
 */
export function useIsInSafeModeLevel(level: SafeModeLevel): boolean {
  const safeMode = useSafeMode();
  return safeMode?.level === level;
}

/**
 * Hook to check if app is in DEGRADED or SAFE state (bundled screen)
 */
export function useIsDegradedOrSafe(): boolean {
  const safeMode = useSafeMode();
  return (
    safeMode?.level === SafeModeLevel.DEGRADED ||
    safeMode?.level === SafeModeLevel.SAFE
  );
}

/**
 * Hook to check if app is in RECOVERY state
 */
export function useIsInRecovery(): boolean {
  return useIsInSafeModeLevel(SafeModeLevel.RECOVERY);
}

/**
 * Hook to trigger safe mode (triggers a safe mode state change)
 * Used by components/kernel to initiate safe mode transitions
 */
export function useSetSafeMode() {
  return useCallback((reason: SafeModeReason, details?: string) => {
    const safeMode = createSafeModeState(reason, { details });
    setSafeMode(safeMode);
  }, []);
}

/**
 * Hook to exit safe mode (recovery successful)
 * Resets safe mode state to null (NORMAL)
 */
export function useClearSafeMode() {
  return useCallback(() => {
    clearSafeMode();
  }, []);
}

/**
 * Hook to get the current safe mode level
 * Returns SafeModeLevel or null if NORMAL
 */
export function useSafeModeLevel(): SafeModeLevel | null {
  const safeMode = useSafeMode();
  return safeMode?.level ?? null;
}

/**
 * Hook to check if a specific feature is affected by safe mode
 * Used by components to conditionally disable/hide features
 */
export function useIsFeatureAffected(featureName: string): boolean {
  const safeMode = useSafeMode();
  return safeMode?.affectedFeatures.some((f: string) => f === featureName) ?? false;
}
