/**
 * Degradation System Types
 * 
 * Core types for tracking app capability degradation across multiple sources.
 * Supports reference counting: capability is `true` only when no sources report `false`.
 */

/**
 * All capabilities that can degrade during runtime
 * 
 * Each capability represents a critical system function that may fail gracefully:
 * - Phase-level: database queries, authentication, data sync, storage access, background jobs
 * - Network: online/offline connectivity
 * - Optional services: analytics tracking, error reporting, premium features
 */
export enum DegradeCapability {
  /**
   * Database queries and writes disabled
   * Sources: services initialization, database provider failures
   * Effect: offline-first fallback, cached data only
   */
  DATABASE = 'database',

  /**
   * Authentication and session validation disabled
   * Sources: auth provider initialization, auth state failures
   * Effect: anonymous mode, no account-specific UI
   */
  AUTH = 'auth',

  /**
   * Network synchronization and offline queue disabled
   * Sources: offline detection, sync cascade detection, sync manager
   * Effect: local-only mode, no data propagation
   */
  SYNC = 'sync',

  /**
   * Network connectivity unavailable (online/offline)
   * Sources: network detection system
   * Effect: offline mode activated, no API calls
   */
  CONNECTIVITY = 'connectivity',

  /**
   * Local storage (persistent data) unavailable
   * Sources: storage initialization failures
   * Effect: in-memory only, data lost on reload
   */
  STORAGE = 'storage',

  /**
   * Background jobs, auto-refresh, retry mechanisms disabled
   * Sources: job registration failures, job scheduler issues
   * Effect: no automatic updates, manual refresh only
   */
  BACKGROUND_JOBS = 'backgroundJobs',

  /**
   * Analytics and telemetry reporting disabled
   * Sources: analytics service initialization, export failures
   * Effect: no user behavior tracking
   */
  ANALYTICS = 'analytics',

  /**
   * Error tracking and crash reporting disabled
   * Sources: error tracker initialization, reporting failures
   * Effect: errors logged locally only
   */
  ERROR_TRACKING = 'errorTracking',

  /**
   * Premium features and entitlements locked
   * Sources: feature flags failure, entitlements verification failure
   * Effect: premium UI hidden, basic features only
   */
  PREMIUM_FEATURES = 'premiumFeatures',
}

/**
 * Per-capability degradation state with source tracking
 * 
 * Tracks:
 * - `value`: is this capability currently available?
 * - `reason`: human-readable explanation (error message, phase name, etc.)
 * - `source`: which system/phase disabled this capability
 * - `updatedAt`: timestamp in ms when state last changed
 */
export interface DegradeCapabilityState {
  /** Is capability available (true) or degraded (false) */
  value: boolean;

  /** Human-readable reason for current state */
  reason: string;

  /** System/phase/component that set this state */
  source: string;

  /** Timestamp in ms when state last changed */
  updatedAt: number;
}

/**
 * Complete degradation state snapshot
 * 
 * Represents full app degradation state at a point in time.
 * Includes per-capability metadata for debugging and decision-making.
 */
export interface DegradeState {
  /** All capabilities and their current states */
  capabilities: Record<DegradeCapability, DegradeCapabilityState>;

  /** Timestamp when this snapshot was taken */
  timestamp: number;
}

/**
 * Context passed to response handlers when a capability degrades or recovers.
 * Contains enough information for the handler to decide what action to take.
 */
export interface DegradeResponseContext {
  /** The capability that changed */
  capability: DegradeCapability;
  /** true = recovered, false = degraded */
  available: boolean;
  /** Human-readable reason for the change */
  reason: string;
  /** Which system/phase/component triggered the change */
  source: string;
  /** true if this is a crash-level (unrecoverable) event */
  isCrash: boolean;
}

/**
 * Response handler for a degradation event.
 * Called automatically when a capability's state changes.
 *
 * System-level handlers (in system/Degrade/responses/) handle infrastructure:
 *   stop processes, kill threads, capture mutations, pause queues.
 *
 * Lib-level handlers (in lib/error/degrade/lib-responses.ts) handle orchestration:
 *   UI state decisions, feature gating, user-facing messaging.
 */
export type DegradeResponseHandler = (context: DegradeResponseContext) => void;

/**
 * Subscription callback for degradation state changes
 */
export type DegradeSubscriber = (state: DegradeState) => void;

/**
 * Toast notification options for degradation alerts.
 * Structured to support future toast redesign (title + detailed message).
 * Currently only uses `title` and `severity` for display.
 *
 * TODO: [Toast Redesign] When new toast component (title + detailed message + actions) lands,
 * update toast rendering in callback implementation to use `message`, `severity`, and `duration`.
 * Data structure is already in place for future migration.
 */
export interface DegradeToastOptions {
  /** Short title shown as primary message (used now) */
  title: string;

  /** Severity level for color/styling (used now) */
  severity?: 'info' | 'warning' | 'error';

  /** Detailed explanation (dead code - used in future toast redesign) */
  message?: string;

  /** Optional duration in ms (dead code - used in future toast redesign) */
  duration?: number;
}

/**
 * Display callback types for degradation UI responses.
 * Registered at bootstrap to handle UI updates when capabilities degrade or recover.
 *
 * Only two callbacks:
 * - `showSafeMode`: redirect to safe mode screen (crash-level failures)
 * - `showToast`: show temporary notification (recoverable faults)
 */
export type DegradeDisplayCallback = {
  showSafeMode?: (capability: DegradeCapability, reason: string) => void;
  showToast?: (options: DegradeToastOptions) => void;
};

/**
 * Priority-ordered list of degradation levels for UI decision-making.
 * Used by hooks and UI components to determine what to show/hide.
 */
export type DegradationLevel = 'normal' | 'degraded' | 'critical';
