import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useAppParams } from '../contexts/AppParamsContext';

/**
 * Custom hook for navigation that automatically manages the centralized params context
 */
export function useAppNavigation() {
  const router = useRouter();
  const { params, updateParams } = useAppParams();

  /**
   * Navigate with automatic params management
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
      const routeParams: Record<string, string> = {
        ...additionalParams,
      };

      // Add context params if they exist
      if (params.userId) routeParams.userId = params.userId;
      if (params.worldId) routeParams.worldId = params.worldId;
      if (params.userRole) routeParams.userRole = params.userRole;

      // Update context if requested
      if (updateContext) {
        updateParams({
          userId: params.userId,
          worldId: params.worldId,
          userRole: params.userRole,
          ...additionalParams,
        });
      }

      router.push({
        pathname: pathname as any,
        params: routeParams,
      });
    },
    [router, params, updateParams]
  );

  /**
   * Replace route with automatic params management
   */
  const replaceWithParams = useCallback(
    (
      pathname: string,
      additionalParams?: Record<string, string>,
      updateContext: boolean = true
    ) => {
      const routeParams: Record<string, string> = {
        ...additionalParams,
      };

      // Add context params if they exist
      if (params.userId) routeParams.userId = params.userId;
      if (params.worldId) routeParams.worldId = params.worldId;
      if (params.userRole) routeParams.userRole = params.userRole;

      // Update context if requested
      if (updateContext) {
        updateParams({
          userId: params.userId,
          worldId: params.worldId,
          userRole: params.userRole,
          ...additionalParams,
        });
      }

      router.replace({
        pathname: pathname as any,
        params: routeParams,
      });
    },
    [router, params, updateParams]
  );

  return {
    navigateWithParams,
    replaceWithParams,
    params,
    router,
  };
}
