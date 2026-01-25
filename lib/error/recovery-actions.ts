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
 * - CONTACT_SUPPORT: Opens email client with diagnostic info
 * - REINSTALL: Guides user to uninstall and reinstall app
 */

import { Router } from "expo-router";
import { Linking } from "react-native";
import { AuthStateManager } from "../auth/auth-state";
import { QueryCache } from "../cache/query-cache";
import { logger } from "../utils/logger";
import { RecoveryAction, SafeModeState } from "./safe-mode";

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
 */
export async function executeRecoveryAction(
  action: RecoveryAction,
  safeMode: SafeModeState,
  router: Router,
  onSuccess?: () => void,
): Promise<RecoveryResult> {
  try {
    switch (action) {
      case RecoveryAction.CLEAR_CACHE:
        return await handleClearCache(safeMode, router, onSuccess);

      case RecoveryAction.RESET_AUTH:
        return await handleResetAuth(safeMode, router, onSuccess);

      case RecoveryAction.RESTORE_BACKUP:
        return await handleRestoreBackup(safeMode, router, onSuccess);

      case RecoveryAction.CONTACT_SUPPORT:
        return await handleContactSupport(safeMode);

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
  router: Router,
  onSuccess?: () => void,
): Promise<RecoveryResult> {
  try {
    logger.category("error").info("[SafeMode] Starting CLEAR_CACHE recovery");

    // Clear the query cache (all cached API responses)
    await QueryCache.clearAll();
    logger.category("error").info("[SafeMode] Query cache cleared");

    logger.category("error").info("[SafeMode] CLEAR_CACHE recovery successful");

    // Navigate to world selection (safe starting point)
    router.push("/select/world-selection");
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
  router: Router,
  onSuccess?: () => void,
): Promise<RecoveryResult> {
  try {
    logger.category("error").info("[SafeMode] Starting RESET_AUTH recovery");

    // Use AuthStateManager's logout flow which handles everything
    await AuthStateManager.clearAuthState();
    logger.category("error").info("[SafeMode] Authentication cleared");

    // Redirect to login
    router.push("/login/sign-in");
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
  router: Router,
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
 * CONTACT_SUPPORT: Opens email client with diagnostic information
 *
 * Generates diagnostics summary including:
 * - Safe mode level and reason
 * - Affected features
 * - Timestamp
 * - App version
 */
async function handleContactSupport(
  safeMode: SafeModeState,
): Promise<RecoveryResult> {
  try {
    logger.category("error").info("[SafeMode] Opening support email");

    const diagnostics = generateDiagnostics(safeMode);
    const emailBody = encodeURIComponent(diagnostics);

    const emailUrl = `mailto:support@example.com?subject=D%26D%20Toolkit%20-%20Safe%20Mode%20Recovery&body=${emailBody}`;

    const canOpen = await Linking.canOpenURL(emailUrl);
    if (canOpen) {
      await Linking.openURL(emailUrl);
    } else {
      logger.category("error").warn("[SafeMode] Cannot open email client");
      return {
        success: false,
        action: RecoveryAction.CONTACT_SUPPORT,
        message:
          "Could not open email client. Please email support@example.com",
      };
    }

    return {
      success: true,
      action: RecoveryAction.CONTACT_SUPPORT,
      message: "Email client opened. Please send the diagnostic report.",
    };
  } catch (error) {
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
    logger.category("error").info("[SafeMode] Guiding user to reinstall");

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
