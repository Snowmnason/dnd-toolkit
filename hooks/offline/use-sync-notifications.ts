/**
 * useSyncNotifications Hook
 * Subscribes to sync manager status and displays Toast/Snackbar notifications
 * for sync events (started, completed, failures).
 *
 * Returns both toast and snackbar state objects that can be spread into respective components.
 *
 * Usage:
 *   const { toastProps, snackbarProps } = useSyncNotifications();
 *   // Render: <AppToast {...toastProps} /> and <SnackBar {...snackbarProps} />
 */

import { getAppConfig } from "@/lib/config";
import { useEffect, useMemo, useState } from "react";
import { OnlineSyncManager } from "../../lib/offline/sync-manager";
import { OfflineSyncStatus } from "../../lib/offline/types";

interface ToastState {
  visible: boolean;
  message: string;
  type: "info" | "success";
  duration: number;
}

interface SnackbarState {
  visible: boolean;
  message: string;
  tone: "error" | "warning";
  actionText: string;
  onAction: () => void;
  duration: number;
}

interface SyncNotificationsReturn {
  toastProps: ToastState;
  snackbarProps: SnackbarState;
}

export function useSyncNotifications(): SyncNotificationsReturn {
  const toastDuration = useMemo(
    () => getAppConfig().ui?.toastDurationMs ?? 2500,
    [],
  );
  const syncToastDuration = useMemo(
    () => getAppConfig().ui?.syncToastDurationMs ?? 3000,
    [],
  );

  const [toastState, setToastState] = useState<ToastState>({
    visible: false,
    message: "",
    type: "info",
    duration: toastDuration,
  });

  const [snackbarState, setSnackbarState] = useState<SnackbarState>({
    visible: false,
    message: "",
    tone: "error",
    actionText: "Retry",
    onAction: () => {},
    duration: 6000,
  });

  useEffect(() => {
    const subscription = OnlineSyncManager.subscribe(
      (status: OfflineSyncStatus) => {
        // Sync started
        if (status.isSyncing && status.syncedCount === 0) {
          setToastState({
            visible: true,
            message: `Syncing ${status.totalQueued} change${status.totalQueued > 1 ? "s" : ""}...`,
            type: "info",
            duration: toastDuration,
          });
        }

        // Sync completed successfully
        if (
          !status.isSyncing &&
          status.totalQueued === 0 &&
          status.syncedCount > 0 &&
          status.failedCount === 0
        ) {
          setToastState({
            visible: true,
            message: `${status.syncedCount} change${status.syncedCount > 1 ? "s" : ""} synced.`,
            type: "success",
            duration: syncToastDuration,
          });
        }

        // Sync had failures
        if (status.failedCount > 0) {
          setSnackbarState({
            visible: true,
            message: `Failed to sync ${status.failedCount} item${status.failedCount > 1 ? "s" : ""}. Retrying...`,
            tone: "error",
            actionText: "Retry Now",
            onAction: async () => {
              // Trigger manual sync retry
              await OnlineSyncManager.syncAll();
              setSnackbarState((prev) => ({
                ...prev,
                visible: false,
              }));
            },
            duration: 6000,
          });
        }
      },
    );

    return () => {
      subscription?.();
    };
  }, [toastDuration, syncToastDuration]);

  return {
    toastProps: {
      visible: toastState.visible,
      message: toastState.message,
      type: toastState.type,
      duration: toastState.duration,
    },
    snackbarProps: {
      visible: snackbarState.visible,
      message: snackbarState.message,
      tone: snackbarState.tone,
      actionText: snackbarState.actionText,
      onAction: snackbarState.onAction,
      duration: snackbarState.duration,
    },
  };
}
