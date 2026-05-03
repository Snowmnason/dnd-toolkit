import { useRouter } from 'expo-router';

/**
 * Gets the router instance
 * Note: This is only safe to call inside React components via hooks.
 * System orchestration layer handles the context.
 */
let routerInstance: ReturnType<typeof useRouter> | null = null;

/**
 * Current canonical pathname, kept in sync by the route change observer.
 * Updated before any navigation call so fromRoute is accurate.
 */
let currentPathname: string = '/';

/**
 * Initialize the router instance for use by transport layer.
 * 
 * This MUST be called by the kernel/bootstrap layer before any navigation operations.
 * Ensures the transport adapter has access to Expo Router for centralized execution.
 * 
 * @param router - Expo Router instance from useRouter hook
 */
export function initializeRouter(router: ReturnType<typeof useRouter>): void {
  routerInstance = router;
}

/**
 * Get current router instance
 * Throws if router not initialized
 */
export function getRouter(): ReturnType<typeof useRouter> {
  if (!routerInstance) {
    throw new Error(
      'Router not initialized. Call initializeRouter() before any transport operations.'
    );
  }
  return routerInstance;
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * Check whether the transport layer is initialized and ready for operations.
 * 
 * Returns true only after initializeRouter() has been called successfully.
 * Use this for bootstrap diagnostics to verify router is available before attempting navigation.
 * 
 * @returns true if router is initialized, false otherwise
 */
export function isTransportReady(): boolean {
  return routerInstance !== null;
}

/**
 * Update the current pathname. Called by the route change observer on every segment change.
 * This is the authoritative source for getCurrentRoute() — avoids relying on router.getState()
 * which only returns the top-level segment key, not the full nested path.
 */
export function setCurrentPathname(pathname: string): void {
  currentPathname = pathname;
}

/**
 * Get the current pathname as last reported by the route change observer.
 * Falls back to '/' before the observer has fired.
 */
export function getCurrentPathname(): string {
  return currentPathname;
}