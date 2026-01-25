import { Analytics, Performance } from "@/lib/analytics";
import { getAppConfig } from "@/lib/config/loader";
import {
  RecoveryAction,
  SafeModeLevel,
  SafeModeReason,
  SafeModeState,
} from "@/lib/error/safe-mode";
import { useEffect } from "react";
import VersionDisplay from "../VersionDisplay";
import { ErrorFallbackShell } from "./ErrorFallbackShell";

/**
 * Safe Mode Screen
 *
 * Unified screen for DEGRADED, SAFE, and RECOVERY states.
 * - DEGRADED/SAFE: Shows reason, affected features, "Back to Navigation" button
 * - RECOVERY: Shows reason, affected features, explicit recovery action buttons
 *
 * Uses ErrorFallbackShell with 'safe-mode' message pack for consistent error UI
 */
export interface SafeModeScreenProps {
  state: SafeModeState;
  onNavigateHome?: () => void;
  onRecoveryAction?: (action: RecoveryAction) => void;
}

// Human-readable safe mode reason descriptions
function getSafeModeDescription(reason: SafeModeReason): string {
  switch (reason) {
    case SafeModeReason.STORAGE_UNREADABLE:
      return "Your app data cannot be read right now. This is usually temporary.";
    case SafeModeReason.STORAGE_CORRUPTED:
      return "Your app data may be corrupted. You can clear the cache to recover.";
    case SafeModeReason.STORAGE_QUOTA_EXCEEDED:
      return "Your device is running out of storage space. Try clearing some space.";

    case SafeModeReason.AUTH_EXPIRED:
      return "Your session has expired. Please log in again to continue.";
    case SafeModeReason.AUTH_INVALID:
      return "Your authentication is invalid. Please try logging in again.";
    case SafeModeReason.SESSION_LOST:
      return "Your session was lost. Please log in again.";

    case SafeModeReason.KERNEL_TIMEOUT:
      return "The app took too long to start. Try restarting the app.";
    case SafeModeReason.KERNEL_PRELOAD_FAILED:
      return "Some app resources failed to load. Try restarting.";
    case SafeModeReason.KERNEL_CONFIG_FAILED:
      return "App configuration failed. Try restarting.";

    case SafeModeReason.NETWORK_SYNC_FAILURES:
      return "We're having trouble syncing your data. Check your internet connection.";
    case SafeModeReason.NETWORK_CASCADE:
      return "Multiple network failures detected. Check your connection and try again.";
    case SafeModeReason.NETWORK_UNAVAILABLE:
      return "No internet connection detected. Some features are unavailable.";

    case SafeModeReason.UNKNOWN:
    default:
      return "Something went wrong. Your adventure is safe—we're working on it!";
  }
}

// Get recovery action label for UI
function getRecoveryActionLabel(action: RecoveryAction): string {
  switch (action) {
    case RecoveryAction.CLEAR_CACHE:
      return "Clear Cache & Restart";
    case RecoveryAction.RESET_AUTH:
      return "Reset & Log In Again";
    case RecoveryAction.RESTORE_BACKUP:
      return "Restore from Backup";
    case RecoveryAction.CONTACT_SUPPORT:
      return "Contact Support";
    case RecoveryAction.REINSTALL:
      return "Reinstall App";
    default:
      return "Unknown Action";
  }
}

export function SafeModeScreen({
  state,
  onNavigateHome,
  onRecoveryAction,
}: SafeModeScreenProps) {
  const config = getAppConfig();
  const isDev =
    (process.env.EXPO_PUBLIC_ENVIRONMENT || "production") === "development";
  const showDetailedErrors = config.overrides?.verboseErrorMessages ?? isDev;

  // Track safe mode entry when component mounts
  useEffect(() => {
    const label = `safe_mode_${state.level}`;
    Performance.startMeasure(label);

    // Track safe mode event with reason and affected features
    Analytics.track("safe_mode_entered", {
      level: state.level,
      reason: state.reason,
      affected_features: state.affectedFeatures?.join(",") || "none",
      recovery_options_count: state.recoveryOptions?.length || 0,
      timestamp: state.timestamp,
    });

    // On unmount, record time spent in safe mode
    return () => {
      Performance.endMeasure(label, 60000); // 60s warning threshold for safe mode duration
    };
  }, [state]);

  const isRecovery = state.level === SafeModeLevel.RECOVERY;

  const description = getSafeModeDescription(state.reason);

  // Build recovery message with description and affected features
  let recoveryMessage = description;
  if (state.affectedFeatures && state.affectedFeatures.length > 0) {
    recoveryMessage += `\n\nAffected: ${state.affectedFeatures.join(", ")}`;
  }

  // Build recovery error for dev mode
  let error: Error | undefined;
  if (showDetailedErrors && state.timestamp) {
    error = new Error(
      `Safe Mode: ${state.reason}\nTimestamp: ${new Date(state.timestamp).toISOString()}`,
    );
  }

  // Determine primary action
  let primaryButtonText = "Back to Navigation";
  let onPrimaryAction: () => void = () => {
    Analytics.track("safe_mode_action", {
      action: "navigate_home",
      level: state.level,
      reason: state.reason,
    });
    onNavigateHome?.();
  };

  // If in recovery state, use first recovery option as primary
  if (isRecovery && state.recoveryOptions?.[0]) {
    const firstAction = state.recoveryOptions[0];
    primaryButtonText = getRecoveryActionLabel(firstAction);
    onPrimaryAction = () => {
      Analytics.track("safe_mode_recovery_action_selected", {
        action: firstAction,
        level: state.level,
        reason: state.reason,
      });
      onRecoveryAction?.(firstAction);
    };
  }

  // Secondary button (if recovery has multiple options)
  const secondaryButtonText =
    isRecovery && state.recoveryOptions?.[1]
      ? getRecoveryActionLabel(state.recoveryOptions[1])
      : undefined;

  const onSecondaryAction =
    isRecovery && state.recoveryOptions?.[1]
      ? () => {
          const secondAction = state.recoveryOptions![1];
          Analytics.track("safe_mode_recovery_action_selected", {
            action: secondAction,
            level: state.level,
            reason: state.reason,
          });
          onRecoveryAction?.(secondAction);
        }
      : undefined;

  return (
    <ErrorFallbackShell
      messagePack="safe-mode"
      error={error}
      showDetails={showDetailedErrors}
      recoveryMessage={recoveryMessage}
      primaryButtonText={primaryButtonText}
      onPrimaryAction={onPrimaryAction}
      secondaryButtonText={secondaryButtonText}
      onSecondaryAction={onSecondaryAction}
      footer={<VersionDisplay />}
    />
  );
}
