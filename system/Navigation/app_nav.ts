/**
 * AppNav Orchestrator - System Layer Navigation Hub
 *
 * Family-based architecture for navigation execution:
 * 1. Route Transitions - Full validation, guard pipeline, push/replace
 * 2. History Transitions - Minimal validation, back/dismiss operations
 * 3. Utility Transitions - Simple operations (setParams, prefetch)
 * 4. External Transitions - URL/web link opening
 * 5. State Queries - Pure read-only operations (getCurrentRoute, canGoBack, etc)
 *
 * Responsibilities:
 * - Execute pre-validated NavigationRequest objects from middleware
 * - Run guard pipeline only when needed (route transitions)
 * - Delegate all transport operations to transport_adapter
 * - Return typed NavigationExecutionResult
 *
 * Constraints:
 * - No lib imports (only types from @/type-definitions)
 * - No validation logic (middleware/lib does that)
 * - No business decisions (guards come pre-prepared from lib)
 * - Guards array is optional (can be undefined or empty)
 *
 * App-agnostic: designed to work with any routing system.
 */

import { logger } from '@/lib/utils';
import type {
    NavigationContext,
    NavigationDecision,
    NavigationExecutionResult,
    NavigationGuardConfig,
    NavigationRequest,
    NavigationTransaction,
} from '@/type-definitions';
import * as transportAdapter from './expo-router/transport_adapter';
import { executeGuardPipeline } from './guard_executor';
import { TransactionRunner } from './transaction_runner';

/**
 * ============================================================================
 * ROUTE TRANSITIONS - Full validation, guard pipeline, route push/replace
 * ============================================================================
 *
 * Route transitions require:
 * - Guard pipeline execution (if guards provided)
 * - Route action (push/replace/dismissTo)
 * - Full context and params
 *
 * Called by: lib/middleware/nav-service for route navigation requests
 * Typically called with guards pre-prepared by lib
 */
export async function executeRouteTransitionNav(
  request: NavigationRequest,
  guardsToRun?: NavigationGuardConfig[],
  callerContext?: NavigationContext
): Promise<NavigationExecutionResult> {
  const triggerType = request.action === 'replace' ? 'replace' : request.action === 'dismissTo' ? 'dismiss' : 'push';
  const transaction = new TransactionRunner('', request.target, triggerType);
  const transactionId = transaction.getId();

  // Use caller-provided context (enriched with userId/worldId from navManager)
  // or fall back to a minimal context derived from the request.
  const context: NavigationContext = callerContext ?? {
    toRoute: request.target,
    triggeredBy: request.source === 'deeplink' ? 'deep-link' : request.source === 'direct' ? 'user' : 'redirect',
    platform: 'web',
  };

  try {
    logger.category('navigation').debug(
      `Transaction ${transactionId} started: Route transition to ${request.target} (action: ${request.action})`
    );

    // Run guard pipeline if guards provided
    if (guardsToRun && guardsToRun.length > 0) {
      const pipelineResult = await executeGuardPipeline(guardsToRun, context);
      const decision = pipelineResult.decision;

      if (decision.status !== 'allow') {
        logger.category('navigation').debug(
          `Transaction ${transactionId} guard decision: ${decision.status}`
        );

        const elapsedMs = transaction.getElapsedMs();

        if (decision.status === 'redirect') {
          // Guard-driven correction redirect — use replace so the denied route is not in history
          transportAdapter.executeRouterReplace(decision.target);
          return {
            status: 'redirected',
            toRoute: decision.target,
            reason: decision.reason,
            transaction: createTransactionRecord(
              { ...context, toRoute: decision.target },
              decision,
              [],
              elapsedMs
            ),
          };
        }

        if (decision.status === 'modal_then_redirect') {
          // Guard wants UI intervention (modal) before redirect. For now, execute the redirect
          // directly. Future: enhance to return ui-required with redirect target in instruction.
          transportAdapter.executeRouterReplace(decision.target);
          return {
            status: 'redirected',
            toRoute: decision.target,
            reason: decision.reason,
            transaction: createTransactionRecord(
              { ...context, toRoute: decision.target },
              decision,
              [],
              elapsedMs
            ),
          };
        }

        // decision.status === 'abort'
        return {
          status: 'aborted',
          reason: decision.reason,
          transaction: createTransactionRecord(context, decision, [], elapsedMs),
        };
      }
    }

    // Guard pipeline passed (or was empty), execute route transition
    switch (request.action) {
      case 'push':
        transportAdapter.executeRouterPush(request.target, request.params);
        break;

      case 'replace':
        transportAdapter.executeRouterReplace(request.target, request.params);
        break;

      case 'dismissTo':
        transportAdapter.executeRouterDismissTo(request.target, request.params);
        break;

      default:
        throw new Error(`Unsupported route transition action: ${request.action}`);
    }

    const elapsedMs = transaction.getElapsedMs();
    logger.category('navigation').debug(
      `Transaction ${transactionId} executed in ${elapsedMs}ms`
    );

    return {
      status: 'executed',
      toRoute: request.target,
      transaction: createTransactionRecord(
        context,
        { status: 'allow' },
        [],
        elapsedMs
      ),
    };
  } catch (error) {
    const elapsedMs = transaction.getElapsedMs();
    logger.category('navigation').error(
      `Transaction ${transactionId} failed in ${elapsedMs}ms: ${error instanceof Error ? error.message : String(error)}`
    );

    return {
      status: 'aborted',
      reason: error instanceof Error ? error.message : 'Unknown error',
      error: error instanceof Error ? error : new Error(String(error)),
      transaction: createTransactionRecord(
        context,
        { status: 'abort', reason: 'System error', error: error instanceof Error ? error : undefined },
        [],
        elapsedMs
      ),
    };
  }
}

/**
 * ============================================================================
 * HISTORY TRANSITIONS - Minimal validation, back/dismiss operations
 * ============================================================================
 *
 * History transitions require minimal overhead:
 * - No guard pipeline
 * - Simple back/dismiss operations
 * - Optional target for dismissTo
 *
 * Called by: lib/middleware/nav-service for back button, dismissals
 */
export async function executeHistoryTransitionNav(
  action: 'back' | 'dismiss' | 'dismissAll' | 'dismissTo',
  target?: string
): Promise<NavigationExecutionResult> {
  const transaction = new TransactionRunner('', target || '', action === 'back' ? 'back' : 'dismiss');
  const transactionId = transaction.getId();

  try {
    logger.category('navigation').debug(
      `Transaction ${transactionId} started: History transition (action: ${action})`
    );

    switch (action) {
      case 'back':
        transportAdapter.executeRouterBack();
        break;

      case 'dismiss':
        transportAdapter.executeRouterDismiss();
        break;

      case 'dismissAll':
        transportAdapter.executeRouterDismissAll();
        break;

      case 'dismissTo':
        if (!target) {
          throw new Error('dismissTo requires target parameter');
        }
        transportAdapter.executeRouterDismissTo(target);
        break;

      default:
        throw new Error(`Unsupported history transition action: ${action}`);
    }

    const elapsedMs = transaction.getElapsedMs();
    logger.category('navigation').debug(
      `Transaction ${transactionId} executed in ${elapsedMs}ms`
    );

    // History operations are simple and don't need transaction record
    return {
      status: 'no-op',
      reason: `History action completed: ${action}`,
    };
  } catch (error) {
    const elapsedMs = transaction.getElapsedMs();
    logger.category('navigation').error(
      `Transaction ${transactionId} failed in ${elapsedMs}ms: ${error instanceof Error ? error.message : String(error)}`
    );

    const context: NavigationContext = {
      toRoute: target || action,
      triggeredBy: 'user',
      platform: 'web',
    };

    return {
      status: 'aborted',
      reason: error instanceof Error ? error.message : 'Unknown error',
      error: error instanceof Error ? error : new Error(String(error)),
      transaction: createTransactionRecord(
        context,
        { status: 'abort', reason: 'System error', error: error instanceof Error ? error : undefined },
        [],
        elapsedMs
      ),
    };
  }
}

/**
 * ============================================================================
 * UTILITY TRANSITIONS - Simple operations
 * ============================================================================
 *
 * Utility transitions for simple state/navigation operations:
 * - setParams: Update URL parameters without navigation
 * - prefetch: Prefetch a route in background
 *
 * Called by: lib/middleware/nav-service for utility operations
 */
export async function executeUtilityTransitionNav(
  action: 'setParams' | 'prefetch',
  params?: Record<string, any>
): Promise<NavigationExecutionResult> {
  const transaction = new TransactionRunner('', action, 'url-edit');
  const transactionId = transaction.getId();

  try {
    logger.category('navigation').debug(
      `Transaction ${transactionId} started: Utility transition (action: ${action})`
    );

    switch (action) {
      case 'setParams':
        if (!params) {
          throw new Error('setParams requires params object');
        }
        transportAdapter.executeRouterSetParams(params);
        break;

      case 'prefetch':
        if (!params?.target) {
          throw new Error('prefetch requires target in params');
        }
        transportAdapter.executeRouterPrefetch(params.target);
        break;

      default:
        throw new Error(`Unsupported utility transition action: ${action}`);
    }

    const elapsedMs = transaction.getElapsedMs();
    logger.category('navigation').debug(
      `Transaction ${transactionId} executed in ${elapsedMs}ms`
    );

    return {
      status: 'no-op',
      reason: `Utility action completed: ${action}`,
    };
  } catch (error) {
    const elapsedMs = transaction.getElapsedMs();
    logger.category('navigation').error(
      `Transaction ${transactionId} failed in ${elapsedMs}ms: ${error instanceof Error ? error.message : String(error)}`
    );

    const context: NavigationContext = {
      toRoute: action,
      triggeredBy: 'redirect',
      platform: 'web',
    };

    return {
      status: 'aborted',
      reason: error instanceof Error ? error.message : 'Unknown error',
      error: error instanceof Error ? error : new Error(String(error)),
      transaction: createTransactionRecord(
        context,
        { status: 'abort', reason: 'System error', error: error instanceof Error ? error : undefined },
        [],
        elapsedMs
      ),
    };
  }
}

/**
 * ============================================================================
 * EXTERNAL TRANSITIONS - URL/web link opening
 * ============================================================================
 *
 * External transitions for opening URLs:
 * - No guard pipeline
 * - No route validation
 * - Simple URL passthrough
 *
 * Called by: lib/middleware/nav-service for external links
 */
export async function executeExternalTransitionNav(
  url: string,
  options?: { trusted?: boolean }
): Promise<NavigationExecutionResult> {
  const transaction = new TransactionRunner('', url, 'deep-link');
  const transactionId = transaction.getId();

  // Hoist context so it's available in both try and catch
  const context: NavigationContext = {
    toRoute: url,
    triggeredBy: 'deep-link',
    platform: 'web',
  };

  try {
    logger.category('navigation').debug(
      `Transaction ${transactionId} started: External link (url: ${url})`
    );

    await transportAdapter.executeOpenWeb(url, options);

    const elapsedMs = transaction.getElapsedMs();
    logger.category('navigation').debug(
      `Transaction ${transactionId} executed in ${elapsedMs}ms`
    );

    return {
      status: 'executed',
      toRoute: url,
      transaction: createTransactionRecord(context, { status: 'allow' }, [], elapsedMs),
    };
  } catch (error) {
    const elapsedMs = transaction.getElapsedMs();
    logger.category('navigation').error(
      `Transaction ${transactionId} failed in ${elapsedMs}ms: ${error instanceof Error ? error.message : String(error)}`
    );

    return {
      status: 'aborted',
      reason: error instanceof Error ? error.message : 'Unknown error',
      error: error instanceof Error ? error : new Error(String(error)),
      transaction: createTransactionRecord(
        context,
        { status: 'abort', reason: 'External link failed', error: error instanceof Error ? error : undefined },
        [],
        elapsedMs
      ),
    };
  }
}

/**
 * ============================================================================
 * STATE QUERIES - Pure read-only operations
 * ============================================================================
 *
 * State query operations for reading current navigation state:
 * - No side effects
 * - No transaction tracking
 * - Direct passthrough to transport adapter
 *
 * Called by: lib/middleware/nav-service or directly from hooks
 */
export function executeStateQueriesNav(
  action: 'getCurrentRoute' | 'getCurrentParams' | 'canGoBack' | 'canDismiss'
): any {
  try {
    logger.category('navigation').debug(`State query: ${action}`);

    switch (action) {
      case 'getCurrentRoute':
        return transportAdapter.getCurrentRoute();

      case 'getCurrentParams':
        return transportAdapter.getCurrentParams();

      case 'canGoBack':
        return transportAdapter.canRouterGoBack();

      case 'canDismiss':
        return transportAdapter.canRouterDismiss();

      default:
        throw new Error(`Unsupported state query action: ${action}`);
    }
  } catch (error) {
    logger.category('navigation').error(
      `State query failed (${action}): ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}

/**
 * ============================================================================
 * UTILITY: Transaction Record Creation
 * ============================================================================
 */

/**
 * Create a transaction snapshot for audit/analytics
 * Useful for recording the full transaction state after execution.
 *
 * @param context Navigation context
 * @param decision Final decision
 * @param guardsExecuted List of guards that ran
 * @param elapsedMs Time elapsed
 * @returns Transaction record
 */
function createTransactionRecord(
  context: NavigationContext,
  decision: NavigationDecision,
  guardsExecuted: {
    name: string;
    priority: 'pre' | 'normal' | 'post';
    status: 'allowed' | 'denied' | 'error';
    durationMs: number;
  }[],
  elapsedMs: number
): NavigationTransaction {
  return {
    id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    status:
      decision.status === 'allow'
        ? 'allow'
        : decision.status === 'redirect'
          ? 'redirect'
          : decision.status === 'abort'
            ? 'abort'
            : 'modal',
    fromRoute: context.fromRoute,
    toRoute: context.toRoute,
    decision,
    latencyMs: elapsedMs,
    timestamp: Date.now(),
    userId: context.userId,
    guardsExecuted: guardsExecuted.map((g) => g.name),
  };
}
