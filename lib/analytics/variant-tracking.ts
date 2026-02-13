/**
 * A/B Test & Variant Tracking
 *
 * Groundwork for tracking variant assignments and user engagement with A/B tests.
 * This module provides simple tracking utilities that can be expanded with:
 * - Goal/conversion tracking
 * - Performance metrics per variant
 * - Engagement heatmaps
 * - Statistical significance calculations
 *
 * The tracking is lightweight and async to avoid blocking user interactions.
 */

import { logger } from "../utils/logger";

// Lazy import to avoid circular dependency with index.ts
let AnalyticsModule: any = null;
const getAnalytics = () => {
  if (!AnalyticsModule) {
    AnalyticsModule = require("./index");
  }
  return AnalyticsModule.Analytics;
};

/**
 * Variant assignment event (fired when user is assigned to a variant)
 */
export interface VariantAssignmentEvent {
  flagName: string;
  variant: "A" | "B" | string;
  userId: string;
  percentage?: number;
  context?: Record<string, any>;
}

/**
 * Variant engagement event (fired when user interacts with variant feature)
 */
export interface VariantEngagementEvent {
  flagName: string;
  variant: "A" | "B" | string;
  action: string; // e.g., "view", "click", "submit", "complete"
  userId: string;
  metadata?: Record<string, any>;
}

/**
 * Variant performance event (fired to track performance metrics per variant)
 */
export interface VariantPerformanceEvent {
  flagName: string;
  variant: "A" | "B" | string;
  userId: string;
  metric: string; // e.g., "screen_load_ms", "api_response_ms"
  value: number;
}

/**
 * Track that a user has been assigned to a variant
 *
 * Used when evaluating rollouts or route variants to record assignment.
 * This is the groundwork for A/B testing analytics.
 *
 * @example
 * ```ts
 * // In evaluateRouteVariant or similar
 * trackVariantAssignment({
 *   flagName: 'characters_v2_screen',
 *   variant: 'B',
 *   userId: 'user-123',
 *   percentage: 50,
 * });
 * ```
 */
export function trackVariantAssignment(event: VariantAssignmentEvent): void {
  try {
    const { flagName, variant, userId, percentage, context } = event;

    logger.category("analytics").debug("Variant assigned", {
      flag: flagName,
      variant,
      percentage,
      userId,
    });

    // Fire async (non-blocking)
    getAnalytics().track("variant_assigned", {
      flag_name: flagName,
      variant,
      user_id: userId,
      percentage,
      ...context,
    });
  } catch (error) {
    logger.category("analytics").warn("Failed to track variant assignment", {
      error: String(error),
    });
  }
}

/**
 * Track user engagement with a variant feature
 *
 * Call this when user interacts with the variant-controlled feature.
 * Examples: viewing the screen, clicking a button, completing a task.
 *
 * @example
 * ```ts
 * // User viewed the characters v2 screen
 * trackVariantEngagement({
 *   flagName: 'characters_v2_screen',
 *   variant: 'B',
 *   action: 'view',
 *   userId: 'user-123',
 * });
 *
 * // User clicked a UI button on the variant
 * trackVariantEngagement({
 *   flagName: 'characters_v2_screen',
 *   variant: 'B',
 *   action: 'button_click',
 *   userId: 'user-123',
 *   metadata: { button_name: 'edit_character' },
 * });
 * ```
 */
export function trackVariantEngagement(event: VariantEngagementEvent): void {
  try {
    const { flagName, variant, action, userId, metadata } = event;

    logger.category("analytics").debug("Variant engagement tracked", {
      flag: flagName,
      variant,
      action,
      userId,
    });

    // Fire async (non-blocking)
    getAnalytics().track("variant_engagement", {
      flag_name: flagName,
      variant,
      user_id: userId,
      action,
      ...metadata,
    });
  } catch (error) {
    logger.category("analytics").warn("Failed to track variant engagement", {
      error: String(error),
    });
  }
}

/**
 * Track performance metrics for a variant
 *
 * Use this to compare performance between variant A and B.
 * Examples: screen load time, API response time, render duration.
 *
 * @example
 * ```ts
 * // Track screen load time for variant B
 * trackVariantPerformance({
 *   flagName: 'characters_v2_screen',
 *   variant: 'B',
 *   userId: 'user-123',
 *   metric: 'screen_load_ms',
 *   value: 1250,
 * });
 * ```
 */
export function trackVariantPerformance(event: VariantPerformanceEvent): void {
  try {
    const { flagName, variant, userId, metric, value } = event;

    logger.category("analytics").debug("Variant performance tracked", {
      flag: flagName,
      variant,
      metric,
      value,
      userId,
    });

    // Fire async (non-blocking)
    getAnalytics().track("variant_performance", {
      flag_name: flagName,
      variant,
      user_id: userId,
      metric,
      value,
    });
  } catch (error) {
    logger.category("analytics").warn("Failed to track variant performance", {
      error: String(error),
    });
  }
}

/**
 * FUTURE: Batch variant events for efficiency
 *
 * Could collect events locally and send in batches to reduce analytics overhead.
 * This would be useful when tracking high-frequency events.
 *
 * ```ts
 * // Future usage:
 * const batch = new VariantEventBatch('user-123');
 * batch.addEngagement('characters_v2', 'B', 'view');
 * batch.addEngagement('characters_v2', 'B', 'button_click');
 * await batch.flush(); // Send all events at once
 * ```
 */
