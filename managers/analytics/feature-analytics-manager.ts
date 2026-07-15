import { logger } from '@/lib/utils/logger';
import { Analytics } from './analytics-manager';

export type FeatureBlockedReason =
  | 'flag_disabled'
  | 'requires_premium'
  | 'beta_only';

/**
 * Variant assignment event (fired when user is assigned to a variant)
 */
export interface VariantAssignmentEvent {
  flagName: string;
  variant: 'A' | 'B' | string;
  userId: string;
  percentage?: number;
  context?: Record<string, any>;
}

/**
 * Variant engagement event (fired when user interacts with variant feature)
 */
export interface VariantEngagementEvent {
  flagName: string;
  variant: 'A' | 'B' | string;
  action: string; // e.g., "view", "click", "submit", "complete"
  userId: string;
  metadata?: Record<string, any>;
}

/**
 * Variant performance event (fired to track performance metrics per variant)
 */
export interface VariantPerformanceEvent {
  flagName: string;
  variant: 'A' | 'B' | string;
  userId: string;
  metric: string; // e.g., "screen_load_ms", "api_response_ms"
  value: number;
}

/**
 * Feature gating and A/B test variant analytics.
 * Delegates to core Analytics for buffering, consent gating, and offline persistence.
 */
export const FeatureAnalytics = {
  /**
   * Track when a user hits a feature gate (blocked access).
   */
  trackFeatureBlocked(params: {
    feature: string;
    reason: FeatureBlockedReason;
  }): void {
    const { feature, reason } = params;
    Analytics.track('feature_blocked', { feature, reason });
  },
};

/**
 * A/B test and variant tracking.
 * Delegates to core Analytics for buffering, consent gating, and offline persistence.
 */
export const VariantAnalytics = {
  /**
   * Track that a user has been assigned to a variant.
   * Used when evaluating rollouts or route variants to record assignment.
   */
  trackVariantAssignment(event: VariantAssignmentEvent): void {
    try {
      const { flagName, variant, userId, percentage, context } = event;

      logger.category('analytics').debug('Variant assigned', {
        flag: flagName,
        variant,
        percentage,
        userId,
      });

      Analytics.track('variant_assigned', {
        flag_name: flagName,
        variant,
        user_id: userId,
        percentage,
        ...context,
      });
    } catch (error) {
      logger.category('analytics').warn('Failed to track variant assignment', {
        error: String(error),
      });
    }
  },

  /**
   * Track user engagement with a variant feature.
   * Call this when user interacts with the variant-controlled feature.
   */
  trackVariantEngagement(event: VariantEngagementEvent): void {
    try {
      const { flagName, variant, action, userId, metadata } = event;

      logger.category('analytics').debug('Variant engagement tracked', {
        flag: flagName,
        variant,
        action,
        userId,
      });

      Analytics.track('variant_engagement', {
        flag_name: flagName,
        variant,
        user_id: userId,
        action,
        ...metadata,
      });
    } catch (error) {
      logger.category('analytics').warn('Failed to track variant engagement', {
        error: String(error),
      });
    }
  },

  /**
   * Track performance metrics for a variant.
   * Use this to compare performance between variant A and B.
   */
  trackVariantPerformance(event: VariantPerformanceEvent): void {
    try {
      const { flagName, variant, userId, metric, value } = event;

      logger.category('analytics').debug('Variant performance tracked', {
        flag: flagName,
        variant,
        metric,
        value,
        userId,
      });

      Analytics.track('variant_performance', {
        flag_name: flagName,
        variant,
        user_id: userId,
        metric,
        value,
      });
    } catch (error) {
      logger.category('analytics').warn('Failed to track variant performance', {
        error: String(error),
      });
    }
  },
};
