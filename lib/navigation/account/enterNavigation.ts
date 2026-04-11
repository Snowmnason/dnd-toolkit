/**
 * Enter Navigation Determination
 *
 * Centralizes navigation decisions for entry flows: sign-in, sign-up, re-auth.
 * Determines where users go after successfully authenticating.
 *
 * Navigation Tree:
 * - SIGN-IN: Profile incomplete → /login/complete-profile, Profile complete → /select/world-selection
 * - SIGN-UP: After account creation → /login/complete-profile (continue profile)
 * - RE-AUTH: Bootstrap (staleness-based) vs other contexts (profile-based)
 *
 * @module lib/navigation/account/enter-navigation
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
 * Entry flow type.
 */
export type EntryFlowType = 'signin' | 'signup' | 'reauth';

/**
 * Context for re-auth navigation determination.
 */
export type ReAuthContext = 'bootstrap' | 'oauth' | 'email-link' | 'password-reset' | 'recovery';

/**
 * User type (minimal subset needed for navigation decisions).
 */
export interface NavigationUser {
  id?: string;
  username?: string;
}

// ============================================================================
// ENTER NAVIGATION
// ============================================================================

/**
 * Determines where to send user after entry flow (sign-in, sign-up, re-auth).
 *
 * Logic varies by flow type:
 *
 * **Sign-In**:
 * - Profile incomplete (profileCompleted === false) → /login/complete-profile
 * - No profile or incomplete username → /login/complete-profile
 * - Complete profile → /select/world-selection
 *
 * **Sign-Up**:
 * - Always → /login/complete-profile (continue onboarding)
 *
 * **Re-Auth**:
 * - Bootstrap context: staleness-based routing (fresh → world-selection, stale → welcome, dead → login)
 * - Other contexts: check profileCompleted first, then profile-based routing (same as sign-in)
 *
 * @param flowType - Type of entry flow (signin, signup, reauth)
 * @param user - User profile (null if doesn't exist)
 * @param worldIds - Array of world IDs user has access to
 * @param stalenessPhase - Data staleness phase (only for reauth, optional)
 * @param reAuthContext - Re-auth context (only for reauth, optional)
 * @param profileCompleted - Profile completion flag (null/undefined = normal logged-in, false = needs completion, true = completed)
 * @returns Navigation decision with redirect path and reason
 *
 * @example
 * // Sign-in with complete profile
 * const decision = determineEnterRedirect('signin', user, ['world-1'], undefined, undefined, true);
 * // Returns: { redirect: '/select/world-selection', reason: 'Profile complete with 1 world' }
 *
 * @example
 * // Sign-up (always redirect to profile completion)
 * const decision = determineEnterRedirect('signup', null, [], undefined, undefined, false);
 * // Returns: { redirect: '/login/complete-profile', reason: 'New account, continue onboarding' }
 */
export function determineEnterRedirect(
  flowType: EntryFlowType,
  user: NavigationUser | null,
  worldIds: string[] = [],
  stalenessPhase?: 'fresh' | 'stale' | 'dead',
  reAuthContext?: ReAuthContext,
  profileCompleted?: boolean | null
): NavigationDecision {
  // =========================================================================
  // SIGN-UP FLOW: Always redirect to profile completion
  // =========================================================================
  if (flowType === 'signup') {
    const decision = {
      redirect: '/login/complete-profile',
      reason: 'New account, continue onboarding',
    };
    logger.category('auth').info('Enter nav (sign-up): Redirecting to profile completion', decision);
    return decision;
  }

  // =========================================================================
  // RE-AUTH FLOW: Context-dependent routing
  // =========================================================================
  if (flowType === 'reauth') {
    // Bootstrap context: Use staleness phase
    if (reAuthContext === 'bootstrap') {
      if (!stalenessPhase) {
        stalenessPhase = 'fresh'; // Default to fresh if not provided
      }

      if (stalenessPhase === 'dead') {
        const decision = {
          redirect: '/login',
          reason: 'Data too old (> 30 days), require manual sign-in',
        };
        logger.category('auth').info('Enter nav (re-auth bootstrap): Dead data, redirecting to login', decision);
        return decision;
      }

      if (stalenessPhase === 'stale') {
        const decision = {
          redirect: '/welcome',
          reason: 'Stale data restored (7-30 days old)',
        };
        logger.category('auth').info('Enter nav (re-auth bootstrap): Stale data, redirecting to welcome', decision);
        return decision;
      }

      // Fresh data (< 7 days)
      const decision = {
        redirect: '/select/world-selection',
        reason: 'Fresh data restored (< 7 days)',
      };
      logger.category('auth').info('Enter nav (re-auth bootstrap): Fresh data, redirecting to world selection', decision);
      return decision;
    }

    // Other contexts (oauth, email-link, password-reset, recovery): Use profile-based routing
    logger.category('auth').debug(`Enter nav (re-auth ${reAuthContext}): Using profile-based routing`);
    // Fall through to profile-based logic below
  }

  // =========================================================================
  // SIGN-IN & RE-AUTH (NON-BOOTSTRAP): Profile-based routing
  // =========================================================================

  // Check profile completion flag first (only set to false during signup)
  if (profileCompleted === false) {
    const decision = {
      redirect: '/login/complete-profile',
      reason: 'Profile completion in progress (flag: false)',
    };
    logger.category('auth').debug(`Enter nav (${flowType}): Profile incomplete flag, redirecting to completion`, decision);
    return decision;
  }

  if (!user) {
    const decision = {
      redirect: '/login/complete-profile',
      reason: 'No user profile found',
    };
    logger.category('auth').debug(`Enter nav (${flowType}): No profile, redirecting to completion`, decision);
    return decision;
  }

  if (!user.username) {
    const decision = {
      redirect: '/login/complete-profile',
      reason: 'Username is missing',
    };
    logger.category('auth').debug(`Enter nav (${flowType}): Incomplete profile, redirecting to completion`, decision);
    return decision;
  }

  const decision = {
    redirect: '/select/world-selection',
    reason: `Profile complete (${worldIds.length} world${worldIds.length === 1 ? '' : 's'})`,
  };
  logger.category('auth').debug(`Enter nav (${flowType}): Profile complete, redirecting to world selection`, decision);
  return decision;
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Determines safe fallback redirect on enter navigation determination errors.
 *
 * @param flowType - The entry flow type where error occurred
 * @returns Navigation decision with safe fallback
 *
 * @example
 * const decision = determineEnterErrorRedirect('signin');
 * // Returns: { redirect: '/welcome', reason: 'Error determining sign-in redirect' }
 */
export function determineEnterErrorRedirect(flowType: EntryFlowType): NavigationDecision {
  const decision = {
    redirect: '/welcome',
    reason: `Error determining ${flowType} redirect`,
  };
  logger.category('auth').warn(`Enter nav error (${flowType}): Redirecting to welcome`, decision);
  return decision;
}
