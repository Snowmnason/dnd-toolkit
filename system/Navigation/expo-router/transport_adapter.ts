/**
 * Transport Adapter: Router Wrapper
 * 
 * This is the ONLY place in the codebase where Expo Router and Linking are directly called.
 *
 * TYPING: Route transitions use the object href form `{ pathname, params }` to call
 * Expo Router. The generated route types (`.expo/types/router.d.ts`) define `Href` as a
 * union of literal pathname objects. Because the adapter receives `target` as a dynamic
 * string from the middleware layer, we cast the object to `any` at the boundary.
 * This is intentional — the adapter is the single bridge between the dynamic navigation
 * system and Expo Router's static type system.
 *
 * Previous `/?${target}` approach satisfied types but produced malformed web URLs
 * (e.g., `/?login%2Fsign-in=`). The object href form produces correct pathnames.
 * 
 * All navigation requests flow through this adapter:
 * - System Orchestration calls adapter functions
 * - Adapter calls Expo Router or Linking
 * - No other code directly touches router.* or Linking.*
 * 
 * Why this matters:
 * - Single point for transport logic (retries, logging, future changes)
 * - Easy to swap implementations (web routing lib, custom router)
 * - Prevents bypassing the guard pipeline
 * - Makes it obvious where external transport happens
 * 
 * ESLint Rule: no-direct-router blocks all router.* calls except here and tests
 */

import { logger } from '@/lib/utils/logger';
import type { ExternalLinkOptions, TransportResult } from '@/type-definitions';
import { Linking } from 'react-native';
import { getRouter } from './transport_provider';



// ============================================================================
// ROUTE TRANSITIONS (Full navigation)
// ============================================================================

/**
 * Execute a navigate navigation action through the centralized transport layer.
 * 
 * Adds the target route to the navigation stack, preserving history.
 * System orchestration uses this to transition to a new route after all guards have passed.
 * uses router.navigate() under the hood. to prevent force-stack-deuplication
 * 
 * Equivalent to Expo Router's `router.navigate()`
 * 
 * @param target - Fully-formed route path to navigate to (e.g., '/main/worlds', '/main/worlds/123')
 *                 Orchestration layer is responsible for building the complete path before passing here
 * @returns Execution result with success state and optional error
 */
export function executeRouterPush(
  target: string,
  params?: Record<string, any>,
): TransportResult {
  try {
    const router = getRouter();
    
    const cleanTarget = target.startsWith('/') ? target : `/${target}`;
    router.navigate({ pathname: cleanTarget, params } as any);
    
    logger.category('navigation').debug(`Router navigate: ${target}`);
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.category('navigation').error(`Router navigate failed: ${target}`, { error: err });
    return { success: false, error: err };
  }
}

/**
 * Execute a replace navigation action through the centralized transport layer.
 * 
 * Replaces the current route without adding to history; useful for redirects or auth state changes.
 * System orchestration uses this when a route transition requires protecting the "back" button.
 * 
 * Equivalent to Expo Router's `router.replace()`
 * 
 * @param target - Fully-formed route path to replace with (e.g., '/login', '/auth/verify/123')
 *                 Orchestration layer is responsible for building the complete path before passing here
 * @returns Execution result with success state and optional error
 */
export function executeRouterReplace(
  target: string,
  params?: Record<string, any>,
): TransportResult {
  try {
    const router = getRouter();

    const cleanTarget = target.startsWith('/') ? target : `/${target}`;
    router.replace({ pathname: cleanTarget, params } as any);
    
    logger.category('navigation').debug(`Router replace: ${target}`);
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.category('navigation').error(`Router replace failed: ${target}`, { error: err });
    return { success: false, error: err };
  }
}

/**
 * Execute a dismissTo action through the centralized transport layer.
 * 
 * Pops the navigation stack back to a specific screen in history.
 * Used when navigating backwards through multiple screens to reach a known target.
 * 
 * Equivalent to Expo Router's `router.dismissTo()`
 * 
 * @param target - Fully-formed route path to dismiss back to (must be in current stack history)
 *                 Orchestration layer is responsible for building the complete path before passing here
 * @returns Execution result with success state and optional error
 */
export function executeRouterDismissTo(
  target: string,
  params?: Record<string, any>,
): TransportResult {
  try {
    const router = getRouter();
    const cleanTarget = target.startsWith('/') ? target : `/${target}`;
    router.dismissTo({ pathname: cleanTarget, params } as any);
    
    logger.category('navigation').debug(`Router dismissTo: ${target}`);
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.category('navigation').error(`Router dismissTo failed: ${target}`, { error: err });
    return { success: false, error: err };
  }
}

// ============================================================================
// HISTORY (Back/Dismiss)
// ============================================================================

/**
 * Execute a back navigation action through the centralized transport layer.
 * 
 * Pops one screen from the navigation stack.
 * Used for back buttons, back gestures, and navigation history traversal.
 * 
 * Equivalent to Expo Router's `router.back()`
 * 
 * @returns Execution result with success state and optional error
 */
export function executeRouterBack(): TransportResult {
  try {
    const router = getRouter();
    // EXCEPTION: This is the transport adapter. Router calls are allowed here.
     
    router.back();
    
    logger.category('navigation').debug(`Router back`);
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.category('navigation').error(`Router back failed`, { error: err });
    return { success: false, error: err };
  }
}

/**
 * Execute a dismiss action through the centralized transport layer.
 * 
 * Navigates down the stack by the provided count, dismissing screens.
 * If count is not provided, defaults to 1 (dismiss one screen).
 * If the current screen is the only route, dismisses the entire stack.
 * 
 * Equivalent to Expo Router's `router.dismiss()`
 * 
 * @param count - Number of screens to dismiss from the stack (defaults to 1 if not provided)
 * @returns Execution result with success state and optional error
 */
export function executeRouterDismiss(count?: number): TransportResult {
  try {
    const router = getRouter();
    router.dismiss(count);
    
    logger.category('navigation').debug(`Router dismiss`, { count: count ?? 1 });
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.category('navigation').error(`Router dismiss failed`, { error: err });
    return { success: false, error: err };
  }
}

/**
 * Execute a dismissAll action through the centralized transport layer.
 * 
 * Returns to the first screen in the closest stack (similar to popToTop stack action).
 * Clears all screens above the base route, returning to the root of the current stack.
 * 
 * Equivalent to Expo Router's `router.dismissAll()`
 * 
 * @returns Execution result with success state and optional error
 */
export function executeRouterDismissAll(): TransportResult {
  try {
    const router = getRouter();
    router.dismissAll();
    
    logger.category('navigation').debug(`Router dismissAll`);
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.category('navigation').error(`Router dismissAll failed`, { error: err });
    return { success: false, error: err };
  }
}

// ============================================================================
// UTILITY (Params, Prefetch, Queries)
// ============================================================================

/**
 * Update query parameters on the current route without navigation.
 * 
 * Modifies URL params for the active screen without pushing/replacing routes.
 * Useful for updating filters, search queries, or state that persists within a route.
 * 
 * Wrapper for Expo Router's `router.setParams(params: Partial<RouteInputParams<T>>): void`.
 * Returns TransportResult instead of void for consistency with other transport operations.
 * 
 * @param params - Object containing key-value pairs to set as query parameters (Expo: Partial<RouteInputParams<T>>)
 * @returns Execution result with success state and optional error
 */
export function executeRouterSetParams(params: Record<string, any>): TransportResult {
  try {
    const router = getRouter();
     
    router.setParams(params);
    
    logger.category('navigation').debug(`Router setParams`, { params });
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.category('navigation').error(`Router setParams failed`, { error: err });
    return { success: false, error: err };
  }
}

/**
 * Prefetch a route to improve navigation performance.
 * 
 * Loads the route bundle/screen component in the background before navigation occurs.
 * Reduces perceived navigation delay when the user later navigates to this route.
 * 
 * Equivalent to Expo Router's `router.prefetch()`
 * 
 * @param target - Fully-formed route path to prefetch (e.g., '/main/settings')
 *                 Orchestration layer is responsible for building the complete path before passing here
 * @returns Execution result; returns success=true even if prefetch is not available on platform
 */
export function executeRouterPrefetch(target: string): TransportResult {
  try {
    const router = getRouter();
    
    // prefetch is not available on all platforms, safe to skip
    if (router.prefetch) {
      router.prefetch(`/?${target}`);
      logger.category('navigation').debug(`Router prefetch: ${target}`);
    }else{
      router.navigate(`/?${target}`); // Fallback to normal navigation if prefetch not supported
      logger.category('navigation').debug(`Router prefetch not supported, fallback navigate: ${target}`);
    }
    
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.category('navigation').warn(`Router prefetch failed: ${target}`, { error: err });
    // Don't fail navigation if prefetch fails
    return { success: true };
  }
}

/**
 * Query whether the router can currently execute a back operation.
 * 
 * Returns true if there is at least one route in the stack history to go back to.
 * Use this to conditionally show/enable back buttons.
 * 
 * Equivalent to Expo Router's `router.canGoBack()`
 * 
 * @returns true if back navigation is available, false otherwise
 */
export function canRouterGoBack(): boolean {
  try {
    const router = getRouter();
    return router.canGoBack();
  } catch (error) {
    logger.category('navigation').warn(`canRouterGoBack failed`, { error });
    return false;
  }
}

/**
 * Query whether the router can currently execute a dismiss operation.
 * 
 * Checks if it is possible to dismiss the current screen.
 * Returns true if the router is within a stack with more than one screen in the stack's history.
 * Use this to conditionally show/enable dismiss buttons.
 * 
 * Equivalent to Expo Router's `router.canDismiss()`
 * 
 * @returns true if dismiss is available, false otherwise or on platforms without support
 */
export function canRouterDismiss(): boolean {
  try {
    const router = getRouter();
    
    // canDismiss is not available on all platforms, safe to assume false
    if (router.canDismiss) {
      return router.canDismiss();
    }
    
    return false;
  } catch (error) {
    logger.category('navigation').warn(`canRouterDismiss failed`, { error });
    return false;
  }
}

// ============================================================================
// EXTERNAL (Opening web links, external URLs)
// ============================================================================

/**
 * Execute external link navigation through the centralized transport layer.
 * 
 * Opens external URLs, deep links, mailto, tel schemes, and other external resources.
 * System orchestration uses this for all outbound navigation (security, logging, consent).
 * 
 * Uses React Native `Linking.openURL()`
 * 
 * @param url - URL or URI to open (e.g., 'https://example.com', 'mailto:user@example.com', 'tel:+1234567890')
 * @param options - Optional configuration: trusted flag, newTab preference, callbacks
 * @returns Promise resolving to execution result with success state and optional error
 */
export async function executeOpenWeb(
  url: string,
  options?: ExternalLinkOptions
): Promise<TransportResult> {
  try {
    // Basic validation
    if (!url) {
      throw new Error('URL cannot be empty');
    }

    // Check if URL is trusted (for security logging)
    const isTrusted = options?.trusted ?? false;
    
    logger.category('navigation').debug(`Opening external URL`, {
      url: isTrusted ? url : '[untrusted]',
      trusted: isTrusted,
      newTab: options?.newTab,
    });

    // Use Linking module to open URL
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      throw new Error(`Cannot open URL: ${url}`);
    }

    await Linking.openURL(url);
    
    options?.onComplete?.();
    
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.category('navigation').error(`Failed to open external URL`, { error: err });
    options?.onError?.(err);
    return { success: false, error: err };
  }
}

// ============================================================================
// STATE QUERIES
// ============================================================================

/**
 * Query the current route path from the navigation stack.
 * 
 * Returns the path segment of the active screen (e.g., '/main/worlds').
 * Useful for determining current location for analytics, conditionals, or diagnostics.
 * 
 * @returns Current route path string, or '/' if unable to determine
 */
export function getCurrentRoute(): string {
  try {
    const router = getRouter();
    
    // Get current state from router
    const state = (router as any).getState?.();
    
    if (state?.routes) {
      const current = state.routes[state.routes.length - 1];
      return current?.name ?? '/';
    }
    
    return '/';
  } catch (error) {
    logger.category('navigation').warn(`getCurrentRoute failed`, { error });
    return '/';
  }
}

/**
 * Query the current route's parameters/query string.
 * 
 * Returns all query parameters (e.g., ?worldId=123&userRole=admin) for the active screen.
 * Useful for reading state that persists within the current route.
 * 
 * @returns Object containing key-value pairs from the current route's query params
 */
export function getCurrentParams(): Record<string, any> {
  try {
    const router = getRouter();
    
    // Get current state from router
    const state = (router as any).getState?.();
    
    if (state?.routes) {
      const current = state.routes[state.routes.length - 1];
      return current?.params ?? {};
    }
    
    return {};
  } catch (error) {
    logger.category('navigation').warn(`getCurrentParams failed`, { error });
    return {};
  }
}
