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
 * Subscription callback for degradation state changes
 */
export type DegradeSubscriber = (state: DegradeState) => void;
