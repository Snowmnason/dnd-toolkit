/**
 * Safe Mode State Machine
 *
 * Tracks application health and provides graceful degradation when critical systems fail.
 * States flow: NORMAL → (DEGRADED|SAFE) → RECOVERY → back to NORMAL on recovery success
 *
 * - NORMAL: All systems healthy, app fully functional
 * - DEGRADED: Some features unavailable due to transient issues (network, sync)
 * - SAFE: Minimal functionality, persistent problems (storage, auth)
 * - RECOVERY: Critical failure, user must take explicit recovery action
 */

import { getAppConfig } from "../config/loader";

/**
 * Safe mode levels representing app health states
 * DEGRADED and SAFE are bundled into one UI (degraded/safe screen)
 * RECOVERY has its own dedicated screen with explicit recovery actions
 */
export enum SafeModeLevel {
  /** App fully functional, all systems healthy */
  NORMAL = "normal",

  /** Some features unavailable (transient network, sync issues) */
  DEGRADED = "degraded",

  /** Minimal functionality (persistent storage/auth issues) */
  SAFE = "safe",

  /** Critical failure requiring user intervention */
  RECOVERY = "recovery",
}

/**
 * Health check categories that can trigger safe mode
 * Used to categorize what triggered the transition and what recovery options are available
 */
export enum SafeModeReason {
  // Storage issues
  STORAGE_UNREADABLE = "storage_unreadable",
  STORAGE_CORRUPTED = "storage_corrupted",
  STORAGE_QUOTA_EXCEEDED = "storage_quota_exceeded",

  // Auth issues
  AUTH_EXPIRED = "auth_expired",
  AUTH_INVALID = "auth_invalid",
  SESSION_LOST = "session_lost",

  // Kernel/bootstrap issues
  KERNEL_TIMEOUT = "kernel_timeout",
  KERNEL_PRELOAD_FAILED = "kernel_preload_failed",
  KERNEL_CONFIG_FAILED = "kernel_config_failed",

  // Network issues
  NETWORK_SYNC_FAILURES = "network_sync_failures",
  NETWORK_CASCADE = "network_cascade",
  NETWORK_UNAVAILABLE = "network_unavailable",

  // Unknown/generic
  UNKNOWN = "unknown",
}

/**
 * Feature categories that can be disabled during safe mode
 * Maps to navigation items and feature flags during DEGRADED/SAFE states
 */
export enum AffectedFeature {
  SYNC = "sync",
  PREMIUM = "premium",
  OFFLINE_MODE = "offline_mode",
  BACKGROUND_JOBS = "background_jobs",
  IMAGE_OPTIMIZATION = "image_optimization",
  ANALYTICS = "analytics",
  CLOUD_STORAGE = "cloud_storage",
}

/**
 * Recovery actions available to the user
 * User selects one when app is in RECOVERY state
 */
export enum RecoveryAction {
  /** Clear QueryCache and local app data, keep structural data */
  CLEAR_CACHE = "clear_cache",

  /** Clear session and redirect to login */
  RESET_AUTH = "reset_auth",

  /** Restore app state from backup (if available) */
  RESTORE_BACKUP = "restore_backup",

  /** Open email to support with diagnostics */
  CONTACT_SUPPORT = "contact_support",

  /** Reinstall app (clear all data) */
  REINSTALL = "reinstall",
}

/**
 * Complete safe mode state including reason, affected features, and available recovery options
 * Immutable snapshot of app health at a specific moment
 */
export interface SafeModeState {
  /** Current safe mode level */
  level: SafeModeLevel;

  /** Reason why safe mode was triggered */
  reason: SafeModeReason;

  /** Features that are affected/disabled (DEGRADED/SAFE only) */
  affectedFeatures: AffectedFeature[];

  /** Recovery actions available to user (RECOVERY only) */
  recoveryOptions: RecoveryAction[];

  /** When safe mode was triggered (ISO timestamp) */
  timestamp: number;

  /** Additional context/details about the failure */
  details?: string;

  /** Original error if applicable */
  originalError?: Error;
}

/**
 * Configuration for safe mode behavior
 * Controls timeouts, health check intervals, and recovery defaults
 */
export interface SafeModeConfig {
  /** Kernel bootstrap timeout (ms) before triggering RECOVERY state */
  kernelTimeoutMs: number;

  /** Network sync failure threshold before triggering DEGRADED state */
  syncFailureThreshold: number;

  /** Auto-recovery attempts before escalating to manual recovery */
  autoRecoveryAttempts: number;

  /** Time (ms) to wait before retrying auto-recovery */
  autoRecoveryDelayMs: number;
}

/**
 * Mapping of safe mode reasons to affected features and recovery options
 * Used by SafeModeManager to automatically determine available recovery actions
 */
export const SAFE_MODE_DEFINITIONS: Record<
  SafeModeReason,
  {
    level: SafeModeLevel;
    affectedFeatures: AffectedFeature[];
    recoveryOptions: RecoveryAction[];
  }
> = {
  [SafeModeReason.STORAGE_UNREADABLE]: {
    level: SafeModeLevel.RECOVERY,
    affectedFeatures: [
      AffectedFeature.SYNC,
      AffectedFeature.OFFLINE_MODE,
      AffectedFeature.BACKGROUND_JOBS,
    ],
    recoveryOptions: [
      RecoveryAction.CLEAR_CACHE,
      RecoveryAction.RESTORE_BACKUP,
      RecoveryAction.REINSTALL,
      RecoveryAction.CONTACT_SUPPORT,
    ],
  },

  [SafeModeReason.STORAGE_CORRUPTED]: {
    level: SafeModeLevel.RECOVERY,
    affectedFeatures: [
      AffectedFeature.SYNC,
      AffectedFeature.OFFLINE_MODE,
      AffectedFeature.BACKGROUND_JOBS,
    ],
    recoveryOptions: [
      RecoveryAction.CLEAR_CACHE,
      RecoveryAction.RESTORE_BACKUP,
      RecoveryAction.CONTACT_SUPPORT,
    ],
  },

  [SafeModeReason.STORAGE_QUOTA_EXCEEDED]: {
    level: SafeModeLevel.DEGRADED,
    affectedFeatures: [
      AffectedFeature.IMAGE_OPTIMIZATION,
      AffectedFeature.SYNC,
    ],
    recoveryOptions: [RecoveryAction.CLEAR_CACHE],
  },

  [SafeModeReason.AUTH_EXPIRED]: {
    level: SafeModeLevel.SAFE,
    affectedFeatures: [AffectedFeature.SYNC, AffectedFeature.PREMIUM],
    recoveryOptions: [RecoveryAction.RESET_AUTH],
  },

  [SafeModeReason.AUTH_INVALID]: {
    level: SafeModeLevel.SAFE,
    affectedFeatures: [AffectedFeature.SYNC, AffectedFeature.PREMIUM],
    recoveryOptions: [
      RecoveryAction.RESET_AUTH,
      RecoveryAction.CONTACT_SUPPORT,
    ],
  },

  [SafeModeReason.SESSION_LOST]: {
    level: SafeModeLevel.SAFE,
    affectedFeatures: [AffectedFeature.SYNC, AffectedFeature.PREMIUM],
    recoveryOptions: [RecoveryAction.RESET_AUTH],
  },

  [SafeModeReason.KERNEL_TIMEOUT]: {
    level: SafeModeLevel.RECOVERY,
    affectedFeatures: [
      AffectedFeature.SYNC,
      AffectedFeature.OFFLINE_MODE,
      AffectedFeature.ANALYTICS,
    ],
    recoveryOptions: [
      RecoveryAction.CLEAR_CACHE,
      RecoveryAction.REINSTALL,
      RecoveryAction.CONTACT_SUPPORT,
    ],
  },

  [SafeModeReason.KERNEL_PRELOAD_FAILED]: {
    level: SafeModeLevel.RECOVERY,
    affectedFeatures: [AffectedFeature.ANALYTICS],
    recoveryOptions: [
      RecoveryAction.CLEAR_CACHE,
      RecoveryAction.REINSTALL,
      RecoveryAction.CONTACT_SUPPORT,
    ],
  },

  [SafeModeReason.KERNEL_CONFIG_FAILED]: {
    level: SafeModeLevel.RECOVERY,
    affectedFeatures: [
      AffectedFeature.SYNC,
      AffectedFeature.ANALYTICS,
      AffectedFeature.CLOUD_STORAGE,
    ],
    recoveryOptions: [
      RecoveryAction.CLEAR_CACHE,
      RecoveryAction.REINSTALL,
      RecoveryAction.CONTACT_SUPPORT,
    ],
  },

  [SafeModeReason.NETWORK_SYNC_FAILURES]: {
    level: SafeModeLevel.DEGRADED,
    affectedFeatures: [AffectedFeature.SYNC],
    recoveryOptions: [
      RecoveryAction.CLEAR_CACHE,
      RecoveryAction.CONTACT_SUPPORT,
    ],
  },

  [SafeModeReason.NETWORK_CASCADE]: {
    level: SafeModeLevel.DEGRADED,
    affectedFeatures: [AffectedFeature.SYNC],
    recoveryOptions: [
      RecoveryAction.CLEAR_CACHE,
      RecoveryAction.CONTACT_SUPPORT,
    ],
  },

  [SafeModeReason.NETWORK_UNAVAILABLE]: {
    level: SafeModeLevel.DEGRADED,
    affectedFeatures: [AffectedFeature.SYNC, AffectedFeature.CLOUD_STORAGE],
    recoveryOptions: [RecoveryAction.CONTACT_SUPPORT],
  },

  [SafeModeReason.UNKNOWN]: {
    level: SafeModeLevel.RECOVERY,
    affectedFeatures: [],
    recoveryOptions: [
      RecoveryAction.CLEAR_CACHE,
      RecoveryAction.CONTACT_SUPPORT,
    ],
  },
};

/**
 * Load and initialize safe mode configuration from appsettings
 * Merges app config with typed SafeModeConfig interface
 */
/**
 * Load and initialize safe mode configuration from appsettings
 * Configuration is read dynamically to support runtime value changes
 * Merges app config with typed SafeModeConfig interface
 */
function getDefaultSafeModeConfig(): SafeModeConfig {
  const appConfig = getAppConfig();
  return {
    kernelTimeoutMs: appConfig?.safeMode?.kernelTimeoutMs ?? 10000, // 10 second kernel bootstrap timeout
    syncFailureThreshold: appConfig?.safeMode?.syncFailureThreshold ?? 3, // Trigger DEGRADED after 3 consecutive sync failures
    autoRecoveryAttempts: appConfig?.safeMode?.autoRecoveryAttempts ?? 2, // Try to auto-recover twice before escalating
    autoRecoveryDelayMs: appConfig?.safeMode?.autoRecoveryDelayMs ?? 5000, // Wait 5 seconds between auto-recovery attempts
  };
}

export const DEFAULT_SAFE_MODE_CONFIG: SafeModeConfig =
  getDefaultSafeModeConfig();

/**
 * Human-readable messages for each safe mode reason
 * Used by SafeModeScreen to display non-technical user messaging
 */
export const SAFE_MODE_MESSAGES: Record<SafeModeReason, string> = {
  [SafeModeReason.STORAGE_UNREADABLE]:
    "We cannot access your app data. Please try clearing the app cache or reinstalling.",
  [SafeModeReason.STORAGE_CORRUPTED]:
    "Your app data became corrupted. Please restore from a backup or clear the cache.",
  [SafeModeReason.STORAGE_QUOTA_EXCEEDED]:
    "Your device is running out of storage. Please free up space or clear the app cache.",
  [SafeModeReason.AUTH_EXPIRED]:
    "Your session expired. Please log in again to continue.",
  [SafeModeReason.AUTH_INVALID]:
    "There was a problem with your account. Please log in again.",
  [SafeModeReason.SESSION_LOST]:
    "Your session was lost. Please log in again to continue.",
  [SafeModeReason.KERNEL_TIMEOUT]:
    "The app took too long to start. Please try restarting or reinstalling.",
  [SafeModeReason.KERNEL_PRELOAD_FAILED]:
    "Failed to load app resources. Please try restarting the app.",
  [SafeModeReason.KERNEL_CONFIG_FAILED]:
    "Failed to configure the app. Please reinstall or contact support.",
  [SafeModeReason.NETWORK_SYNC_FAILURES]:
    "Unable to sync your data. Check your internet connection and try again.",
  [SafeModeReason.NETWORK_CASCADE]:
    "Multiple network issues detected. Some features are temporarily unavailable.",
  [SafeModeReason.NETWORK_UNAVAILABLE]:
    "No internet connection. Some features require internet to work.",
  [SafeModeReason.UNKNOWN]:
    "An unexpected error occurred. Please try restarting the app.",
};

/**
 * Helper to get definition for a safe mode reason
 * Returns level, affected features, and recovery options
 */
export function getSafeModeDefinition(
  reason: SafeModeReason,
): (typeof SAFE_MODE_DEFINITIONS)[SafeModeReason] {
  return (
    SAFE_MODE_DEFINITIONS[reason] ||
    SAFE_MODE_DEFINITIONS[SafeModeReason.UNKNOWN]
  );
}

/**
 * Helper to get human-readable message for a safe mode reason
 */
export function getSafeModeMessage(reason: SafeModeReason): string {
  return (
    SAFE_MODE_MESSAGES[reason] || SAFE_MODE_MESSAGES[SafeModeReason.UNKNOWN]
  );
}

/**
 * Helper to create a SafeModeState from a reason
 * Automatically determines level, features, and recovery options
 */
export function createSafeModeState(
  reason: SafeModeReason,
  options?: {
    details?: string;
    originalError?: Error;
  },
): SafeModeState {
  const definition = getSafeModeDefinition(reason);

  return {
    level: definition.level,
    reason,
    affectedFeatures: definition.affectedFeatures,
    recoveryOptions: definition.recoveryOptions,
    timestamp: Date.now(),
    details: options?.details,
    originalError: options?.originalError,
  };
}
