import { logger } from "@/lib/utils/logger";
import { usePlatform } from "@/providers";
import { $, S, UseTheme } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Pressable, View } from "react-native";
import Animated, { FadeInDown, SlideOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Body, Caption } from "./AppText";
import { getShadowStyle } from "./Resuables/shadows";

export type NotificationType = "message" | "update" | "alert" | "info";

export interface NotificationData {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp?: Date;
  avatar?: string; // URL or icon name
  onPress?: () => void;
  onDismiss?: () => void;
}

interface NotificationProps extends NotificationData {
  visible: boolean;
  index?: number; // For stacking multiple notifications
}

/**
 * 🔔 Notification
 * Bouncy drop-in animation with smooth slide-up on dismiss
 * Platform-aware notification banner for messages, updates, and alerts.
 * - Desktop: Top-right corner, stacks vertically
 * - Mobile: Top-center (keyboard-safe), stacks vertically
 */
export function Notification({
  id,
  visible,
  type,
  title,
  message,
  timestamp,
  onPress,
  onDismiss,
  index = 0,
}: NotificationProps) {
  const { theme } = UseTheme();
  const { isMobile } = usePlatform();
  const insets = useSafeAreaInsets();
  logger.category("ui").debug(`[Notification] visible: ${visible}, id=${id}`);

  // Icon based on type
  const iconName =
    type === "message"
      ? "chatbubble"
      : type === "update"
        ? "refresh-circle"
        : type === "alert"
          ? "warning"
          : "information-circle";

  // Memoize all colors to prevent re-renders
  const colors = useMemo(
    () => ({
      icon:
        type === "message"
          ? $("accent", theme)
          : type === "update"
            ? $("info", theme)
            : type === "alert"
              ? $("warning", theme)
              : $("textSecondary", theme),
      surface: $("surface", theme),
      border: $("borderSubtle", theme),
      dismissIcon: $("textSecondary", theme),
    }),
    [type, theme],
  );

  if (!visible) return null;

  const handlePress = () => {
    onPress?.();
  };

  const handleDismiss = () => {
    onDismiss?.();
  };

  // Calculate vertical offset for stacking
  const stackOffset = index * (isMobile ? 90 : 100);
  const baseTop = isMobile ? insets.top + 12 : 80;

  logger.category("ui").debug("Rendering id:", id, "type:", type);

  return (
    <Animated.View
      entering={FadeInDown.duration(500)
        .springify()
        .damping(0.7)
        .delay(index * 80)}
      exiting={SlideOutUp.duration(300)}
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: baseTop + stackOffset,
        left: isMobile ? S.space.lg : "5%",
        right: isMobile ? S.space.lg : "5%",
        zIndex: 9999 - index,
      }}
    >
      <Pressable onPress={handlePress} disabled={!onPress}>
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: S.radius.lg,
            borderWidth: 2,
            borderColor: colors.border,
            ...getShadowStyle("combined"),
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: S.space.sm,
              paddingHorizontal: S.space.md,
              paddingVertical: S.space.sm,
            }}
          >
            {/* Icon */}
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                paddingTop: 2,
                minWidth: 24,
              }}
            >
              <Ionicons name={iconName as any} size={24} color={colors.icon} />
            </View>

            {/* Text content */}
            <View style={{ flex: 1 }}>
              <Body
                fontWeight="600"
                textType="primary"
                style={{ marginBottom: 2 }}
                numberOfLines={1}
              >
                {title}
              </Body>
              <Caption
                textType="secondary"
                style={{ lineHeight: 16 }}
                numberOfLines={2}
              >
                {message}
              </Caption>
              {timestamp && (
                <Caption
                  textType="secondary"
                  opacity={0.6}
                  style={{ marginTop: 4, fontSize: S.font.caption - 1 }}
                >
                  {formatTimestamp(timestamp)}
                </Caption>
              )}
            </View>

            {/* Dismiss button */}
            <Pressable
              onPress={handleDismiss}
              style={{ padding: S.space.xs, marginLeft: "auto" }}
              hitSlop={8}
            >
              <Ionicons name="close" size={18} color={colors.dismissIcon} />
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Format timestamp to relative time
 */
function formatTimestamp(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}
