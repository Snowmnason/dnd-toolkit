/**
 * useOfflineNotifications Hook
 * Subscribes to network state changes and displays Toast notifications
 * for offline/online status transitions.
 *
 * Usage:
 *   const offlineToastProps = useOfflineNotifications();
 *   // Render: <AppToast {...offlineToastProps} />
 */

import { NetworkDetection, NetworkStatus } from "@/lib/network";
import { useEffect, useState } from "react";

interface OfflineToastState {
  visible: boolean;
  message: string;
  type: "info" | "warning";
  duration: number;
}

export function useOfflineNotifications(): OfflineToastState {
  const [toastState, setToastState] = useState<OfflineToastState>({
    visible: false,
    message: "",
    type: "info",
    duration: 2500,
  });

  useEffect(() => {
    const subscription = NetworkDetection.subscribe((status: NetworkStatus) => {
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

      // Auto-hide after duration (in AppToast component's duration prop)
      const timer = setTimeout(() => {
        setToastState((prev) => ({
          ...prev,
          visible: false,
        }));
      }, 4000);

      return () => clearTimeout(timer);
    });

    return () => {
      subscription?.();
    };
  }, []);

  return toastState;
}
