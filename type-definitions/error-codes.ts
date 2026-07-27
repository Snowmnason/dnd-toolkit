/**
 * Error codes for all modules.
 * 
 * Organized by domain; used by managers/error/module/* handlers to decide
 * safe mode, graceful fallback, or propagation.
 */

/**
 * Analytics-specific error codes.
 * Returned by lib/analytics operations; handled by managers/error/module/analyticsError.ts
 */
export enum AnalyticsErrorCode {
  // Consent errors
  CONSENT_DENIED = 'analytics:consent_denied',
  CONSENT_INVALID = 'analytics:consent_invalid',
  CONSENT_UNINITIALIZED = 'analytics:consent_uninitialized',
  CONSENT_PERSIST_FAILED = 'analytics:consent_persist_failed',

  // Buffer errors
  BUFFER_FULL = 'analytics:buffer_full',
  BUFFER_PERSIST_FAILED = 'analytics:buffer_persist_failed',

  // Identify/session errors
  IDENTIFY_FAILED = 'analytics:identify_failed',
  SESSION_INIT_FAILED = 'analytics:session_init_failed',

  // Track/event errors
  TRACK_FAILED = 'analytics:track_failed',
  EVENT_INVALID = 'analytics:event_invalid',

  // Export/middleware errors
  EXPORT_FAILED = 'analytics:export_failed',
  PROVIDER_UNAVAILABLE = 'analytics:provider_unavailable',
}

/**
 * Cross-module error codes (used by multiple domains).
 * Prefix indicates affected system.
 */
export enum CrossModuleErrorCode {
  STORAGE_UNAVAILABLE = 'storage:unavailable',
  STORAGE_PERSIST_FAILED = 'storage:persist_failed',
  NETWORK_UNAVAILABLE = 'network:unavailable',
  SYSTEM_UNREADY = 'system:unready',
}
