/**
 * @file Event to consent category mapping.
 *
 * Centralized configuration for mapping event names to consent categories.
 * Edit this file to add or update event consent requirements.
 */

export type ConsentCategory = 'essential' | 'performance' | 'usage';

/**
 * Event type to consent category mapping.
 *
 * - **essential**: Always emit — even for consent level 'none'. Reserve for critical
 *   system-health events (crashes, fatal errors, safe mode). Keep this list small.
 * - **performance**: Emit if consentLevel >= 'basic'
 * - **usage**: Emit only if consentLevel === 'full'
 *
 * **Unmapped events default to 'performance'** (requires at least 'basic' consent).
 * This prevents forgotten/new events from leaking to users with 'none' consent.
 * A warning is also logged so the developer knows to add a mapping.
 *
 * Add new events here as the app grows. See lib/analytics/consent-gating.ts for gate logic.
 */
export const DEFAULT_EVENT_CONSENT_MAPPING = new Map<string, ConsentCategory>([
  // ─── Essential events ────────────────────────────────────────────────────────
  // Always emitted — even for 'none' consent. Only errors, crashes, and critical
  // system-health signals belong here. Keep this list intentionally small.
  ['error', 'essential'],
  ['fatal', 'essential'],
  ['regression_detected', 'essential'],
  ['api_error', 'essential'],

  // Safe mode — system health/debugging; must always reach the backend
  ['safe_mode_entered', 'essential'],
  ['safe_mode_action', 'essential'],
  ['safe_mode_recovery_action_selected', 'essential'],
  ['safe_mode_recovery_action_succeeded', 'essential'],
  ['safe_mode_recovery_action_failed', 'essential'],

  // Bootstrap — kernel lifecycle; required for reliability monitoring
  ['app_bootstrap_complete', 'essential'],

  // Navigation system — errors and timeouts are system health signals
  ['nav_error', 'essential'],
  ['nav_guard_timeout', 'essential'],

  // ─── Performance events ──────────────────────────────────────────────────────
  // Requires >= 'basic' consent (user opted into basic tracking)
  ['performance_measure', 'performance'],
  ['variant_assigned', 'performance'],
  ['variant_engagement', 'performance'],
  ['variant_performance', 'performance'],
  ['request_latency', 'performance'],
  ['page_load_time', 'performance'],
  ['feature_blocked', 'performance'],
  ['api_request', 'performance'],

  // Navigation — standard metrics (transitions, redirects, denials, policy decisions)
  ['nav_transition_allowed', 'performance'],
  ['nav_transition_aborted', 'performance'],
  ['nav_guard_auth_denied', 'performance'],
  ['nav_guard_world_access', 'performance'],
  ['nav_guard_platform_mismatch', 'performance'],
  ['nav_guard_timeout', 'performance'],
  ['nav_ui_required', 'performance'],
  ['nav_error', 'performance'],

  // ─── Usage events ────────────────────────────────────────────────────────────
  // Requires 'full' consent (user opted into full usage tracking)
  ['screen_view', 'usage'],
  ['component_usage', 'usage'],
  ['feature_usage', 'usage'],

  // Session lifecycle — behavioural data; requires full consent
  ['session_started', 'usage'],
  ['session_ended', 'usage'],
]);
