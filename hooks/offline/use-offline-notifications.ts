/**
 * useOfflineNotifications Hook
 * Subscribes to network state changes and displays Toast notifications
 * for offline/online status transitions.
 *
 * Usage:
 *   const offlineToastProps = useOfflineNotifications();
 *   // Render: <AppToast {...offlineToastProps} />
 */

import { getAppConfig } from "@/config";
import { NetworkDetection, NetworkStatus } from "@/system/Network";
import { useEffect, useRef, useState } from "react";

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
  const lastOnlineStateRef = useRef<boolean | null>(null);

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
