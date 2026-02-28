/**
 * Use Variant Tracking Hook
 *
 * Simple hook for tracking user engagement with A/B test variants.
 * Provides tracking functions that components can call on user interactions.
 *
 * @example
 * ```tsx
 * export function CharactersV2Screen() {
 *   const { trackEngagement } = useVariantTracking('characters_v2', 'B');
 *
 *   return (
 *     <View>
 *       <Button
 *         onPress={() => {
 *           trackEngagement('edit_button_clicked');
 *           // ... handle click
 *         }}
 *       >
 *         Edit
 *       </Button>
 *     </View>
 *   );
 * }
 * ```
 */

import {
  trackVariantEngagement,
  trackVariantPerformance,
} from "@/lib/analytics";
import { useUserId } from "@/providers";
import { useCallback } from "react";

interface UseVariantTrackingOptions {
  /** Optional metadata to attach to all events from this component */
  metadata?: Record<string, any>;
}

interface UseVariantTrackingReturn {
  /**
   * Track a user engagement action with the variant
   * @param action - Action name (e.g., 'button_click', 'form_submit')
   * @param metadata - Optional event-specific metadata
   */
  trackEngagement: (action: string, metadata?: Record<string, any>) => void;

  /**
   * Track a performance metric for this variant
   * @param metric - Metric name (e.g., 'screen_load_ms', 'api_response_ms')
   * @param value - Numeric metric value
   */
  trackPerformance: (metric: string, value: number) => void;
}

/**
 * Hook for tracking variant engagement in React components
 *
 * Use this to track user interactions with A/B test variants.
 * Automatically includes the current user ID.
 *
 * @param flagName - Feature flag name (e.g., 'characters_v2_screen')
 * @param variant - Variant identifier ('A', 'B', or custom)
 * @param options - Optional configuration
 * @returns Tracking functions to call from event handlers
 */
export function useVariantTracking(
  flagName: string,
  variant: string,
  options?: UseVariantTrackingOptions,
): UseVariantTrackingReturn {
  const userId = useUserId();
  const { metadata: baseMetadata } = options || {};

  const trackEngagement = useCallback(
    (action: string, metadata?: Record<string, any>) => {
      if (!userId) return; // Skip if no user ID

      trackVariantEngagement({
        flagName,
        variant,
        action,
        userId,
        metadata: {
          ...baseMetadata,
          ...metadata,
        },
      });
    },
    [flagName, variant, userId, baseMetadata],
  );

  const trackPerformance = useCallback(
    (metric: string, value: number) => {
      if (!userId) return; // Skip if no user ID

      trackVariantPerformance({
        flagName,
        variant,
        userId,
        metric,
        value,
      });
    },
    [flagName, variant, userId],
  );

  return {
    trackEngagement,
    trackPerformance,
  };
}

export default useVariantTracking;
