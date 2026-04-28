/**
 * SyncStatus Component
 *
 * Displays offline queue status in the UI.
 * Shows when mutations are pending sync and provides visual feedback:
 * - Spinner while syncing
 * - Pending changes count
 * - Last synced time (human-readable)
 *
 * Only renders when queue has pending mutations (returns null when empty).
 *
 * Usage:
 *   import { SyncStatus } from '@/components/ui';
 *   // In your layout or app root:
 *   <SyncStatus />
 *
 * Example output:
 *   🔄 Syncing... (2 pending changes)
 *   ✓ 2 pending changes • Synced 2 mins ago
 */

import { useOfflineQueue } from "@/hooks/offline/use-offline-queue";
import { $ } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Body, Caption } from "./AppText";

/**
 * Format milliseconds as human-readable relative time
 * Examples: "just now", "2 mins ago", "1 hour ago", "2 days ago"
 */
function formatTimeAgo(timestamp: number | null): string {
  if (!timestamp) return "";

  const now = Date.now();
  const diffMs = now - timestamp;

  // Less than 1 minute
  if (diffMs < 60000) {
    return "just now";
  }

  // Less than 1 hour
  if (diffMs < 3600000) {
    const mins = Math.floor(diffMs / 60000);
    return `${mins} min${mins > 1 ? "s" : ""} ago`;
  }

  // Less than 1 day
  if (diffMs < 86400000) {
    const hours = Math.floor(diffMs / 3600000);
    return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  }

  // Days
  const days = Math.floor(diffMs / 86400000);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

/**
 * SyncStatus Component
 * 
 * Displays offline sync status for user awareness.
 * Returns null if no pending mutations to avoid clutter.
 */
export function SyncStatus(): React.ReactElement | null {
  const { queueSize, isSyncing, lastSyncedAt } = useOfflineQueue();

  const timeAgoText = useMemo(() => {
    return lastSyncedAt ? formatTimeAgo(lastSyncedAt) : "";
  }, [lastSyncedAt]);

  // Don't render if queue is empty
  if (queueSize === 0) {
    return null;
  }

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(300)}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: $("surface"),
        borderTopWidth: 1,
        borderTopColor: $("border"),
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {/* Sync status indicator and pending count */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          {isSyncing ? (
            <Animated.View
              style={{
                width: 16,
                height: 16,
              }}
            >
              <Ionicons
                name="reload"
                size={16}
                color={$("accent")}
                style={{ opacity: 0.8 }}
              />
            </Animated.View>
          ) : (
            <Ionicons
              name="checkmark-circle"
              size={16}
              color={$("success")}
              style={{ opacity: 0.7 }}
            />
          )}

          <Body
            textType="secondary"
            style={{
              fontSize: 13,
            }}
          >
            {queueSize} pending change{queueSize > 1 ? "s" : ""}
          </Body>
        </View>

        {/* Last synced time */}
        {timeAgoText && (
          <Caption
            textType="secondary"
            style={{
              fontSize: 11,
              opacity: 0.6,
            }}
          >
            Synced {timeAgoText}
          </Caption>
        )}
      </View>
    </Animated.View>
  );
}

export default SyncStatus;
