/**
 * Navigation Decision & Context Types
 *
 * Core types for the route middleware system.
 * These define the contract between the navigation pipeline layers:
 * - NavigationContext: input to middleware
 * - NavigationDecision: output from guards
 * - NavigationTransaction: full tracking record
 * - NavigationPolicyMode: app-level policy setting
 *
 * Importable everywhere—no layer hierarchy restrictions.
 * Used by pure-algo-immutables, system/navigation, lib/navigation, and hooks.
 */

/**
 * NavigationPolicyMode - Switchable access policy for the entire app
 * 
 * - 'protected_by_default': Routes are protected by default; only explicitly public routes allow access
 *   (current app model: auth-first)
 * - 'public_by_default': Routes are public by default; only explicitly protected routes require auth
 *   (future app model: public-first, opt-in auth)
 */
export type NavigationPolicyMode = 'protected_by_default' | 'public_by_default';

/**
 * NavigationContext - Full context passed to the middleware pipeline
 *
 * Describes the navigation attempt from the guard's perspective.
 * Includes route, params, triggering source, current user/world state,
 * and hook-collected metadata for analytics.
 *
 * Data flow:
 *   Hook collects metadata (throttle, etc.) → adds to context
 *   Manager validates/canonicalizes context
 *   Middleware passes complete context + decision to analytics
 *   Analytics has ALL data available in one place
 */
export interface NavigationContext {
  /** Route the user is navigating FROM (e.g., '/main/world-list') */
  fromRoute: string;

  /** Route the user is navigating TO (e.g., '/select/world-selection') */
  toRoute: string;

  /** Canonicalized TO route (lowercase, trimmed, normalized) */
  canonicalRoute: string;

  /** Route parameters passed in the navigation action */
  params: Record<string, any>;

  /** Source of the navigation action */
  triggeredBy: 'push' | 'replace' | 'back' | 'deep-link' | 'url-edit';

  /** User ID if authenticated, undefined if not */
  userId?: string;

  /** World ID if a world is selected, undefined if not */
  worldId?: string;

  /** User role in the current world (if worldId is set) */
  userRole?: 'owner' | 'admin' | 'member' | 'viewer';

  /** Subscription tier of the current user (if authenticated) */
  subscriptionTier?: 'free' | 'premium' | 'enterprise';

  /** Additional platform info (mobile, desktop, web) */
  platform?: 'mobile' | 'desktop' | 'web';

  // ─── Hook-collected metadata for analytics ────────────────────────────────
  // These fields are optional and populated by hooks when relevant.
  // They flow down the pipeline and are included in analytics events.

  /** True if navigation was throttled by hook-level rate limiting */
  throttled?: boolean;

  /** Throttle interval used (ms) if throttled */
  throttleIntervalMs?: number;
}

/**
 * NavigationDecision - Result of guard pipeline execution
 *
 * Represents the outcome after all guards have run.
 * One of: allow, redirect, abort, or modal_then_redirect.
 */
export type NavigationDecision =
  | { status: 'allow' }
  | { status: 'redirect'; target: string; reason: string }
  | { status: 'abort'; error: Error | string; reason: string }
  | {
      status: 'modal_then_redirect';
      modal: { type: string; props?: Record<string, any> };
      target?: string;
      reason: string;
    };

/**
 * NavigationTransaction - Complete tracking record of a navigation attempt
 *
 * Recorded by the system layer for auditing, analytics, and debugging.
 * One record per navigation action.
 */
export interface NavigationTransaction {
  /** Unique transaction ID (UUID v4) */
  id: string;

  /** Current status of this transaction */
  status: 'pending' | 'allowed' | 'denied' | 'aborted' | 'redirected';

  /** Route the user navigated FROM */
  fromRoute: string;

  /** Route the user navigated TO */
  toRoute: string;

  /** Final decision from the guard pipeline */
  decision: NavigationDecision;

  /** Milliseconds from start to decision */
  latencyMs: number;

  /** Timestamp when transaction was created */
  timestamp: Date;

  /** User ID (if available) */
  userId?: string;

  /** List of guards that ran and their results */
  guardsExecuted?: {
    name: string;
    priority: 'pre' | 'normal' | 'post';
    status: 'allowed' | 'denied' | 'error';
    durationMs: number;
  }[];

  /** Errors encountered during pipeline execution (non-fatal) */
  errors?: {
    guard?: string;
    error: string;
    phase?: 'pre' | 'normal' | 'post';
  }[];
}

/**
 * NavigationGuardConfig - Configuration for a single guard in the pipeline
 *
 * Used by system/navigation to execute guards in sorted order.
 */
export interface NavigationGuardConfig {
  /** Unique name for this guard (e.g., 'auth-check', 'world-access-check') */
  name: string;

  /** Priority level (pre guards run first, normal, then post) */
  priority: 'pre' | 'normal' | 'post';

  /** Guard function that checks the context and returns a decision */
  check: (context: NavigationContext) => Promise<NavigationDecision>;

  /** Timeout in milliseconds (default 5000) */
  timeoutMs?: number;

  /** Optional: skip this guard if condition is met */
  skipIf?: (context: NavigationContext) => boolean;
}
