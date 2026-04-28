import { getAppConfig } from '@/config';
import { Analytics, Performance } from "@/hooks/analytics";
import {
  RecoveryAction,
  SafeModeLevel,
  type SafeModeState,
} from "@/hooks/error";
import { getRecoveryActionLabel, getSafeModeDescription } from "@/localization/ErrorMessages";
import { useEffect } from "react";
import { ErrorFallbackShell } from "../ui";

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
  // Use state.timestamp + state.level as dependencies instead of entire state object
  // This ensures analytics are only sent once per safe mode session (unique timestamp per entry)
  // Intentionally exclude state.reason, state.affectedFeatures, and state.recoveryOptions
  // to prevent duplicate analytics events if those properties change within the same session
  useEffect(() => {
    const label = `safe_mode_${state.level}`;
    Performance.startMeasure(label);

    // Track safe mode event with reason and affected features
    // Send affected_features as both array (for querying individual features) and string (for display/context)
    Analytics.track("safe_mode_entered", {
      level: state.level,
      reason: state.reason,
      affected_features: state.affectedFeatures || [], // Array for better queryability
      affected_features_count: state.affectedFeatures?.length || 0, // Count for aggregation
      affected_features_list: state.affectedFeatures?.join(", ") || "none", // String for display context
      recovery_options_count: state.recoveryOptions?.length || 0,
      timestamp: state.timestamp,
    });

    // On unmount, record time spent in safe mode
    return () => {
      Performance.endMeasure(label, 60000); // 60s warning threshold for safe mode duration
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.timestamp, state.level]);

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
      errorTitle="Safe Mode Active"
      explanation={recoveryMessage}
      error={error}
      showDetails={showDetailedErrors}
      primaryButtonText={primaryButtonText}
      onPrimaryAction={onPrimaryAction}
      secondaryButtonText={secondaryButtonText}
      onSecondaryAction={onSecondaryAction}
    />
  );
}
