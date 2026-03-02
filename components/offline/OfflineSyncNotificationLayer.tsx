/**
 * OfflineSyncNotificationLayer Component
 * Aggregates offline and sync notifications and renders them as Toast/Snackbar.
 * Mount this once near the app root (e.g., in AppKernel provider or top-level layout).
 *
 * Notification Priority & Sequencing:
 * - Offline notifications (warning/info) take priority when offline status changes
 * - Sync notifications (progress/success) are shown only when online and syncing
 * - Snackbar (errors) are always visible when there are sync failures
 * - Uses a simple state machine to prevent race conditions and flickering
 *
 * Usage:
 *   <OfflineSyncNotificationLayer />
 */

import { AppToast, SnackBar } from "@/components/ui";
import { useOfflineNotifications, useSyncNotifications } from "@/hooks/offline";
import { useEffect, useState } from "react";

interface ActiveToastState {
  message: string;
  type: "info" | "warning" | "success";
  visible: boolean;
  duration: number;
}

export function OfflineSyncNotificationLayer() {
  const offlineToast = useOfflineNotifications();
  const { toastProps: syncToast, snackbarProps: syncSnackbar } =
    useSyncNotifications();

  // State machine to prevent race condition between offline and sync toasts
  // When offline toast becomes invisible, delay showing sync toast to avoid flicker
  const [activeToast, setActiveToast] =
    useState<ActiveToastState>(offlineToast);

  useEffect(() => {
    if (offlineToast.visible) {
      // Offline status changed: show offline toast immediately
      setActiveToast({
        message: offlineToast.message,
        type: offlineToast.type,
        visible: offlineToast.visible,
        duration: offlineToast.duration,
      });
    } else if (syncToast.visible) {
      // Offline toast is done; only show sync toast if it's visible
      // Small delay to avoid visual flicker from rapid toast switching
      const timer = setTimeout(() => {
        setActiveToast({
          message: syncToast.message,
          type: syncToast.type,
          visible: syncToast.visible,
          duration: syncToast.duration,
        });
      }, 100);
      return () => clearTimeout(timer);
    } else {
      // Both are invisible; keep showing last active toast briefly to avoid flicker
      const timer = setTimeout(() => {
        setActiveToast({
          message: syncToast.message,
          type: syncToast.type,
          visible: syncToast.visible,
          duration: syncToast.duration,
        });
      }, 50);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    offlineToast.visible,
    offlineToast.message,
    syncToast.visible,
    syncToast.message,
  ]);

  return (
    <>
      <AppToast
        message={activeToast.message}
        type={activeToast.type}
        visible={activeToast.visible}
        duration={activeToast.duration}
      />
      <SnackBar
        message={syncSnackbar.message}
        tone={syncSnackbar.tone}
        visible={syncSnackbar.visible}
        actionText={syncSnackbar.actionText}
        onAction={syncSnackbar.onAction}
        duration={syncSnackbar.duration}
      />
    </>
  );
}
