import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';

/**
 * Hook for tracking app state (foreground/background)
 * Platform-aware: AppState is only available on native platforms, not web
 * 
 * Used by: Performance baseline tracking to mark measurements as idle when app is backgrounded
 * 
 * @returns boolean - true if app is currently backgrounded, false if active/unknown
 */
export function useAppState(): boolean {
  const isIdleRef = useRef<boolean>(false);

  useEffect(() => {
    // AppState is only available on native platforms (iOS, Android)
    if (Platform.OS === 'web') {
      return;
    }

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      // Mark as idle if app transitions to inactive or background
      isIdleRef.current = nextAppState === 'inactive' || nextAppState === 'background';
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);

  return isIdleRef.current;
}

/**
 * Helper to get current app state (idle or not)
 * Can be called from non-React contexts (e.g., inside class methods)
 * 
 * @returns boolean - true if app is backgrounded, false otherwise
 */
let currentAppState: AppStateStatus = 'active';

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (nextAppState) => {
    currentAppState = nextAppState;
  });
}

export function isAppIdle(): boolean {
  return currentAppState !== 'active';
}
