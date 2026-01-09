import { logger } from '@/lib';
import { buildNavigationTarget } from '@/lib/navigation/uri-helpers';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useAppParams } from '../contexts/AppParamsContext';

/**
 * Custom hook for navigation that automatically manages the centralized params context
 * Uses the centralized navigation config for route validation and param preservation
 */
export function useAppNavigation() {
  const router = useRouter();
  const { params, updateParams } = useAppParams();

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
      updateContext: boolean = true
    ) => {
      try {
        // Build navigation target with proper param preservation
        const target = buildNavigationTarget(
          pathname,
          { worldId: params.worldId, userRole: params.userRole, ...additionalParams },
          ['worldId', 'userRole'],
          additionalParams || {}
        );

        // Update context if requested
        if (updateContext) {
          updateParams({
            worldId: params.worldId,
            userRole: params.userRole,
            ...additionalParams,
          });
        }

        router.push(target as any);
      } catch (error) {
        logger.warn(`useAppNavigation: Failed to navigate to ${pathname}`, error);
      }
    },
    [router, params.worldId, params.userRole, updateParams]
  );

  /**
   * Replace route with automatic params management and route validation
   */
  const replaceWithParams = useCallback(
    (
      pathname: string,
      additionalParams?: Record<string, string>,
      updateContext: boolean = true
    ) => {
      try {
        // Build navigation target with proper param preservation
        const target = buildNavigationTarget(
          pathname,
          { worldId: params.worldId, userRole: params.userRole, ...additionalParams },
          ['worldId', 'userRole'],
          additionalParams || {}
        );

        // Update context if requested
        if (updateContext) {
          updateParams({
            worldId: params.worldId,
            userRole: params.userRole,
            ...additionalParams,
          });
        }

        router.replace(target as any);
      } catch (error) {
        logger.warn(`useAppNavigation: Failed to replace route ${pathname}`, error);
      }
    },
    [router, params.worldId, params.userRole, updateParams]
  );

  /**
   * Navigate back using router.back()
   */
  const goBack = useCallback(() => {
    router.back();
  }, [router]);

  return {
    navigateWithParams,
    replaceWithParams,
    goBack,
    params,
    router,
  };
}
