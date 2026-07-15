/**
 * Navigation Manager
 *
 * Domain-specific orchestration for navigation events. Normalizes navigation
 * data and handles event construction before sending to Analytics.track().
 *
 * This module is the **single audit point** for all navigation analytics.
 * All navigation tracking goes through here, no scattered calls to Analytics.track().
 *
 * Usage:
 *   import { NavigationManager } from '@/managers/navigation/navigationManager';
 *
 *   // After guard decision
 *   NavigationManager.trackNavigationResult({
 *     result: { status: 'executed', ... },
 *     target: '/main/world-settings',
 *     // ... more fields
 *   });
 *
 * Integration:
 *   - Called by: `middleware/navigation/nav-service.ts` after guard pipeline
 *   - Calls: `Analytics.track()` (managers/analytics/analytics-manager.ts)
 *   - Types: `type-definitions/transport-types.ts` (NavigationAnalyticsEvent, NavigationEventType)
 *   - Consent: Gated via analytics manager
 */

import { logger } from '@/lib/utils/logger';
import { Analytics } from '@/managers/analytics/analytics-manager';
import {
    NavigationAnalyticsEvent,
    NavigationEventType,
    type NavigationExecutionResult,
} from '@/type-definitions/transport-types';

/**
 * NavigationManager — central hub for navigation event tracking.
 * All navigation events are constructed here for consistent shape and audit trail.
 */
/** Source values as passed from middleware analytics context */
type NavAnalyticsSource = 'user' | 'redirect' | 'deep-link';

export class NavigationManager {
  /**
   * Track a navigation execution result (called by nav-service middleware).
   *
   * Accepts the raw `NavigationExecutionResult` from the system layer plus
   * optional context enrichment from lib. Maps to analytics event shape and
   * delegates to `trackNavigationDecision`. Fire-and-forget — caller does NOT
   * await this.
   *
   * @param params.result     Full result from system/Navigation (includes transaction)
   * @param params.target     Destination route or URL
   * @param params.fromRoute  Source route before navigation
   * @param params.source     Navigation trigger ('user' | 'redirect' | 'deep-link')
   * @param params.paramCount Number of URL params in the request
   */
  static trackNavigationResult(params: {
    result: NavigationExecutionResult;
    target: string;
    fromRoute?: string;
    userId?: string;
    worldId?: string;
    platform?: string;
    source: NavAnalyticsSource;
    paramCount: number;
  }): void {
    const { result } = params;

    // no-op results (back/dismiss success) don't warrant a navigation decision event
    if (result.status === 'no-op') return;

    // Resolve event name directly from result.status — the discriminated union is the source of truth
    const resolvedEventName = NavigationManager.resolveEventName(result);

    // Map NavigationExecutionResult → trackNavigationDecision params
    let outcome: 'allowed' | 'redirected' | 'aborted' | 'timeout' | 'error';
    let reason: string | undefined;
    let redirectTarget: string | undefined;
    let errorMessage: string | undefined;
    let latencyMs = 0;
    let guardCount = 0;

    switch (result.status) {
      case 'executed':
        outcome = 'allowed';
        latencyMs = result.transaction.latencyMs;
        guardCount = result.transaction.guardsExecuted.length;
        break;

      case 'redirected':
        outcome = 'redirected';
        reason = result.reason;
        redirectTarget = result.toRoute;
        latencyMs = result.transaction.latencyMs;
        guardCount = result.transaction.guardsExecuted.length;
        break;

      case 'aborted':
        outcome = result.error ? 'error' : 'aborted';
        reason = result.reason;
        errorMessage = result.error?.message;
        latencyMs = result.transaction.latencyMs;
        guardCount = result.transaction.guardsExecuted.length;
        break;

      case 'ui-required':
        outcome = 'redirected';
        reason = `ui-required:${result.instruction.type}`;
        latencyMs = result.transaction.latencyMs;
        guardCount = result.transaction.guardsExecuted.length;
        break;
    }

    const sourceMap: Record<NavAnalyticsSource, 'user_action' | 'deep_link' | 'back_button' | 'programmatic'> = {
      user: 'user_action',
      redirect: 'programmatic',
      'deep-link': 'deep_link',
    };

    NavigationManager.trackNavigationDecision({
      eventName: resolvedEventName,
      decision: { outcome, reason, redirectTarget },
      fromRoute: params.fromRoute,
      toRoute: params.target,
      paramCount: params.paramCount,
      guardCount,
      decisionTimeMs: latencyMs,
      userId: params.userId,
      worldId: params.worldId,
      source: sourceMap[params.source],
      platform: params.platform,
      error: errorMessage ? { message: errorMessage } : undefined,
    });
  }

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
   * NavigationManager.trackNavigationDecision({
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
  private static trackNavigationDecision(params: {
    eventName: string;
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
    // Construct event
    const event: NavigationAnalyticsEvent = {
      eventName: params.eventName,
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
    NavigationManager.log('info', `Navigation decision: ${eventName}`, {
      from: event.routing.fromRoute,
      to: event.routing.toRoute,
      outcome: event.decision.outcome,
      durationMs: event.performance.decisionTimeMs,
    });

    // Fire to Analytics (consent checking happens at dispatch layer)
    Analytics.track(eventName, payload);
  }

  /**
   * Resolve the analytics event name directly from a NavigationExecutionResult.
   * This is the primary mapping path — derives event name from the discriminated
   * result union rather than re-interpreting free-form reason strings.
   *
   * Guard redirect reasons are matched by exact string to the known policy engine outputs.
   * Unknown redirect reasons fall back to nav_error (conservative — avoids inflating the
   * success bucket with unclassified outcomes).
   *
   * @internal
   */
  private static resolveEventName(result: NavigationExecutionResult): string {
    switch (result.status) {
      case 'executed':
        return NavigationEventType.TransitionAllowed;

      case 'ui-required':
        return NavigationEventType.UiRequired;

      case 'redirected': {
        const reason = result.reason;
        if (reason === 'Authentication required') return NavigationEventType.GuardAuthDenied;
        if (reason === 'Permission verification required') return NavigationEventType.GuardWorldAccess;
        if (reason === 'Admin verification required') return NavigationEventType.GuardAuthDenied;
        if (reason?.startsWith('Guard pipeline: timeout')) return NavigationEventType.GuardTimeout;
        // Unknown redirect reason — conservative fallback; do not inflate success bucket
        return NavigationEventType.NavError;
      }

      case 'aborted':
        return result.error ? NavigationEventType.NavError : NavigationEventType.TransitionAborted;

      default:
        return NavigationEventType.NavError;
    }
  }

  private static getEventNameForOutcome(
    outcome: 'allowed' | 'redirected' | 'aborted' | 'timeout' | 'error',
    reason?: string
  ): string {
    // Build event name based on outcome and reason
    switch (outcome) {
      case 'allowed':
        return NavigationEventType.TransitionAllowed;

      case 'redirected':
        if (reason?.startsWith('ui-required:')) return NavigationEventType.UiRequired;
        if (reason === 'Authentication required') return NavigationEventType.GuardAuthDenied;
        if (reason === 'Permission verification required') return NavigationEventType.GuardWorldAccess;
        if (reason === 'Admin verification required') return NavigationEventType.GuardAuthDenied;
        if (reason?.toLowerCase().includes('platform')) return NavigationEventType.GuardPlatformMismatch;
        // Unknown redirect — conservative fallback
        return NavigationEventType.NavError;

      case 'timeout':
        return NavigationEventType.GuardTimeout;

      case 'error':
        return NavigationEventType.NavError;

      case 'aborted':
        return NavigationEventType.TransitionAborted;

      default:
        return NavigationEventType.NavError;
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
