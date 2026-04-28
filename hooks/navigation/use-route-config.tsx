/**
 * useRouteConfig
 *
 * Hook that resolves the current route's configuration — title and full
 * RouteConfig — from a NavigationContext.
 *
 * Replaces direct calls to `getRouteConfig` and `resolveTitle` so layout
 * files never import raw config utilities from lib.
 *
 * Usage:
 *   const { config, title } = useRouteConfig(navContext);
 */

import {
    getRouteConfig,
    resolveTitle,
    type NavigationContext,
    type RouteConfig,
} from "@/lib/navigation";
import { useMemo } from "react";

export interface RouteConfigState {
  config: RouteConfig;
  title: string | undefined;
}

export function useRouteConfig(context: NavigationContext): RouteConfigState {
  return useMemo(() => {
    const config = getRouteConfig(context);
    const title = resolveTitle(config, context);
    return { config, title };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.segments, context.worldId, context.userRole, context.isMobile]);
}
