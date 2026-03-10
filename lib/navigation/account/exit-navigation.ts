/**
 * Exit Navigation Determination
 *
 * Centralizes navigation decisions for exit flows: sign-out, delete account.
 * Determines where users go after leaving their account (authenticated → unauthenticated).
 *
 * Navigation Tree:
 * - SIGN-OUT: Always → /login
 * - DELETE-ACCOUNT: Always → /login
 *
 * Both exit flows redirect to the same destination (login screen) with different reasons.
 *
 * @module lib/navigation/account/exit-navigation
 */

import { logger } from '@/lib/utils/logger';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Navigation decision with route and reasoning.
 */
export interface NavigationDecision {
  redirect: string;
  reason: string;
}

/**
 * Exit flow type.
 */
export type ExitFlowType = 'signout' | 'delete';

// ============================================================================
// EXIT NAVIGATION
// ============================================================================

/**
 * Determines where to send user after exit flow (sign-out, delete account).
 *
 * All exit flows redirect to login screen, but with different reasons for logging.
 *
 * @param flowType - Type of exit flow (signout, delete)
 * @returns Navigation decision with redirect path and reason
 *
 * @example
 * const decision = determineExitRedirect('signout');
 * // Returns: { redirect: '/login', reason: 'User signed out' }
 *
 * @example
 * const decision = determineExitRedirect('delete');
 * // Returns: { redirect: '/login', reason: 'Account deleted' }
 */
export function determineExitRedirect(flowType: ExitFlowType): NavigationDecision {
  let reason: string;

  if (flowType === 'signout') {
    reason = 'User signed out';
  } else if (flowType === 'delete') {
    reason = 'Account deleted';
  } else {
    reason = 'User exited account';
  }

  const decision = {
    redirect: '/login',
    reason,
  };

  logger.category('auth').info(`Exit nav (${flowType}): Redirecting to login`, decision);
  return decision;
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Determines fallback redirect on exit navigation determination errors.
 *
 * Even on error, redirects to login screen (safest state).
 *
 * @param flowType - The exit flow type where error occurred
 * @returns Navigation decision with /login fallback
 *
 * @example
 * const decision = determineExitErrorRedirect('signout');
 * // Returns: { redirect: '/login', reason: 'Error during sign-out, logout anyway' }
 */
export function determineExitErrorRedirect(flowType: ExitFlowType): NavigationDecision {
  const decision = {
    redirect: '/login',
    reason: `Error during ${flowType}, logout anyway`,
  };

  logger.category('auth').warn(`Exit nav error (${flowType}): Redirecting to login`, decision);
  return decision;
}
