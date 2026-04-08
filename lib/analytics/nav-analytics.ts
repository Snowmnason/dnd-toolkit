/**
 * Navigation Analytics Wrapper
 *
 * Domain-specific analytics for navigation events. Normalizes navigation
 * data and handles event construction before sending to Analytics.track().
 *
 * This module is the **single audit point** for all navigation analytics.
 * All navigation tracking goes through here, no scattered calls to Analytics.track().
 *
 * Usage:
 *   import { NavAnalytics } from '@/lib/analytics/nav-analytics';
 *
 *   // After guard decision
 *   NavAnalytics.trackNavigationDecision({
 *     decision: { outcome: 'allowed' },
 *     fromRoute: '/main',
 *     toRoute: '/main/world-settings',
 *     // ... more fields
 *   });
 *
 * Integration:
 *   - Called by: `lib/middleware/navigation/nav-service.ts` after guard pipeline
 *   - Calls: `Analytics.track()` (lib/analytics/analytics-manager.ts)
 *   - Types: `type-definitions/navigation-analytics.ts`
 *   - Consent: Gated via `maps/event-consent-mapping.ts`
 */

import {
    NavigationAnalyticsEvent,
    NavigationEventType,
} from '@/type-definitions/navigation-analytics';

/**
 * NavAnalytics — central hub for navigation event tracking.
 * All navigation events are constructed here for consistent shape and audit trail.
 */
export class NavAnalytics {
  /**
   * Track a navigation decision (outcome of guard pipeline execution).
   *
   * Called from middleware (nav-service) as the SINGLE audit point for all
   * navigation analytics. Includes all metadata collected along the pipeline:
   * hook observations, guard results, decision outcomes, timing data.
   *
   * @param params - Navigation event data (includes context metadata)
   * @param params.decision - Policy decision outcome and reason
   * @param params.fromRoute - Source route (undefined for initial page load)
   * @param params.toRoute - Destination route
   * @param params.paramCount - Number of URL parameters
   * @param params.guardCount - Number of guards that ran
   * @param params.decisionTimeMs - Time from request to decision (ms)
   * @param params.totalTimeMs - Total transaction time including router (ms)
   * @param params.userId - User ID (optional)
   * @param params.worldId - World ID (optional)
   * @param params.source - Navigation trigger source
   * @param params.platform - Platform name (web/ios/android)
   * @param params.timedOutGuard - Name of guard that timed out (if timeout)
   * @param params.redirectTarget - Redirect destination (if redirected)
   * @param params.error - Error details (if error/abort)
   * @param params.throttled - Hook-detected: navigation was throttled
   * @param params.throttleIntervalMs - Hook-detected: throttle window size
   *
   * @example
   * NavAnalytics.trackNavigationDecision({
   *   decision: { outcome: 'aborted', reason: 'throttled' },
   *   fromRoute: '/main',
   *   toRoute: '/main/world-settings',
   *   paramCount: 1,
   *   guardCount: 2,
   *   decisionTimeMs: 8,  // Fast abort, no guard execution
   *   userId: 'user-123',
   *   worldId: 'world-456',
   *   source: 'user_action',
   *   platform: 'web',
   *   throttled: true,
   *   throttleIntervalMs: 300,
   * });
   */
  static trackNavigationDecision(params: {
    decision: {
      outcome: 'allowed' | 'redirected' | 'aborted' | 'timeout' | 'error';
      reason?: string;
      redirectTarget?: string;
    };
    fromRoute?: string;
    toRoute: string;
    paramCount: number;
    guardCount: number;
    decisionTimeMs: number;
    totalTimeMs?: number;
    userId?: string;
    worldId?: string;
    source: 'user_action' | 'deep_link' | 'back_button' | 'programmatic';
    platform?: string;
    timedOutGuard?: string;
    error?: { code?: string; message?: string };
    throttled?: boolean;
    throttleIntervalMs?: number;
  }): void {
    // Import dynamically to avoid circular deps
    const Analytics = require('@/lib/analytics/analytics-manager').Analytics;

    // Construct event
    const event: NavigationAnalyticsEvent = {
      eventName: this.getEventNameForOutcome(params.decision.outcome),
      routing: {
        fromRoute: params.fromRoute,
        toRoute: params.toRoute,
        paramCount: params.paramCount,
      },
      decision: {
        outcome: params.decision.outcome,
        reason: params.decision.reason,
        redirectTarget: params.decision.redirectTarget,
      },
      performance: {
        decisionTimeMs: params.decisionTimeMs,
        totalTimeMs: params.totalTimeMs,
        guardCount: params.guardCount,
        timedOutGuard: params.timedOutGuard,
      },
      context: {
        userId: params.userId,
        worldId: params.worldId,
        source: params.source,
        platform: params.platform,
      },
      error: params.error,
    };

    // Extract eventName for Analytics.track()
    const eventName = event.eventName;

    // build payload without nested objects (flatten for analytics)
    const payload = {
      fromRoute: event.routing.fromRoute,
      toRoute: event.routing.toRoute,
      paramCount: event.routing.paramCount,
      outcome: event.decision.outcome,
      reason: event.decision.reason,
      redirectTarget: event.decision.redirectTarget,
      decisionTimeMs: event.performance.decisionTimeMs,
      totalTimeMs: event.performance.totalTimeMs,
      guardCount: event.performance.guardCount,
      timedOutGuard: event.performance.timedOutGuard,
      userId: event.context.userId,
      worldId: event.context.worldId,
      source: event.context.source,
      platform: event.context.platform,
      errorCode: event.error?.code,
      errorMessage: event.error?.message,
      throttled: params.throttled,
      throttleIntervalMs: params.throttleIntervalMs,
    };

    // Log for audit trail (category-based)
    this.log('info', `Navigation decision: ${eventName}`, {
      from: event.routing.fromRoute,
      to: event.routing.toRoute,
      outcome: event.decision.outcome,
      durationMs: event.performance.decisionTimeMs,
    });

    // Fire to Analytics (consent checking happens at dispatch layer)
    Analytics.track(eventName, payload);
  }

  /**
   * Map navigation decision outcome to event name.
   *
   * @internal
   */
  private static getEventNameForOutcome(
    outcome: 'allowed' | 'redirected' | 'aborted' | 'timeout' | 'error'
  ): string {
    switch (outcome) {
      case 'allowed':
        return NavigationEventType.TransitionSuccess;
      case 'redirected':
        return NavigationEventType.TransitionRedirected;
      case 'aborted':
        return NavigationEventType.TransitionAborted;
      case 'timeout':
        return NavigationEventType.GuardTimeout;
      case 'error':
        return NavigationEventType.NavError;
      default:
        return 'nav_unknown';
    }
  }

  /**
   * Log navigation event for debugging and audit trail.
   *
   * @internal
   */
  private static log(
    level: 'info' | 'warn' | 'error',
    message: string,
    context?: any
  ): void {
    const logger = require('@/system/logger').logger;
    const cat = logger.category('navigation');

    switch (level) {
      case 'info':
        cat.info(message, context);
        break;
      case 'warn':
        cat.warn(message, context);
        break;
      case 'error':
        cat.error(message, context);
        break;
    }
  }
}
