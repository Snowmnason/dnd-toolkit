import {
    FeatureFlagsManager
} from "@/lib/feature-flags";
import { logger } from "@/lib/utils/logger";
import { useEffect, useState } from "react";

/**
 * Hook to check premium entitlements (FRESH server check on each call)
 *
 * Makes a FRESH call to the server every time the component mounts or userId/entitlementName changes.
 * Includes automatic clock manipulation detection—if device clock is tampered,
 * hook returns `{ granted: false }` to fail-secure.
 *
 * Priority:
 * 1. User override (admin testing)
 * 2. Fresh server check
 * 3. Last known value (offline)
 *
 * @param entitlementName - Name of the entitlement to check (e.g., "premium", "enterprise")
 * @param userId - User ID to check entitlement for (required)
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
 *   const { granted, loading } = useEntitlement("premium", userId);
 *
 *   if (loading) return <div>Checking access...</div>;
 *   if (!granted) return <PaywallModal />;
 *
 *   return <FeatureContent />;
 * }
 * ```
 */
export interface EntitlementStatus {
  granted: boolean;
  loading: boolean;
  error?: string;
}

export function useEntitlement(
  entitlementName: string,
  userId: string,
): EntitlementStatus {
  const [status, setStatus] = useState<EntitlementStatus>({
    granted: false,
    loading: true,
  });

  useEffect(() => {
    let isMounted = true;

    async function checkEntitlement() {
      if (!userId) {
        logger.warn("ui", `useEntitlement: no userId provided for ${entitlementName}`);
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
        const result = await FeatureFlagsManager.getEntitlement(entitlementName, userId);

        if (isMounted) {
          setStatus({
            granted: result.granted,
            loading: false,
          });

          logger.debug(
            "ui",
            `useEntitlement: ${entitlementName} = ${result.granted} (source: ${result.source})`,
            { userId, source: result.source },
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

    checkEntitlement();

    return () => {
      isMounted = false;
    };
  }, [entitlementName, userId]);

  return status;
}
