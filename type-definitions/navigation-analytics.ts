/**
 * Navigation Analytics Event Types
 *
 * Defines all navigation-specific analytics events.
 * These events track user navigation behavior: transitions, guards, policy decisions.
 *
 * Integration points:
 * - `lib/analytics/nav-analytics.ts` — Constructs events with this shape
 * - `maps/event-consent-mapping.ts` — Specifies consent category per event
 * - `lib/middleware/navigation/nav-service.ts` — Triggers events via nav-analytics
 */

/**
 * Represents a single navigation event for analytics.
 * Normalized shape sent to Analytics.track().
 */
export interface NavigationAnalyticsEvent {
  /** Event identifier. Examples: 'nav_transition', 'nav_guard_blocked', 'nav_timeout' */
  eventName: string;

  /** Routing data: from/to route, params count, guard count */
  routing: {
    /** Source route (before navigation). Undefined for initial page load. */
    fromRoute?: string;
    /** Destination route. Always present. */
    toRoute: string;
    /** Number of URL parameters in the request. */
    paramCount: number;
  };

  /** Navigation decision info: what happened (allowed, redirected, aborted, etc.) */
  decision: {
    /** Outcome: 'allowed' | 'redirected' | 'aborted' | 'timeout' | 'error' */
    outcome: 'allowed' | 'redirected' | 'aborted' | 'timeout' | 'error';
    /** Reason why (e.g., 'auth_required', 'world_access_denied', 'platform_mismatch', 'user_throttled') */
    reason?: string;
    /** If redirected, the redirect target. */
    redirectTarget?: string;
  };

  /** Timing and performance metrics */
  performance: {
    /** Time from request start to decision in milliseconds. */
    decisionTimeMs: number;
    /** Total transaction time. May include router execution time. */
    totalTimeMs?: number;
    /** Number of guards that ran. */
    guardCount: number;
    /** If a guard timed out, which one. */
    timedOutGuard?: string;
  };

  /** Context about the request */
  context: {
    /** User ID if authenticated. Undefined if anonymous. */
    userId?: string;
    /** World ID if in-world. Undefined if not applicable. */
    worldId?: string;
    /** Navigation trigger: 'user_action' | 'deep_link' | 'back_button' | 'programmatic' */
    source: 'user_action' | 'deep_link' | 'back_button' | 'programmatic';
    /** Platform (web, ios, android) when available. */
    platform?: string;
  };

  /** Optional error details if decision was error or abort */
  error?: {
    /** Error code (e.g., 'AUTH_REQUIRED', 'WORLD_NOT_ACCESSIBLE') */
    code?: string;
    /** Sanitized error message (PII-safe). Stack traces removed. */
    message?: string;
  };
}

/**
 * Navigation event types emitted by the analytics system.
 * Each event is sent via Analytics.track(eventName, properties).
 */
export enum NavigationEventType {
  /**
   * User transitioned successfully to a new route.
   * Event name: 'nav_transition_success'
   * Triggered when: NavigationDecision.outcome === 'allowed' and router executed
   */
  TransitionSuccess = 'nav_transition_success',

  /**
   * Navigation was redirected by policy (e.g., missing auth, world access denied).
   * Event name: 'nav_transition_redirected'
   * Triggered when: NavigationDecision.outcome === 'redirected'
   * Example: /world-selection → /login (auth required)
   */
  TransitionRedirected = 'nav_transition_redirected',

  /**
   * Navigation was blocked/aborted by policy or user action (throttled).
   * Event name: 'nav_transition_aborted'
   * Triggered when: NavigationDecision.outcome === 'aborted'
   */
  TransitionAborted = 'nav_transition_aborted',

  /**
   * Navigation guard pipeline timed out.
   * Event name: 'nav_guard_timeout'
   * Triggered when: Guard evaluation exceeded timeout threshold
   * Important for detecting performance issues
   */
  GuardTimeout = 'nav_guard_timeout',

  /**
   * Navigation failed due to an exception (system error, not policy).
   * Event name: 'nav_error'
   * Triggered when: Unexpected error in middleware or system layer
   * Important for error tracking and debugging
   */
  NavError = 'nav_error',

  /**
   * User was throttled/rate-limited on navigation (same route clicked repeatedly).
   * Event name: 'nav_user_throttled'
   * Triggered when: Hook-level throttling prevents rapid re-clicks
   * Important for detecting confusion/frustration
   */
  UserThrottled = 'nav_user_throttled',
}

/**
 * Consent category for navigation events.
 * Used by consent-gating to determine if event should be emitted.
 */
export enum NavigationConsentCategory {
  /**
   * Essential navigation events (errors, guard failures, throttling).
   * Always emitted regardless of consent level.
   * Category: 'essential'
   */
  Essential = 'essential',

  /**
   * Standard navigation metrics (transitions, redirects).
   * Emitted if consent >= 'basic'.
   * Category: 'performance'
   */
  Performance = 'performance',

  /**
   * Detailed navigation tracking (all transitions, all params).
   * Emitted only if consent === 'full'.
   * Category: 'usage'
   */
  Usage = 'usage',
}
