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
 * - **essential**: Emit if user has >= 'basic' consent (default for unmapped events)
 * - **performance**: Emit if user has >= 'basic' consent
 * - **usage**: Emit if user has === 'full' consent
 *
 * Add new events as the app grows. See lib/analytics/consent-gating.ts for gate logic.
 */
export const DEFAULT_EVENT_CONSENT_MAPPING = new Map<string, ConsentCategory>([
  // Essential events (errors, regressions, system health)
  // These are required for debugging and system monitoring
  ['error', 'essential'],
  ['fatal', 'essential'],
  ['regression_detected', 'essential'],
  ['api_request', 'essential'],
  ['api_error', 'essential'],

  // Performance events (performance metrics, A/B testing)
  // Requires >= 'basic' consent (user opted into basic tracking)
  ['performance_measure', 'performance'],
  ['variant_assigned', 'performance'],
  ['variant_engagement', 'performance'],
  ['variant_performance', 'performance'],
  ['request_latency', 'performance'],
  ['page_load_time', 'performance'],

  // Usage events (user interactions, feature engagement)
  // Requires 'full' consent (user opted into full usage tracking)
  ['screen_view', 'usage'],
  ['component_usage', 'usage'],
  ['feature_usage', 'usage'],
  ['feature_blocked', 'usage'],
]);
