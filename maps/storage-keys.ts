/**
 * Storage Keys
 *
 * Centralized key constants with namespacing.
 * Format: dnd:<domain>:<key>
 *
 * NEVER use raw string keys - always use these constants.
 *
 * Backend routing for these keys is configured in STORAGE_BACKEND_CONFIG.
 * See config/storage-backends-config.ts for the complete routing strategy.
 */
export const STORAGE_KEYS = {
  // ========== PERSISTENT (localStorage) - Sensitive Auth/User Data ==========

  // App-level data
  CONNECTED_WORLDS: "dnd:app:connected_worlds",
  CONNECTED_WORLDS_METADATA: "dnd:app:connected_worlds_metadata",

  // Auth-related data
  HAS_ACCOUNT: "dnd:auth:has_account",
  AUTH_SESSION: "dnd:auth:session", // Supabase session tokens (web platform workaround for persistSession=false)
  USER_DATA: "dnd:auth:user_data",
  USER_DATA_META: "dnd:auth:user_data_meta",
  USER_DATA_TIMESTAMP: "dnd:auth:user_data_timestamp",
  LAST_LOGGED_IN: "dnd:auth:last_logged_in", // Timestamp of last successful sign-in
  PROFILE_COMPLETED: "dnd:auth:profile_completed", // false after signup, true after profile created, null/undefined for normal users

  // Auth attempt rate limiting
  AUTH_ATTEMPTS: "dnd:auth:attempts",

  // Invites - important auth flow state
  PENDING_INVITE: "dnd:invite:pending",

  // Session email cache
  SESSION_USER_EMAIL: "dnd_session_user_email",

  // User preferences - must persist
  THEME_PREFERENCE: "dnd:user:theme",
  THEME_MODE: "dnd:user:theme_mode",
  SCALE_PREFERENCE: "dnd:user:scale",

  // User settings (theme, language, timezone, preferences, analytics_consent_level)
  USER_SETTINGS: "dnd:user:settings",
  USER_SETTINGS_META: "dnd:user:settings_meta",

  // Feature flags / dev settings
  DEV_MODE: "dnd:dev:mode",

  // ========== EPHEMERAL (sessionStorage) - Query Cache & Metadata ==========
  // Note: These are pattern prefixes; actual keys use these prefixes

  // Session state (volatile, refetchable)
  LAST_SELECTED_WORLD: "dnd:session:last_selected_world",
  LAST_USER_ROLE: "dnd:session:last_user_role",

  // Safe mode diagnostics (transient, cleared when user recovers or restarts)
  SAFE_MODE_DIAGNOSTICS: "dnd:session:safe_mode_diagnostics",

  // Offline request queue (persistent, survives app restart)
  OFFLINE_QUEUE: "dnd:api:offline_queue",

  // Offline mutation queue (persistent, survives app restart)
  OFFLINE_MUTATION_QUEUE: "dnd:offline:mutation_queue",

  // Offline mutation dead-letter queue (permanent failures)
  OFFLINE_DEAD_LETTER: "dnd:offline:dead_letter",

  // Analytics event buffer (offline queueing)
  ANALYTICS_OFFLINE_QUEUE: "dnd:analytics:offline_queue",

  // Performance baseline tracking
  PERF_BASELINES: "dnd:analytics:performance_baselines",

  // Analytics consent (persisted user choice)
  ANALYTICS_CONSENT: "dnd:analytics:consent",
  ANALYTICS_CONSENT_META: "dnd:analytics:consent_meta",

  // Analytics consent sync queue (pending DB updates)
  CONSENT_SYNC_QUEUE: "dnd:analytics:consent_sync_queue",

  // Breadcrumb queue (Sentry offline persistence)
  BREADCRUMB_QUEUE: "dnd:sentry:breadcrumb_queue",
  BREADCRUMB_DEDUP_CACHE: "dnd:sentry:sent_fingerprints",

  // Network recovery state (retry count, backoff timing)
  NETWORK_RECOVERY_STATE: "dnd:network:recovery_state",

  // Feature flags and premium entitlements
  FEATURE_FLAGS: "dnd:feature_flags:v1",
  ENTITLEMENTS: "dnd:entitlements:v1",
  CLOCK_INVALID: "dnd:clock_invalid",
} as const;
