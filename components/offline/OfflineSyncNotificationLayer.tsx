/**
 * OfflineSyncNotificationLayer Component
 * Aggregates offline and sync notifications and renders them as Toast/Snackbar.
 * Mount this once near the app root (e.g., in AppKernel provider or top-level layout).
 *
 * Usage:
 *   <OfflineSyncNotificationLayer />
 */

import { AppToast, SnackBar } from "@/components/ui";
import { useOfflineNotifications, useSyncNotifications } from "@/lib/offline";

export function OfflineSyncNotificationLayer() {
  const offlineToast = useOfflineNotifications();
  const { toastProps: syncToast, snackbarProps: syncSnackbar } =
    useSyncNotifications();

  // Determine which toast to show (offline takes priority over sync)
  const activeToast = offlineToast.visible ? offlineToast : syncToast;

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
