/**
 * Offline & Sync Notification Hooks
 *
 * useOfflineNotifications — Toast for online/offline transitions.
 * useSyncNotifications   — Toast/Snackbar for sync progress events.
 *
 * Usage:
 *   const offlineToastProps = useOfflineNotifications();
 *   const { toastProps, snackbarProps } = useSyncNotifications();
 */

import { getAppConfig } from "@/config";
import { OnlineSyncManager } from "@/lib/offline";
import { NetworkDetection, NetworkStatus } from "@/system/Network";
import { OfflineSyncStatus } from "@/type-definitions/mutation-queue-types";
import { useEffect, useMemo, useRef, useState } from "react";

interface OfflineToastState {
  visible: boolean;
  message: string;
  type: "info" | "warning";
  duration: number;
}

export function useOfflineNotifications(): OfflineToastState {
  const toastDuration = getAppConfig().ui?.toastDurationMs ?? 2500;

  const [toastState, setToastState] = useState<OfflineToastState>({
    visible: false,
    message: "",
    type: "info",
    duration: toastDuration,
  });

  // Use ref to track the timer ID for cleanup (prevents memory leaks)
  // Timer can be either a number (browser) or NodeJS.Timeout (Node/Electron)
  const timerRef = useRef<NodeJS.Timeout | number | null>(null);
  // Initialize to the current online state to prevent showing "Back Online" on first status update
  const lastOnlineStateRef = useRef<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    const subscription = NetworkDetection.subscribe((status: NetworkStatus) => {
      // Only show toast if online status CHANGED (not on every status update)
      // This prevents toast spam from connection quality changes during pings
      const onlineChanged = lastOnlineStateRef.current !== status.isOnline;
      lastOnlineStateRef.current = status.isOnline;

      if (!onlineChanged) {
        // No change in online status, skip notification
        return;
      }

      // Clear any existing timer before creating a new one
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      if (!status.isOnline) {
        // Going offline
        setToastState({
          visible: true,
          message: "You are offline. Changes will sync when online.",
          type: "warning",
          duration: 4000,
        });
      } else {
        // Coming back online
        setToastState({
          visible: true,
          message: "You are back online.",
          type: "info",
          duration: 4000,
        });
      }

      // Auto-hide after duration
      // Store timer ID in ref so we can clear it on next status change
      timerRef.current = setTimeout(() => {
        setToastState((prev) => ({
          ...prev,
          visible: false,
        }));
        timerRef.current = null;
      }, 4000);
    });

    // Cleanup: clear timer and unsubscribe when component unmounts
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      subscription?.();
    };
  }, []);

  return toastState;
}

// ─── Sync Notifications ───────────────────────────────────────────────────────

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

/**
 * Subscribe to sync manager status and surface Toast/Snackbar props for sync events
 * (started, completed, failures).
 */
export function useSyncNotifications(): SyncNotificationsReturn {
  const toastDuration = useMemo(() => getAppConfig().ui?.toastDurationMs ?? 2500, []);
  const syncToastDuration = useMemo(() => getAppConfig().ui?.syncToastDurationMs ?? 3000, []);

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
    const subscription = OnlineSyncManager.subscribe((status: OfflineSyncStatus) => {
      if (status.isSyncing && status.syncedCount === 0) {
        setToastState({
          visible: true,
          message: `Syncing ${status.totalQueued} change${status.totalQueued > 1 ? "s" : ""}...`,
          type: "info",
          duration: toastDuration,
        });
      }

      if (!status.isSyncing && status.totalQueued === 0 && status.syncedCount > 0 && status.failedCount === 0) {
        setToastState({
          visible: true,
          message: `${status.syncedCount} change${status.syncedCount > 1 ? "s" : ""} synced.`,
          type: "success",
          duration: syncToastDuration,
        });
      }

      if (status.failedCount > 0) {
        setSnackbarState({
          visible: true,
          message: `Failed to sync ${status.failedCount} item${status.failedCount > 1 ? "s" : ""}. Retrying...`,
          tone: "error",
          actionText: "Retry Now",
          onAction: async () => {
            await OnlineSyncManager.syncAll();
            setSnackbarState((prev) => ({ ...prev, visible: false }));
          },
          duration: 6000,
        });
      }
    });

    return () => { subscription?.(); };
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
