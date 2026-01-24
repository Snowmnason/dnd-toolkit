import { buildNavigationTarget, logger } from "@/lib";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { useUserId } from "../../providers/AppParamsStableProvider";
import {
  useAppParamsVolatile,
  useUserRole,
  useWorldId,
} from "../../providers/AppParamsVolatileProvider";

/**
 * Custom hook for navigation that automatically manages the centralized params context
 * Uses the centralized navigation config for route validation and param preservation
 */
export function useAppNavigation() {
  const router = useRouter();
  const userId = useUserId();
  const worldId = useWorldId();
  const userRole = useUserRole();
  const { updateVolatileParams } = useAppParamsVolatile();

  /**
   * Navigate with automatic params management and route validation
   * @param pathname - The route pathname to navigate to
   * @param additionalParams - Any additional params to include (will be merged with context params)
   * @param updateContext - Whether to update the context with the params (default: true)
   */
  const navigateWithParams = useCallback(
    (
      pathname: string,
      additionalParams?: Record<string, string>,
      updateContext: boolean = true,
    ) => {
      try {
        // Build navigation target with proper param preservation
        const target = buildNavigationTarget(
          pathname,
          { worldId, userRole, ...additionalParams },
          ["worldId", "userRole"],
          additionalParams || {},
        );

        // Update context if requested
        if (updateContext) {
          updateVolatileParams({
            worldId,
            userRole,
            ...additionalParams,
          });
        }

        router.push(target as any);
      } catch (error) {
        logger.warn(
          `useAppNavigation: Failed to navigate to ${pathname}`,
          error,
        );
      }
    },
    [router, worldId, userRole, updateVolatileParams],
  );

  /**
   * Replace route with automatic params management and route validation
   */
  const replaceWithParams = useCallback(
    (
      pathname: string,
      additionalParams?: Record<string, string>,
      updateContext: boolean = true,
    ) => {
      try {
        // Build navigation target with proper param preservation
        const target = buildNavigationTarget(
          pathname,
          { worldId, userRole, ...additionalParams },
          ["worldId", "userRole"],
          additionalParams || {},
        );

        // Update context if requested
        if (updateContext) {
          updateVolatileParams({
            worldId,
            userRole,
            ...additionalParams,
          });
        }

        router.replace(target as any);
      } catch (error) {
        logger.warn(
          `useAppNavigation: Failed to replace route ${pathname}`,
          error,
        );
      }
    },
    [router, worldId, userRole, updateVolatileParams],
  );

  /**
   * Navigate back; if history is unavailable, fall back to world selection
   */
  const goBack = useCallback(
    (fallbackPath: string = "/select/world-selection") => {
      if (router.canGoBack?.()) {
        router.back();
        return;
      }

      const target = buildNavigationTarget(
        fallbackPath,
        { worldId, userRole },
        ["worldId", "userRole"],
      );
      router.replace(target as any);
    },
    [router, worldId, userRole],
  );

  return {
    navigateWithParams,
    replaceWithParams,
    goBack,
    params: { userId, worldId, userRole },
    router,
  };
}
