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
 * Uses lazy singleton pattern: initializes listener on first call (not at module load time)
 * This avoids module-level side effects and is safe for SSR/test environments
 * 
 * @returns boolean - true if app is backgrounded, false otherwise
 */
let currentAppState: AppStateStatus = 'active';
let isInitialized = false;
let subscription: ReturnType<typeof AppState.addEventListener> | null = null;

function initializeAppStateListener(): void {
  if (isInitialized) return;
  if (Platform.OS === 'web') {
    isInitialized = true;
    return;
  }

  try {
    subscription = AppState.addEventListener('change', (nextAppState) => {
      currentAppState = nextAppState;
    });
    isInitialized = true;
  } catch (error) {
    // Gracefully handle if AppState is unavailable
    console.warn('Failed to initialize AppState listener:', error);
    isInitialized = true;
  }
}

export function isAppIdle(): boolean {
  // Lazy initialization: set up listener on first call
  if (!isInitialized) {
    initializeAppStateListener();
  }
  return currentAppState !== 'active';
}

/**
 * Optional cleanup function for testing/teardown
 * @private
 */
export function _cleanupAppStateListener(): void {
  if (subscription) {
    subscription.remove();
    subscription = null;
  }
  isInitialized = false;
  currentAppState = 'active';
}
