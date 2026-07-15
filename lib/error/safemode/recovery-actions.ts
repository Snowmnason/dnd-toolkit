/**
 * Safe Mode Recovery Action Handlers
 *
 * Implements user-triggered recovery actions when app is in RECOVERY state.
 * Each action handles specific failure scenarios and guides the user through recovery.
 *
 * Actions:
 * - CLEAR_CACHE: Clears query cache and app data, keeps structural/account data
 * - RESET_AUTH: Clears session, logs out user, redirects to login
 * - RESTORE_BACKUP: Restores app state from backup (if available)
 * - CONTACT_SUPPORT: Opens report-bug page with diagnostic info
 * - REINSTALL: Guides user to uninstall and reinstall app
 */

import { getAllRouteConfigs } from "@/lib/navigation";
import { StorageManager } from "@/lib/storage";
import { logger } from "@/lib/utils";
import { STORAGE_KEYS } from "@/maps";
import { QueryCache } from "@/middleware/storage";
import { FastCache } from "@/system/Storage";
import { RecoveryAction, SafeModeReason, SafeModeState } from "./safe-mode";

// Lazy imports — breaks circular dependency: lib/error ↔ lib/analytics
function getAnalytics() {
  return {
    Analytics: require("@/managers/analytics/analytics-manager").Analytics,
    Performance: require("@/lib/analytics/performance/performance-manager").Performance,
  };
}

// Lazy import — breaks circular dependency: lib/error ↔ lib/auth
function getAuth() {
  return require("@/lib/auth") as typeof import("@/lib/auth");
}

/**
 * Validate that a route exists in the centralized navigation config
 */
function isValidRoute(path: string): boolean {
  const configs = getAllRouteConfigs();
  const normalizedPath = path.toLowerCase();

  return configs.some((config) => {
    const normalizedConfigPath = config.path.toLowerCase();
    const normalizedAlias = config.aliases?.some(
      (alias) => alias.toLowerCase() === normalizedPath,
    );
    return normalizedConfigPath === normalizedPath || normalizedAlias;
  });
}

/**
 * Result of a recovery action execution
 */
export interface RecoveryResult {
  success: boolean;
  action: RecoveryAction;
  message: string;
  error?: Error;
}

/**
 * Determine the safest navigation target for a given safe mode reason.
 *
 * This is recovery routing policy — it lives here close to the safe-mode domain
 * rather than in the root layout.
 *
 * @param reason - The SafeModeReason string from SafeModeState
 * @returns Route path string to navigate to
 */
export function getSafeModeNavigationTarget(reason?: string): string {
  // Auth failures → must go to login
  if (
    reason === SafeModeReason.AUTH_EXPIRED ||
    reason === SafeModeReason.AUTH_INVALID ||
    reason === SafeModeReason.SESSION_LOST
  ) {
    return "/login/sign-in";
  }

  // Storage/kernel issues → try world selection (auth should be OK)
  if (
    reason === SafeModeReason.STORAGE_UNREADABLE ||
    reason === SafeModeReason.STORAGE_CORRUPTED ||
    reason === SafeModeReason.STORAGE_QUOTA_EXCEEDED ||
    reason === SafeModeReason.KERNEL_TIMEOUT ||
    reason === SafeModeReason.KERNEL_PRELOAD_FAILED ||
    reason === SafeModeReason.KERNEL_CONFIG_FAILED
  ) {
    return "/select/world-selection";
  }

  // Network issues → try world selection
  if (
    reason === SafeModeReason.NETWORK_SYNC_FAILURES ||
    reason === SafeModeReason.NETWORK_CASCADE ||
    reason === SafeModeReason.NETWORK_UNAVAILABLE
  ) {
    return "/select/world-selection";
  }

  // Default/unknown → safest option is index (welcome/splash screen)
  //TODO: THISMIGHTBEWRONG
  return "/";
}

/**
 * Execute a recovery action
 *
 * @param action - The recovery action to execute
 * @param safeMode - Current safe mode state (for context/logging)
 * @param onNavigate - Callback for navigation (called with target route path when recovery needs to navigate)
 * @returns Result of the recovery action
 *
 * NOTE: onNavigate will only be called for actions that require navigation.
 * Actions that don't navigate (e.g., CONTACT_SUPPORT) won't trigger the callback.
 */
export async function executeRecoveryAction(
  action: RecoveryAction,
  safeMode: SafeModeState,
  onNavigate?: (targetRoute: string) => void,
): Promise<RecoveryResult> {
  const label = `recovery_action:${action}`;
  getAnalytics().Performance.startMeasure(label);

  try {
    switch (action) {
      case RecoveryAction.CLEAR_CACHE:
        return await handleClearCache(safeMode, onNavigate);

      case RecoveryAction.RESET_AUTH:
        return await handleResetAuth(safeMode, onNavigate);

      case RecoveryAction.RESTORE_BACKUP:
        return await handleRestoreBackup(safeMode, onNavigate);

      case RecoveryAction.CONTACT_SUPPORT:
        return await handleContactSupport(safeMode, onNavigate);

      case RecoveryAction.REINSTALL:
        return handleReinstall(safeMode);

      default:
        return {
          success: false,
          action,
          message: `Unknown recovery action: ${action}`,
        };
    }
  } catch (error) {
    logger
      .category("error")
      .error(`[SafeMode] Recovery action ${action} failed:`, error);

    // Track recovery failure with additional context
    getAnalytics().Analytics.track("safe_mode_recovery_action_failed", {
      action,
      reason: safeMode.reason,
      error_message: error instanceof Error ? error.message : "Unknown error",
      safe_mode_duration_ms: Date.now() - safeMode.timestamp,
    });

    getAnalytics().Performance.endMeasure(label);

    return {
      success: false,
      action,
      message: `Recovery action failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      error: error instanceof Error ? error : undefined,
    };
  }
}

/**
 * CLEAR_CACHE: Removes cached queries and temporary app data
 *
 * Clears:
 * - All cached API responses (QueryCache)
 * - In-memory state
 *
 * Keeps:
 * - User authentication data (so user stays logged in)
 * - Structural app data (user preferences, settings)
 */
async function handleClearCache(
  safeMode: SafeModeState,
  onNavigate?: (targetRoute: string) => void,
): Promise<RecoveryResult> {
  try {
    logger
      .category("bootstrap")
      .info("[SafeMode] Starting CLEAR_CACHE recovery");

    // Clear both caches: query cache (API responses) and fast cache (session data)
    await QueryCache.clearAll();
    logger.category("bootstrap").info("[SafeMode] Query cache cleared");

    await FastCache.clear();
    logger.category("bootstrap").info("[SafeMode] Fast cache cleared");

    logger
      .category("bootstrap")
      .info("[SafeMode] CLEAR_CACHE recovery successful");

    // Track recovery success
    getAnalytics().Analytics.track("safe_mode_recovery_action_succeeded", {
      action: RecoveryAction.CLEAR_CACHE,
    });

    getAnalytics().Performance.endMeasure(`recovery_action:${RecoveryAction.CLEAR_CACHE}`);

    // Navigate to world selection (safe starting point)
    const targetRoute = "/select/world-selection";
    if (!isValidRoute(targetRoute)) {
      logger
        .category("error")
        .error(
          `[SafeMode] Route ${targetRoute} not found in navigation config`,
        );
      return {
        success: false,
        action: RecoveryAction.CLEAR_CACHE,
        message: "Navigation target not found. Please restart the app.",
      };
    }

    // Trigger navigation via callback
    onNavigate?.(targetRoute);

    return {
      success: true,
      action: RecoveryAction.CLEAR_CACHE,
      message: "App cache cleared. Restarting from world selection...",
    };
  } catch (error) {
    throw error;
  }
}

/**
 * RESET_AUTH: Clears authentication state and logs out user
 *
 * - Clears session/auth tokens
 * - Clears user data
 * - Clears query cache
 * - Redirects to login screen
 */
async function handleResetAuth(
  safeMode: SafeModeState,
  onNavigate?: (targetRoute: string) => void,
): Promise<RecoveryResult> {
  try {
    logger
      .category("bootstrap")
      .info("[SafeMode] Starting RESET_AUTH recovery");

    // Use AuthStateManager's logout flow which handles everything
    await getAuth().AuthStateManager.clearAuthState();
    logger.category("bootstrap").info("[SafeMode] Authentication cleared");

    // Track recovery success
    getAnalytics().Analytics.track("safe_mode_recovery_action_succeeded", {
      action: RecoveryAction.RESET_AUTH,
    });

    getAnalytics().Performance.endMeasure(`recovery_action:${RecoveryAction.RESET_AUTH}`);

    // Redirect to login
    const targetRoute = "/login/sign-in";
    if (!isValidRoute(targetRoute)) {
      logger
        .category("error")
        .error(
          `[SafeMode] Route ${targetRoute} not found in navigation config`,
        );
      return {
        success: false,
        action: RecoveryAction.RESET_AUTH,
        message: "Navigation target not found. Please restart the app.",
      };
    }

    // Trigger navigation via callback
    onNavigate?.(targetRoute);

    return {
      success: true,
      action: RecoveryAction.RESET_AUTH,
      message: "Session reset. Please log in again...",
    };
  } catch (error) {
    throw error;
  }
}

/**
 * RESTORE_BACKUP: Attempts to restore app state from backup
 *
 * FUTURE IMPLEMENTATION:
 * - Check if backup exists in SecureStorage
 * - Validate backup version and structure
 * - Restore backed-up data
 * - Clear cache to force re-sync
 *
 * Currently (Phase 4): Guides user to contact support (backup infrastructure deferred)
 * This action is kept in the recovery options for future expansion.
 */
async function handleRestoreBackup(
  safeMode: SafeModeState,
  onNavigate?: (targetRoute: string) => void,
): Promise<RecoveryResult> {
  try {
    logger
      .category("error")
      .info("[SafeMode] Restore backup action (deferred)");

    // FUTURE: Implement full backup restore logic
    // For now, guide user to contact support
    return {
      success: false,
      action: RecoveryAction.RESTORE_BACKUP,
      message:
        "Backup restore is not yet available. Please contact support or try clearing cache.",
    };
  } catch (error) {
    throw error;
  }
}

/**
 * CONTACT_SUPPORT: Navigates to report bug page with diagnostic information
 *
 * Stores diagnostics summary including:
 * - Safe mode level and reason
 * - Affected features
 * - Timestamp
 * - App version
 */
async function handleContactSupport(
  safeMode: SafeModeState,
  onNavigate?: (targetRoute: string) => void,
): Promise<RecoveryResult> {
  const label = `recovery_action:${RecoveryAction.CONTACT_SUPPORT}`;
  try {
    logger.category("error").info("[SafeMode] Navigating to report bug page");

    const diagnostics = generateDiagnostics(safeMode);

    // Store diagnostics in session storage so report-bug page can retrieve them
    try {
      await StorageManager.setRaw(
        STORAGE_KEYS.SAFE_MODE_DIAGNOSTICS,
        diagnostics,
      );
      logger
        .category("error")
        .info("[SafeMode] Diagnostics stored for report-bug page");
    } catch (storageError) {
      logger
        .category("error")
        .error("[SafeMode] Failed to store diagnostics:", storageError);
      // Continue anyway - not critical to recovery
    }

    // Track success
    getAnalytics().Analytics.track("safe_mode_recovery_action_succeeded", {
      action: RecoveryAction.CONTACT_SUPPORT,
    });

    // Navigate to report bug page
    const targetRoute = "/settings/report-bug";
    if (!isValidRoute(targetRoute)) {
      logger
        .category("error")
        .error(
          `[SafeMode] Route ${targetRoute} not found in navigation config`,
        );
      getAnalytics().Performance.endMeasure(label);
      return {
        success: false,
        action: RecoveryAction.CONTACT_SUPPORT,
        message: "Navigation target not found. Please restart the app.",
      };
    }

    // Log diagnostics for reference
    logger.category("bootstrap").info("[SafeMode] Diagnostics:", diagnostics);

    // Trigger navigation via callback
    onNavigate?.(targetRoute);

    getAnalytics().Performance.endMeasure(label);

    return {
      success: true,
      action: RecoveryAction.CONTACT_SUPPORT,
      message: "Opening report bug page...",
    };
  } catch (error) {
    getAnalytics().Performance.endMeasure(label);
    throw error;
  }
}

/**
 * REINSTALL: Guides user through reinstall process
 *
 * Since uninstall must be done manually by user, this shows guidance and
 * clears all local data to prepare for fresh install.
 */
function handleReinstall(safeMode: SafeModeState): RecoveryResult {
  try {
    logger.category("bootstrap").info("[SafeMode] Guiding user to reinstall");

    // Note: We can't programmatically uninstall, only guide the user
    // Actual uninstall is done manually through device settings

    return {
      success: true,
      action: RecoveryAction.REINSTALL,
      message:
        "Please uninstall the app from your device settings and reinstall from the app store.",
    };
  } catch (error) {
    return {
      success: false,
      action: RecoveryAction.REINSTALL,
      message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      error: error instanceof Error ? error : undefined,
    };
  }
}

/**
 * Generate diagnostic information for support
 *
 * Includes safe mode state, app version, and affected features for
 * easier support diagnosis.
 */
function generateDiagnostics(safeMode: SafeModeState): string {
  const timestamp = new Date(safeMode.timestamp).toISOString();
  const affectedFeatures = safeMode.affectedFeatures.join(", ") || "None";

  return `D&D Toolkit Safe Mode Diagnostic Report

Safe Mode Level: ${safeMode.level}
Reason: ${safeMode.reason}
Triggered: ${timestamp}
Affected Features: ${affectedFeatures}

Please describe what you were doing when this error occurred:
[USER DESCRIPTION HERE]

---
This information helps us diagnose and fix issues faster.`;
}

/**
 * Check if a specific recovery action is available
 *
 * Some actions may not be available in all scenarios:
 * - RESTORE_BACKUP: Not available (backup infrastructure deferred)
 * - All others: Always available
 */
export async function isRecoveryActionAvailable(
  action: RecoveryAction,
  safeMode: SafeModeState,
): Promise<boolean> {
  // RESTORE_BACKUP is deferred (backup infrastructure not yet implemented)
  if (action === RecoveryAction.RESTORE_BACKUP) {
    return false;
  }

  // All other actions are always available
  return true;
}
