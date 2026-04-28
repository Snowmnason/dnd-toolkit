/**
 * useAppParamsSync
 *
 * Encapsulates all URL→context param synchronization policy:
 *   - seed-on-main:     seed worldId/userRole from URL when context is empty on /main routes
 *   - clear-on-login:   clear all params when entering /login
 *   - clear-world-on-select:  clear world params when entering /select
 *
 * This is domain orchestration (param ownership policy) that does not belong in root
 * layout rendering — extracted from app/_layout.tsx per architecture review.
 */

import { type AccessRole } from "@/hooks/storage";
import { logger } from "@/hooks/utils";
import {
    useAppParamsStable,
    useAppParamsVolatile,
    useUserId,
    useUserRole,
    useWorldId,
} from "@/providers";
import { useLocalSearchParams, useSegments } from "expo-router";
import { useEffect } from "react";

export function useAppParamsSync(): void {
  const urlParams = useLocalSearchParams();
  const segments = useSegments();

  const userId = useUserId();
  const worldId = useWorldId();
  const userRole = useUserRole();
  const { updateVolatileParams, clearWorldParams } = useAppParamsVolatile();
  const { clearAllParams } = useAppParamsStable();

  useEffect(() => {
    const firstSegment = typeof segments[0] === "string" ? segments[0] : "";

    // Main routes: allow initial set from URL only if context is empty; otherwise ignore overrides
    if (firstSegment === "main") {
      const urlWorldId =
        typeof urlParams.worldId === "string" ? urlParams.worldId : undefined;
      const urlUserRole =
        typeof urlParams.userRole === "string" ? (urlParams.userRole as AccessRole) : undefined;

      // If no world in context yet, seed from URL once (owner navigating directly to their world)
      if (!worldId && urlWorldId) {
        logger.category("navigation").info("[NavGuard] Seeding world from URL on main route", {
          urlWorldId,
          urlUserRole,
        });
        updateVolatileParams({ worldId: urlWorldId, userRole: urlUserRole });
      }
      // Skip further processing for main routes to avoid clearing params
      return;
    }

    // Clear params early for login/select before attempting any URL-based updates
    // (prevents a URL-bearing deep link from briefly writing params that are immediately cleared)
    if (segments[0] === "login" && (userId || worldId || userRole)) {
      clearAllParams();
      return;
    }
    if (segments[0] === "select" && (worldId || userRole)) {
      clearWorldParams();
      return;
    }

    const currentWorldId =
      typeof urlParams.worldId === "string" ? urlParams.worldId : undefined;
    const currentUserRole =
      typeof urlParams.userRole === "string" ? (urlParams.userRole as AccessRole) : undefined;

    // Only update if values are different from context (userId is loaded from storage, not URL)
    let shouldUpdate = false;
    const updates: { worldId?: string; userRole?: AccessRole } = {};
    if (currentWorldId && currentWorldId !== worldId) {
      updates.worldId = currentWorldId;
      shouldUpdate = true;
    }
    if (currentUserRole && currentUserRole !== userRole) {
      updates.userRole = currentUserRole;
      shouldUpdate = true;
    }

    if (shouldUpdate) {
      updateVolatileParams(updates);
    }
  }, [
    urlParams,
    segments,
    updateVolatileParams,
    clearAllParams,
    clearWorldParams,
    userId,
    worldId,
    userRole,
  ]);
}
