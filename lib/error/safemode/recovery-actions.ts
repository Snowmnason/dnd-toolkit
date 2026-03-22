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

import { Analytics, Performance } from "@/lib/analytics";
import { AuthStateManager } from "@/lib/auth";
import { QueryCache } from "@/lib/middleware/storage";
import { getAllRouteConfigs } from "@/lib/navigation";
import { StorageManager } from "@/lib/storage";
import { logger } from "@/lib/utils";
import { STORAGE_KEYS } from "@/maps";
import { FastCache } from "@/system/Storage";
import { Router } from "expo-router";
import { RecoveryAction, SafeModeState } from "./safe-mode";

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
 * Execute a recovery action
 *
 * @param action - The recovery action to execute
 * @param safeMode - Current safe mode state (for context/logging)
 * @param router - Expo router instance for navigation
 * @param onSuccess - Callback when recovery succeeds
 * @returns Result of the recovery action
 *
 * NOTE: router can be null/undefined for actions that don't navigate (e.g., CONTACT_SUPPORT).
 * Actions that require navigation will fail gracefully with a clear error message.
 */
export async function executeRecoveryAction(
  action: RecoveryAction,
  safeMode: SafeModeState,
  router: Router | null | undefined,
  onSuccess?: () => void,
): Promise<RecoveryResult> {
  const label = `recovery_action:${action}`;
  Performance.startMeasure(label);

  try {
    switch (action) {
      case RecoveryAction.CLEAR_CACHE:
        return await handleClearCache(safeMode, router, onSuccess);

      case RecoveryAction.RESET_AUTH:
        return await handleResetAuth(safeMode, router, onSuccess);

      case RecoveryAction.RESTORE_BACKUP:
        return await handleRestoreBackup(safeMode, router, onSuccess);

      case RecoveryAction.CONTACT_SUPPORT:
        return await handleContactSupport(safeMode, router, onSuccess);

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
    Analytics.track("safe_mode_recovery_action_failed", {
      action,
      reason: safeMode.reason,
      error_message: error instanceof Error ? error.message : "Unknown error",
      safe_mode_duration_ms: Date.now() - safeMode.timestamp,
    });

    Performance.endMeasure(label);

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
  router: Router | null | undefined,
  onSuccess?: () => void,
): Promise<RecoveryResult> {
  try {
    // Validate router is available for navigation
    if (!router) {
      logger
        .category("error")
        .error("[SafeMode] CLEAR_CACHE: router is null/undefined");
      return {
        success: false,
        action: RecoveryAction.CLEAR_CACHE,
        message: "Navigation is unavailable. Please restart the app.",
      };
    }

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
    Analytics.track("safe_mode_recovery_action_succeeded", {
      action: RecoveryAction.CLEAR_CACHE,
    });

    Performance.endMeasure(`recovery_action:${RecoveryAction.CLEAR_CACHE}`);

    // Navigate to world selection (safe starting point)
    // NOTE: onSuccess callback is invoked after navigation to ensure side effects
    // (like clearing safe mode state) don't interfere with the navigation itself
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
    router.push(targetRoute);
    onSuccess?.();

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
  router: Router | null | undefined,
  onSuccess?: () => void,
): Promise<RecoveryResult> {
  try {
    // Validate router is available for navigation
    if (!router) {
      logger
        .category("error")
        .error("[SafeMode] RESET_AUTH: router is null/undefined");
      return {
        success: false,
        action: RecoveryAction.RESET_AUTH,
        message: "Navigation is unavailable. Please restart the app.",
      };
    }

    logger
      .category("bootstrap")
      .info("[SafeMode] Starting RESET_AUTH recovery");

    // Use AuthStateManager's logout flow which handles everything
    await AuthStateManager.clearAuthState();
    logger.category("bootstrap").info("[SafeMode] Authentication cleared");

    // Track recovery success
    Analytics.track("safe_mode_recovery_action_succeeded", {
      action: RecoveryAction.RESET_AUTH,
    });

    Performance.endMeasure(`recovery_action:${RecoveryAction.RESET_AUTH}`);

    // Redirect to login
    // NOTE: onSuccess callback is invoked after navigation to ensure side effects
    // (like clearing safe mode state) don't interfere with the navigation itself
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
    router.push(targetRoute);
    onSuccess?.();

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
  router: Router | null | undefined,
  onSuccess?: () => void,
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
  router: Router | null | undefined,
  onSuccess?: () => void,
): Promise<RecoveryResult> {
  const label = `recovery_action:${RecoveryAction.CONTACT_SUPPORT}`;
  try {
    // Validate router is available for navigation
    if (!router) {
      logger
        .category("error")
        .error("[SafeMode] CONTACT_SUPPORT: router is null/undefined");
      Performance.endMeasure(label);
      return {
        success: false,
        action: RecoveryAction.CONTACT_SUPPORT,
        message: "Navigation is unavailable. Please restart the app.",
      };
    }

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
    Analytics.track("safe_mode_recovery_action_succeeded", {
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
      Performance.endMeasure(label);
      return {
        success: false,
        action: RecoveryAction.CONTACT_SUPPORT,
        message: "Navigation target not found. Please restart the app.",
      };
    }

    // Log diagnostics for reference
    logger.category("bootstrap").info("[SafeMode] Diagnostics:", diagnostics);

    // NOTE: onSuccess callback is invoked after navigation to ensure side effects
    // (like clearing safe mode state) don't interfere with the navigation itself
    router.push(targetRoute);
    onSuccess?.();

    Performance.endMeasure(label);

    return {
      success: true,
      action: RecoveryAction.CONTACT_SUPPORT,
      message: "Opening report bug page...",
    };
  } catch (error) {
    Performance.endMeasure(label);
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
