/**
 * useNavigate
 *
 * Hook that wraps Expo Router navigation with `buildNavigationTarget` and
 * `buildRoute` so screens never import raw URL utilities from lib.
 *
 * Usage:
 *   const { replace, push, route } = useNavigate();
 *
 *   // Navigate with optional param preservation
 *   replace('/select/world-selection', { worldId, userRole }, ['worldId', 'userRole']);
 *
 *   // Navigate with no extra params (clean redirect)
 *   replace('/');
 *
 *   // Build a typed route string (e.g. for Href-typed props)
 *   const href = route('/login/forgot-password');
 */

import {
    buildNavigationTarget,
    buildRoute,
    type RouteParams,
} from "@/lib/navigation";
import { useRouter } from "expo-router";
import { useCallback } from "react";

export function useNavigate() {
  const router = useRouter();

  /**
   * Replace the current screen.
   * @param path   Route pathname
   * @param params Optional params to embed in the URL
   * @param preserve Subset of param keys to carry over (passed to buildNavigationTarget)
   */
  const replace = useCallback(
    (path: string, params?: RouteParams, preserve?: string[]) => {
      const target = buildNavigationTarget(path, params ?? {}, preserve ?? []);
      router.replace(target as any);
    },
    [router],
  );

  /**
   * Push a new screen onto the stack.
   */
  const push = useCallback(
    (path: string, params?: RouteParams, preserve?: string[]) => {
      const target = buildNavigationTarget(path, params ?? {}, preserve ?? []);
      router.push(target as any);
    },
    [router],
  );

  /**
   * Build a route string without navigating (for Href-typed props or dynamic values).
   */
  const route = useCallback(
    (path: string, params?: RouteParams): string => buildRoute(path, params),
    [],
  );

  return { replace, push, route };
}
