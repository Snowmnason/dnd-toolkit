/**
 * Transport Adapter Type Definitions
 * 
 * These types define the interface between the system orchestration layer
 * and the concrete transport implementations (Expo Router, Linking, etc).
 * 
 * This layer is intentionally minimal - it's just transport, no business logic.
 * 
 * ============================================================================
 * CENTRALIZED AUTHORITY PRINCIPLE
 * ============================================================================
 * 
 * These types enforce ONE entry point for ALL navigation execution:
 * - No code outside system/Navigation/adapter can directly call router.*
 * - All navigation requests are normalized into the same request/result shape
 * - This keeps guard pipelines, analytics, monitoring, and future security rules
 *   in a single, enforceable path
 * 
 * Benefits:
 * - Impossible to accidentally bypass security checks
 * - All navigation goes through the same observability/logging
 * - Easier to add security rules (allowlist checks, rate limiting, etc)
 * - Simpler to debug navigation issues (one control point)
 * - Easier to swap router implementations (upgrade Expo Router, use custom router)
 */

/**
 * Simple transport result indicator
 * Used to track success/failure of transport operations
 */
export type TransportResult = {
  success: boolean;
  error?: Error;
  metadata?: Record<string, any>;
};

/**
 * Platform type for conditional routing
 * Used to determine which transport method to use
 */
export type Platform = 'web' | 'ios' | 'android' | 'desktop';

/**
 * External link options
 * Controls how external links are opened
 */
export type ExternalLinkOptions = {
  /**
   * Whether this is a trusted link (app-controlled)
   * vs untrusted (user-provided, third-party)
   */
  trusted?: boolean;

  /**
   * Whether to open in new tab/window
   * Only applies to web platform
   */
  newTab?: boolean;

  /**
   * Custom event handler after link opens
   */
  onComplete?: () => void;

  /**
   * Custom error handler if link fails
   */
  onError?: (error: Error) => void;
};

/**
 * ============================================================================
 * NAVIGATION GUARD PIPELINE TYPES
 * ============================================================================
 */

/**
 * Execution context passed to guards and systems
 * Contains platform, user, and world information
 */
export type ExecutionContext = {
  userId?: string;
  worldId?: string;
  userRole?: 'admin' | 'owner' | 'editor' | 'viewer' | 'guest';
  platform: Platform;
};

/**
 * Navigation context that triggers guard evaluation
 * Represents the navigation request in flight
 *
 * triggeredBy values:
 * - 'user'      : Initiated by a user gesture (tap, click, forward navigation)
 * - 'redirect'  : Initiated programmatically by app logic (auth guard, kernel bootstrap, route protection)
 * - 'back'      : Explicit back navigation — `navigate.back()`, dismiss, or back button press
 * - 'dismiss'   : Modal/sheet dismissal — `navigate.dismiss()`, `dismissAll()`, `dismissTo()`
 * - 'deep-link' : Initiated from outside the app (OS deep link, browser URL, notification).
 *                 This is the fallback when no navManager intent was recorded — meaning the
 *                 segment change originated outside the app's own navigation calls.
 */
export type NavigationContext = {
  fromRoute?: string;
  toRoute: string;
  triggeredBy: 'user' | 'redirect' | 'back' | 'dismiss' | 'deep-link';
  userId?: string;
  worldId?: string;
  platform: Platform;
  params?: Record<string, any>;
};

/**
 * Result of a single guard evaluation
 * Discriminated union of possible guard decisions
 */
export type NavigationDecision =
  | { status: 'allow' }
  | { status: 'redirect'; target: string; reason: string }
  | { status: 'abort'; reason: string; error?: Error }
  | { status: 'modal_then_redirect'; reason: string; target: string };

/**
 * Configuration for a single guard in the pipeline
 * Defines how and when to run the guard
 */
export type NavigationGuardConfig = {
  name: string;
  priority: 'pre' | 'normal' | 'post';
  check: (context: NavigationContext) => Promise<NavigationDecision>;
  /** Skip this guard entirely when the condition is true (evaluated before check()) */
  skipIf?: (context: NavigationContext) => boolean;
  /** Max milliseconds to wait for this guard before treating it as an error (default: 5000) */
  timeoutMs?: number;
};

/**
 * Global routing policy mode
 * Determines whether routes are protected by default or public by default
 */
export type NavigationPolicyMode = 'protected_by_default' | 'public_by_default';

/**
 * Named guard profile for easy route configuration
 * Predefined sets of guards that apply to a route
 */
export type GuardPipelineProfile = 'public' | 'account-only' | 'world-required' | 'admin-only' | 'none';

/**
 * Audit record for a navigation transaction
 * Tracks decision, latency, and which guards ran
 */
export type NavigationTransaction = {
  id: string;
  status: 'allow' | 'redirect' | 'abort' | 'modal';
  fromRoute?: string;
  toRoute: string;
  decision: NavigationDecision;
  latencyMs: number;
  timestamp: number;
  userId?: string;
  guardsExecuted: string[];
};

/**
 * ============================================================================
 * NAVIGATION REQUEST & EXECUTION TYPES
 * ============================================================================
 */

/**
 * Normalized navigation request
 * Standardized shape for all navigation operations
 */
export type NavigationRequest = {
  family: string;
  action: string;
  target: string;
  params?: Record<string, any>;
  source: 'direct' | 'deeplink' | 'notification' | 'redirect';
  requiresGuardPipeline: boolean;
  analyticsMode: 'track' | 'ignore';
};

/**
 * UI instruction result from failed navigation
 * Discriminated union for different failure types
 *
 * **URL & Hostname Fields** (for trusted-URL consent modals):
 * - `url`: Full URL for external link (used by TrustedUrlConsentModal)
 * - `hostname`: Extracted hostname (user-friendly display, e.g., "github.com")
 * - `modalType`: Routes to correct modal component ('trusted-url-consent' for 3-button, 'nav-feedback' for generic)
 */
export type NavigationUiInstruction =
  | { type: 'nav-failure'; message: string; error?: Error; tone?: 'danger' | 'warning' | 'success' }
  | { type: 'nav-feedback'; message: string; action?: 'retry' | 'dismiss'; heading?: string; tone?: 'danger' | 'warning' | 'success' }
  | { type: 'feature-gated'; featureName: string; message: string }
  | { type: 'entitlement-expired'; message: string; redirectTarget?: string }
  | { type: 'trusted-url-consent'; url: string; hostname: string; message: string; modalType: 'trusted-url-consent' };

  /**
 * Final result of a navigation execution
 * Discriminated union of possible execution outcomes
 */
export type NavigationExecutionResult =
  | { status: 'executed'; toRoute: string; transaction: NavigationTransaction }
  | { status: 'redirected'; toRoute: string; reason: string; transaction: NavigationTransaction }
  | { status: 'aborted'; reason: string; error?: Error; transaction: NavigationTransaction }
  | { status: 'ui-required'; instruction: NavigationUiInstruction; transaction: NavigationTransaction }
  | { status: 'no-op'; reason: string };

/**
 * ============================================================================
 * NAVIGATION ANALYTICS EVENT TYPES
 * ============================================================================
 */

/**
 * Represents a single navigation event for analytics.
 * Normalized shape sent to Analytics.track().
 */
export interface NavigationAnalyticsEvent {
  /** Event identifier. Examples: 'nav_transition_allowed', 'nav_guard_auth_denied' */
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
    /** Reason why (e.g., 'auth_required', 'world_access_denied', 'platform_mismatch') */
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
 *
 * Seven meaningful events representing navigation decisions:
 * - Allowed: User successfully transitioned to new route
 * - Auth/World/Platform denied: Guard rejected due to specific reason
 * - Timeout: Guard pipeline exceeded threshold (system health)
 * - UI required: Modal intervention needed before proceeding
 * - Error: System-level failure (exception, not policy)
 */
export enum NavigationEventType {
  /**
   * User transitioned successfully to a new route.
   * Event name: 'nav_transition_allowed'
   */
  TransitionAllowed = 'nav_transition_allowed',

  /**
   * Navigation was denied: authentication required.
   * Event name: 'nav_guard_auth_denied'
   */
  GuardAuthDenied = 'nav_guard_auth_denied',

  /**
   * Navigation was denied: world access required.
   * Event name: 'nav_guard_world_access'
   */
  GuardWorldAccess = 'nav_guard_world_access',

  /**
   * Navigation guard pipeline timed out.
   * Event name: 'nav_guard_timeout'
   */
  GuardTimeout = 'nav_guard_timeout',

  /**
   * Navigation was denied: platform restriction.
   * Event name: 'nav_guard_platform_mismatch'
   */
  GuardPlatformMismatch = 'nav_guard_platform_mismatch',

  /**
   * Navigation requires UI intervention (modal, confirmation).
   * Event name: 'nav_ui_required'
   */
  UiRequired = 'nav_ui_required',

  /**
   * Navigation failed due to system error.
   * Event name: 'nav_error'
   */
  NavError = 'nav_error',

  /**
   * Navigation was aborted (hard stop, no redirect or error).
   * Event name: 'nav_transition_aborted'
   */
  TransitionAborted = 'nav_transition_aborted',
}

/**
 * Consent category for navigation events.
 * Used by consent-gating to determine if event should be emitted.
 */
export enum NavigationConsentCategory {
  /**
   * Essential navigation events (errors, guard failures).
   * Always emitted regardless of consent level.
   */
  Essential = 'essential',

  /**
   * Standard navigation metrics (transitions, redirects, denials).
   * Emitted if consent >= 'basic'.
   */
  Performance = 'performance',

  /**
   * Detailed navigation tracking.
   * Emitted only if consent === 'full'.
   */
  Usage = 'usage',
}

/**
 * ============================================================================
 * NAVIGATION MANAGER OPTIONS
 * ============================================================================
 */

/**
 * Options for controlling manager behavior
 * Used by all manager family functions to customize execution
 */
export type NavManagerOptions = {
  /**
   * Skip guard pipeline execution for this navigation
   * Useful for bypassing guards in emergency redirects
   * Default: false
   */
  skipGuards?: boolean;

  /**
   * Skip input validation for this navigation
   * Useful if input is already validated upstream
   * Default: false
   */
  skipValidation?: boolean;

  /**
   * Mark this navigation as trusted
   * For external links, means URL has already been verified safe
   * Default: false
   */
  trusted?: boolean;

  /**
   * Store the URL origin as trusted after opening
   * For external links — "Trust and open" option in the consent modal
   * Default: false
   */
  storeTrust?: boolean;

  /**
   * Open immediately without storing trust (one-time bypass)
   * For external links — "Open anyway" option in the consent modal
   * Default: false
   */
  skipTrustCheck?: boolean;

  /**
   * Override resolved context params for guard evaluation.
   * Caller-supplied values win over storage-resolved values.
   * Used by the bootstrap guard to inject the worldId from the deep-link URL
   * instead of the stored LAST_SELECTED_WORLD, so the permission guard validates
   * the correct world.
   */
  overrideParams?: Record<string, string>;
};

