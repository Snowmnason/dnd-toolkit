import { FeatureFlagsManager } from "@/lib/feature-flags";
import { getAppConfig } from "@/lib/config/loader";
import { logger } from "@/lib/utils/logger";
import { useEffect, useState } from "react";

/**
 * Hook to check premium entitlements (FRESH server check on each call)
 *
 * Makes a FRESH call to the server every time the component mounts or userId/entitlementName changes.
 * Includes automatic clock manipulation detection—if device clock is tampered,
 * hook returns `{ granted: false }` to fail-secure.
 *
 * When autoRefresh is enabled, automatically polls the server at configurable intervals
 * to keep entitlement status up-to-date.
 *
 * Priority:
 * 1. User override (admin testing)
 * 2. Fresh server check
 * 3. Last known value (offline)
 *
 * @param entitlementName - Name of the entitlement to check (e.g., "premium", "enterprise")
 * @param userId - User ID to check entitlement for (required)
 * @param autoRefresh - Enable automatic polling (default: false). When true, polls server at regular intervals.
 *
 * @returns { granted, loading, error? }
 *   - `granted`: boolean indicating if user has access
 *   - `loading`: true while fetching from server
 *   - `error`: error message if fetch failed
 *
 * @example
 * ```tsx
 * function PremiumFeature() {
 *   const userId = useUserId(); // from context
 *   // One-time check on mount
 *   const { granted, loading } = useEntitlement("premium", userId, false);
 *
 *   if (loading) return <div>Checking access...</div>;
 *   if (!granted) return <PaywallModal />;
 *
 *   return <FeatureContent />;
 * }
 *
 * function PremiumContent() {
 *   const userId = useUserId();
 *   // Auto-refresh every 5 minutes to catch subscription changes
 *   const { granted, loading } = useEntitlement("premium", userId, true);
 *
 *   if (!granted) return <PaywallModal />;
 *   return <FeatureContent />;
 * }
 * ```
 */
export interface EntitlementStatus {
  granted: boolean;
  loading: boolean;
  error?: string;
  expiresAt?: string | null;
}

export function useEntitlement(
  entitlementName: string,
  userId: string,
  autoRefresh: boolean = false,
): EntitlementStatus {
  const [status, setStatus] = useState<EntitlementStatus>({
    granted: false,
    loading: true,
  });

  useEffect(() => {
    let isMounted = true;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    async function checkEntitlement() {
      if (!userId) {
        logger.warn(
          "ui",
          `useEntitlement: no userId provided for ${entitlementName}`,
        );
        if (isMounted) {
          setStatus({
            granted: false,
            loading: false,
            error: "User ID required",
          });
        }
        return;
      }

      try {
        setStatus((prev) => ({ ...prev, loading: true }));

        // Make FRESH server check
        const result = await FeatureFlagsManager.getEntitlement(
          entitlementName,
          userId,
        );

        if (isMounted) {
          setStatus({
            granted: result.granted,
            loading: false,
            expiresAt: result.expiresAt,
          });

          logger.debug(
            "ui",
            `useEntitlement: ${entitlementName} = ${result.granted} (source: ${result.source})`,
            { userId, source: result.source, expiresAt: result.expiresAt },
          );
        }
      } catch (error) {
        logger.error(
          "ui",
          `useEntitlement: failed to check ${entitlementName}`,
          error,
        );

        if (isMounted) {
          setStatus({
            granted: false,
            loading: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    }

    // Initial check on mount
    checkEntitlement();

    // Set up auto-refresh polling if enabled
    if (autoRefresh) {
      const config = getAppConfig();
      const pollInterval_ms =
        config.remoteConfig?.entitlementPollIntervalMs || 5 * 60 * 1000;

      pollInterval = setInterval(() => {
        logger.debug(
          "ui",
          `useEntitlement: auto-refreshing ${entitlementName} for user ${userId}`,
        );
        checkEntitlement();
      }, pollInterval_ms);

      logger.debug(
        "ui",
        `useEntitlement: enabled auto-refresh for ${entitlementName}`,
        { interval: pollInterval_ms },
      );
    }

    return () => {
      isMounted = false;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [entitlementName, userId, autoRefresh]);

  return status;
}
