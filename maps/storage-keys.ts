/**
 * Storage Keys
 *
 * Centralized key constants with namespacing.
 * 
 * Namespace convention:
 * - sno: Shared infrastructure (auth, preferences, offline queues, analytics, feature flags, etc.)
 *        Can be safely shared across different apps built on the same platform
 * - dnd: DnD-Toolkit app-specific (world connections, invites, session state tied to app logic)
 *
 * NEVER use raw string keys - always use these constants.
 *
 * Backend routing for these keys is configured in STORAGE_BACKEND_CONFIG.
 * See config/storage-backends-config.ts for the complete routing strategy.
 */
export const STORAGE_KEYS = {
  // ========== DND APP-SPECIFIC DATA (dnd:) ==========

  // App-level data (DnD-specific world management)
  CONNECTED_WORLDS: "dnd:app:connected_worlds",
  CONNECTED_WORLDS_METADATA: "dnd:app:connected_worlds_metadata",

  // Invites - DnD-specific auth flow state
  PENDING_INVITE: "dnd:invite:pending",

  // Session state tied to DnD world selection
  LAST_SELECTED_WORLD: "dnd:session:last_selected_world",
  LAST_USER_ROLE: "dnd:session:last_user_role",

  // ========== SHARED INFRASTRUCTURE (sno:) ==========

  // Auth-related data (shared auth infrastructure)
  HAS_ACCOUNT: "sno:auth:has_account",
  AUTH_SESSION: "sno:auth:session", // Supabase session tokens (web platform workaround for persistSession=false)
  USER_DATA: "sno:auth:user_data",
  USER_DATA_META: "sno:auth:user_data_meta",
  USER_DATA_TIMESTAMP: "sno:auth:user_data_timestamp",
  LAST_LOGGED_IN: "sno:auth:last_logged_in", // Timestamp of last successful sign-in
  PROFILE_COMPLETED: "sno:auth:profile_completed", // false after signup, true after profile created, null/undefined for normal users

  // Auth attempt rate limiting (shared infrastructure)
  AUTH_ATTEMPTS: "sno:auth:attempts",

  // Session email cache (shared auth infrastructure)
  SESSION_USER_EMAIL: "sno:session_user_email",

  // User preferences - must persist (shared preference structure)
  THEME_PREFERENCE: "sno:user:theme",
  THEME_MODE: "sno:user:theme_mode",
  SCALE_PREFERENCE: "sno:user:scale",

  // Component UI state (framework-level, reusable across apps)
  NAV_DRAWER_EXPANDED: "sno:ui:nav_drawer_expanded",

  // User settings (shared storage contract, app fills with own settings)
  USER_SETTINGS: "sno:user:settings",
  USER_SETTINGS_META: "sno:user:settings_meta",

  // Feature flags / dev settings (shared infrastructure)
  DEV_MODE: "sno:dev:mode",

  // Safe mode diagnostics (shared infrastructure)
  SAFE_MODE_DIAGNOSTICS: "sno:session:safe_mode_diagnostics",

  // Offline request queue (shared infrastructure, persistent)
  OFFLINE_QUEUE: "sno:api:offline_queue",

  // Offline mutation queue (shared infrastructure, persistent)
  OFFLINE_MUTATION_QUEUE: "sno:offline:mutation_queue",

  // Offline mutation dead-letter queue (shared infrastructure)
  OFFLINE_DEAD_LETTER: "sno:offline:dead_letter",

  // Analytics event buffer (shared infrastructure)
  ANALYTICS_OFFLINE_QUEUE: "sno:analytics:offline_queue",

  // Performance baseline tracking (shared infrastructure)
  PERF_BASELINES: "sno:analytics:performance_baselines",

  // Analytics consent (shared infrastructure)
  ANALYTICS_CONSENT: "sno:analytics:consent",
  ANALYTICS_CONSENT_META: "sno:analytics:consent_meta",

  // Analytics consent sync queue (shared infrastructure)
  CONSENT_SYNC_QUEUE: "sno:analytics:consent_sync_queue",

  // Breadcrumb queue (shared infrastructure - Sentry offline persistence)
  BREADCRUMB_QUEUE: "sno:sentry:breadcrumb_queue",
  BREADCRUMB_DEDUP_CACHE: "sno:sentry:sent_fingerprints",

  // Network recovery state (shared infrastructure)
  NETWORK_RECOVERY_STATE: "sno:network:recovery_state",

  // Feature flags and premium entitlements (shared infrastructure)
  FEATURE_FLAGS: "sno:feature_flags:v1",
  ENTITLEMENTS: "sno:entitlements:v1",
  CLOCK_INVALID: "sno:clock_invalid",

  // Kernel clock integrity (shared infrastructure)
  LAST_CLOCK_CHECK: "sno:kernel:last_clock_check",

  // Trusted external URL origins (navigation, shared infrastructure)
  TRUSTED_URL_ORIGINS: "sno:nav:trusted_url_origins",
} as const;
