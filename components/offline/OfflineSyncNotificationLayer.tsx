/**
 * OfflineSyncNotificationLayer Component
 * Aggregates offline and sync notifications and shows them via centralized toast system.
 * Mount this once near the app root (e.g., in AppKernel provider or top-level layout).
 *
 * Notification Priority & Sequencing:
 * - Offline notifications (warning/info) take priority when offline status changes
 * - Sync notifications (progress/success) are shown only when online and syncing
 * - Snackbar (errors) are always visible when there are sync failures
 * - Uses the centralized AppToast system for consistent positioning/animation
 *
 * Usage:
 *   <OfflineSyncNotificationLayer />
 */

import { useAppSnackbar } from "@/contexts/app-snackbar-context";
import { useAppToast } from "@/contexts/app-toast-context";
import { useOfflineNotifications, useSyncNotifications } from "@/hooks/offline";
import { useEffect, useRef } from "react";

export function OfflineSyncNotificationLayer() {
  const offlineToast = useOfflineNotifications();
  const { toastProps: syncToast, snackbarProps: syncSnackbar } =
    useSyncNotifications();
  const { show: showToast } = useAppToast();
  const { show: showSnackbar } = useAppSnackbar();

  // Track last shown message to avoid duplicates
  const lastShownRef = useRef<string>('');

  useEffect(() => {
    if (offlineToast.visible) {
      const key = `offline:${offlineToast.message}`;
      if (lastShownRef.current !== key) {
        lastShownRef.current = key;
        showToast('Status', offlineToast.message, offlineToast.type, offlineToast.duration);
      }
    } else if (syncToast.visible) {
      const key = `sync:${syncToast.message}`;
      if (lastShownRef.current !== key) {
        lastShownRef.current = key;
        // Small delay to avoid visual flicker from rapid toast switching
        const timer = setTimeout(() => {
          showToast('Sync', syncToast.message, syncToast.type, syncToast.duration);
        }, 100);
        return () => clearTimeout(timer);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    offlineToast.visible,
    offlineToast.message,
    syncToast.visible,
    syncToast.message,
  ]);

  // Show sync error snackbar via centralized system
  useEffect(() => {
    if (syncSnackbar.visible) {
      showSnackbar(syncSnackbar.message, {
        tone: syncSnackbar.tone,
        duration: syncSnackbar.duration,
        actionText: syncSnackbar.actionText,
        onAction: syncSnackbar.onAction,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncSnackbar.visible, syncSnackbar.message]);

  return null;
}
