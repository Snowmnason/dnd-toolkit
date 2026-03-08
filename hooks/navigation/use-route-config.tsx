/**
 * useRouteConfig
 *
 * Hook that resolves the current route's configuration — title, back target,
 * and full RouteConfig — from a NavigationContext.
 *
 * Replaces direct calls to `getRouteConfig`, `resolveTitle`, and
 * `resolveBackTarget` so layout files never import raw config utilities from lib.
 *
 * Usage:
 *   const { config, title, backTarget } = useRouteConfig(navContext);
 */

import {
    getRouteConfig,
    resolveBackTarget,
    resolveTitle,
    type NavigationContext,
    type RouteConfig,
} from "@/lib/navigation";
import { useMemo } from "react";

export interface RouteConfigState {
  config: RouteConfig;
  title: string | undefined;
  backTarget: string | undefined;
}

export function useRouteConfig(context: NavigationContext): RouteConfigState {
  return useMemo(() => {
    const config = getRouteConfig(context);
    const title = resolveTitle(config, context);
    const backTarget = resolveBackTarget(config, context);
    return { config, title, backTarget };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.segments, context.worldId, context.userRole, context.isMobile]);
}
