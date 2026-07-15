import { Analytics } from '@/managers/analytics/analytics-manager';
import { currentConsentLevel } from '@/type-definitions/analytics-types';
import { useEffect } from 'react';

export interface UseAnalyticsReturn {
  /**
   * Track a user interaction within this component.
   * Only recorded if consent level is 'full'.
   */
  trackInteraction: (action: string, detail?: Record<string, any>) => void;

  /**
   * Wrap an async operation to measure its duration.
   * Automatically records performance event (success/failure) if consent is 'full'.
   * Throws the original error if operation fails.
   */
  trackPerformance: <T>(
    operationName: string,
    operation: () => Promise<T>,
  ) => Promise<T>;
}

/**
 * Hook for component-level analytics tracking.
 *
 * Automatically tracks component mount/unmount with duration.
 * Provides helpers for tracking interactions and measuring performance.
 *
 * @param componentName - Name of the component for event labeling
 * @returns Object with tracking methods
 */
export function useAnalytics(componentName: string): UseAnalyticsReturn {
  // Auto-track lifecycle (mount/unmount with duration)
  useEffect(() => {
    const componentMountTime = Date.now();

    if (currentConsentLevel === 'full') {
      Analytics.trackComponentUsage({
        component: componentName,
        action: 'mount',
      });
    }

    return () => {
      if (currentConsentLevel === 'full') {
        const duration = Date.now() - componentMountTime;
        Analytics.trackComponentUsage({
          component: componentName,
          action: 'unmount',
          detail: { durationMs: duration },
        });
      }
    };
  }, [componentName]);

  // Track user interactions
  const trackInteraction = (action: string, detail?: Record<string, any>) => {
    if (currentConsentLevel === 'full') {
      Analytics.trackComponentUsage({
        component: componentName,
        action,
        detail,
      });
    }
  };

  // Track async operations with timing
  const trackPerformance = async <T,>(
    operationName: string,
    operation: () => Promise<T>,
  ): Promise<T> => {
    const start = performance.now();
    try {
      const result = await operation();
      if (currentConsentLevel === 'full') {
        const duration = performance.now() - start;
        Analytics.trackComponentUsage({
          component: componentName,
          action: 'performance',
          detail: { operationName, durationMs: duration, success: true },
        });
      }
      return result;
    } catch (error) {
      if (currentConsentLevel === 'full') {
        const duration = performance.now() - start;
        Analytics.trackComponentUsage({
          component: componentName,
          action: 'performance',
          detail: { operationName, durationMs: duration, success: false },
        });
      }
      throw error;
    }
  };

  return {
    trackInteraction,
    trackPerformance,
  };
}

/**
 * Hook for initializing analytics session and user context.
 * Tracks user identification and session start/end for analytics.
 *
 * Call in app layout or auth context when user login state changes.
 *
 * @param userId - User ID if logged in, undefined/null if logged out
 */
export function useAnalyticsSession(userId?: string | null): void {
  useEffect(() => {
    Analytics.initializeSession(userId);
  }, [userId]);
}

