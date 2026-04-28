import { useRouter } from 'expo-router';

/**
 * Gets the router instance
 * Note: This is only safe to call inside React components via hooks.
 * System orchestration layer handles the context.
 */
let routerInstance: ReturnType<typeof useRouter> | null = null;

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