/**
 * Nav-Service Middleware
 *
 * Bridge between lib/navigation (manager) and system/Navigation (guard execution).
 *
 * Responsibilities:
 * - Execute guard pipeline via system/Navigation layer
 * - Post-decision analytics via nav-analytics wrapper
 * - Error handling with meaningful feedback
 *
 * Analytics Flow:
 *   AppNav.execute() → recordDecisionAnalytics() → NavAnalytics.trackNavigationDecision()
 *   ↓
 *   Maps decision to analytics event (outcome, reason, timing, context)
 *   ↓
 *   Fire-and-forget to Analytics.track() (consent gated at dispatch layer)
 */

import { NavAnalytics } from '@/lib/analytics/nav-analytics';
import { logger } from '@/lib/utils';
import { AppNav } from '@/system/Navigation';
import type { NavigationContext, NavigationDecision, NavigationGuardConfig } from '@/type-definitions';

/**
 * NavService - Middleware bridge for guard execution and analytics
 *
 * Receives a fully-prepared context and guard list from the manager,
 * delegates guard execution to the system layer, and handles analytics.
 */
export class NavService {
  /**
   * Execute navigation guards via system layer and handle analytics
   *
   * Tracks timing, delegates to system layer, and fires post-decision analytics.
   *
   * @param context Processed navigation context (canonical, with metadata applied)
   * @param guards Guard pipeline to execute (built by manager + policy engine)
   * @returns Navigation decision from guard execution
   */
  static async executeNavigation(
    context: NavigationContext,
    guards: NavigationGuardConfig[],
  ): Promise<NavigationDecision> {
    const startTime = performance.now();

    try {
      logger.category('navigation').debug('NavService: executing guard pipeline', {
        route: context.toRoute,
        guardCount: guards.length,
        guards: guards.map((g) => ({ name: g.name, priority: g.priority })),
      });

      // Delegate to system layer for guard execution
      const decision = await AppNav.execute(context, guards);
      const decisionTimeMs = Math.round(performance.now() - startTime);

      // Post-decision analytics (fire-and-forget)
      NavService.recordDecisionAnalytics(
        decision,
        context,
        guards,
        decisionTimeMs,
      ).catch((err) => {
        logger.category('navigation').warn(
          `Post-decision analytics failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      });

      return decision;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const decisionTimeMs = Math.round(performance.now() - startTime);

      logger.category('navigation').error(`NavService: guard execution failed: ${errorMsg}`);

      // Track error for analytics
      NavService.recordDecisionAnalytics(
        { status: 'abort', error: errorMsg, reason: 'Middleware execution error' },
        context,
        guards,
        decisionTimeMs,
      ).catch((err) => {
        logger.category('navigation').warn(
          `Error analytics failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      });

      return {
        status: 'abort',
        error: errorMsg,
        reason: 'Middleware execution error',
      };
    }
  }

  /**
   * Record navigation decision for analytics
   *
   * Maps NavigationDecision to analytics event structure and calls NavAnalytics.
   * Fire-and-forget — never blocks navigation.
   *
   * @internal
   */
  private static async recordDecisionAnalytics(
    decision: NavigationDecision,
    context: NavigationContext,
    guards: NavigationGuardConfig[],
    decisionTimeMs: number,
  ): Promise<void> {
    // Map decision status to analytics outcome
    let outcome: 'allowed' | 'redirected' | 'aborted' | 'timeout' | 'error';
    let reason: string | undefined;
    let redirectTarget: string | undefined;
    let errorCode: string | undefined;
    let errorMessage: string | undefined;

    switch (decision.status) {
      case 'allow':
        outcome = 'allowed';
        break;

      case 'redirect':
        {
          const redirectDecision = decision as Extract<
            NavigationDecision,
            { status: 'redirect' }
          >;
          outcome = 'redirected';
          reason = redirectDecision.reason;
          redirectTarget = redirectDecision.target;
        }
        break;

      case 'abort':
        {
          const abortDecision = decision as Extract<
            NavigationDecision,
            { status: 'abort' }
          >;
          outcome = 'aborted';
          reason = abortDecision.reason;
          errorMessage =
            abortDecision.error instanceof Error
              ? abortDecision.error.message
              : String(abortDecision.error);
        }
        break;

      case 'modal_then_redirect':
        {
          const modalDecision = decision as Extract<
            NavigationDecision,
            { status: 'modal_then_redirect' }
          >;
          outcome = 'redirected';
          reason = modalDecision.reason;
          redirectTarget = modalDecision.target;
        }
        break;

      default:
        outcome = 'error';
        reason = 'Unknown decision status';
    }

    // Build navigation source from context.triggeredBy
    type NavigationSource = 'user_action' | 'deep_link' | 'back_button' | 'programmatic';
    const sourceMap: Record<string, NavigationSource> = {
      push: 'user_action',
      replace: 'user_action',
      back: 'back_button',
      'deep-link': 'deep_link',
      'url-edit': 'deep_link',
    };
    const source: NavigationSource = (sourceMap[context.triggeredBy] ||
      'programmatic') as NavigationSource;

    // Count parameters
    const paramCount = Object.keys(context.params).length;

    // Track via nav-analytics
    NavAnalytics.trackNavigationDecision({
      decision: {
        outcome,
        reason,
        redirectTarget,
      },
      fromRoute: context.fromRoute,
      toRoute: context.toRoute,
      paramCount,
      guardCount: guards.length,
      decisionTimeMs,
      userId: context.userId,
      worldId: context.worldId,
      source,
      platform: context.platform,
      error: errorCode || errorMessage ? { code: errorCode, message: errorMessage } : undefined,
      throttled: context.throttled,
      throttleIntervalMs: context.throttleIntervalMs,
    });
  }
}
