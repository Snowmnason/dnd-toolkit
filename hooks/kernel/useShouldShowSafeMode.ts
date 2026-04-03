/**
 * React hook to check if safe mode screen should be shown.
 *
 * Returns `true` when a crash-level capability fails:
 * - Database corrupted
 * - Auth completely failed  
 * - Storage unreadable
 *
 * Typically used with an error boundary to block user interaction
 * until the issue is resolved.
 *
 * @example
 * ```tsx
 * import { useShouldShowSafeMode } from '@/hooks/kernel';
 *
 * export function AppLayout() {
 *   const shouldShowSafeMode = useShouldShowSafeMode();
 *
 *   if (shouldShowSafeMode) {
 *     return <SafeModeScreen />;
 *   }
 *
 *   return <NormalApp />;
 * }
 * ```
 */

import { useDegradationStatus } from './useDegradationStatus';

/**
 * Hook: Should we show the safe mode screen?
 * Returns true when system is in crisis (crash-level capability failed).
 */
export function useShouldShowSafeMode(): boolean {
  const { level, isSafeMode } = useDegradationStatus();
  return level === 'critical' && isSafeMode;
}
