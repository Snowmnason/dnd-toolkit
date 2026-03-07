import { logger } from "@/lib";
import { buildNavigationTarget } from "@/lib/navigation/uri-helpers";
import { NetworkManager, ConnectionQuality } from "@/lib/network/network-manager";
import { S, UseTheme } from "@/theme";
import { useRouter, useSegments } from "expo-router";
import { memo, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SettingsMenu from "./modals/SettingsModal";
import { AppToast } from "./ui/AppToast";
import { IconButton } from "./ui/IconButton";

// 🎨 Fixed palette (matches BottomTabBar)
const TOPBAR_BG = "#1f262e";
const TOPBAR_BORDER = "#969696";
const TOPBAR_TEXT = "#F5E6D3";

interface TopBarProps {
  title?: string;
  showBackButton?: boolean;
  showHamburger?: boolean;
  onBackPress?: () => void;
  userId?: string;
  worldId?: string;
  userRole?: string;
  a11yFocusTarget?: "title" | "firstInteractive" | "none";
}

function TopBar({
  title = "D&D Toolkit",
  showBackButton = true,
  showHamburger = true,
  onBackPress,
  userId,
  worldId,
  userRole,
  a11yFocusTarget = "title",
}: TopBarProps) {
  const router = useRouter();
  const segments = useSegments();
  const { width } = useWindowDimensions();
  const isMobile = Platform.OS !== "web" || width < 900;
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [networkStatus, setNetworkStatus] = useState(
    NetworkManager.getStatus(),
  );
  const { theme } = UseTheme();
  const insets = useSafeAreaInsets();
  const lastAnnouncedTitle = useRef<string | undefined>(undefined);

  // Subscribe to network status changes
  useEffect(() => {
    const unsubscribe = NetworkManager.subscribe((status) => {
      setNetworkStatus(status);
    });
    return () => unsubscribe();
  }, []);

  // A11y: announce title changes for screen readers without relying on DOM focus
  useEffect(() => {
    if (a11yFocusTarget !== "title") return;

    if (lastAnnouncedTitle.current === title) return;
    lastAnnouncedTitle.current = title;

    // AccessibilityInfo.announceForAccessibility is void; no promise to catch
    AccessibilityInfo.announceForAccessibility(title);
  }, [segments, a11yFocusTarget, title]);

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
      return;
    }
    logger.category("navigation").warn("TopBar back press with no handler; ignoring");
    setShowErrorToast(true);
  };

  const handleHamburgerPress = () => {
    setShowSettingsMenu(true);
  };

  // Get wifi indicator color based on connection quality
  const getWifiColor = () => {
    if (!networkStatus?.isOnline) {
      return "#EF4444"; // Red - no connection
    }
    if (networkStatus.connectionQuality === ConnectionQuality.CELLULAR) {
      return "#FBBF24"; // Yellow - no wifi (cellular)
    }
    if (networkStatus.connectionQuality === ConnectionQuality.BAD) {
      return "#FBBF24"; // Yellow - poor connection
    }
    return "#10B981"; // Green - good connection
  };

  return (
    <>
      <View
        accessibilityRole="header"
        style={[
          styles.container,
          isMobile
            ? [styles.containerMobile, { paddingTop: insets.top + 8 }]
            : styles.containerDesktop,
        ]}
      >
        {/* Left: Back Button (fixed width to reserve space for centering) */}
        <View style={styles.sideSlot}>
          {showBackButton && (
            <IconButton
              variant="text"
              content="←"
              textColor={TOPBAR_TEXT}
              onPress={handleBackPress}
              size="lg"
            />
          )}
        </View>

        {/* Center: Title + WiFi indicator */}
        <View style={styles.centerSlot} pointerEvents="none">
          <Text
            accessibilityLiveRegion="polite"
            style={[
              styles.title,
              { fontFamily: theme.fontFamilyTitle, fontSize: S.font.heading3 },
            ]}
            numberOfLines={1}
            accessible={true}
            accessibilityRole="header"
          >
            {title}
          </Text>
          {(Platform.OS !== "web" ||
            (typeof navigator !== "undefined" &&
              navigator.userAgent.includes("Electron"))) && (
            <View
              style={[
                styles.wifiIndicator,
                { backgroundColor: getWifiColor() },
              ]}
              accessible={true}
              accessibilityLabel={`Network: ${networkStatus?.isOnline ? (networkStatus?.connectionQuality === ConnectionQuality.GOOD ? "Online" : "Weak connection") : "Offline"}`}
            />
          )}
        </View>

        {/* Right: Hamburger Menu (fixed width to mirror left) */}
        <View style={styles.sideSlot}>
          {showHamburger && (
            <IconButton
              variant="text"
              content="☰"
              textColor={TOPBAR_TEXT}
              onPress={handleHamburgerPress}
              size="lg"
            />
          )}
        </View>
      </View>

      {/* Custom Settings Menu */}
      <SettingsMenu
        visible={showSettingsMenu}
        onClose={() => setShowSettingsMenu(false)}
        onAccountSettings={async () => {
          setShowSettingsMenu(false);

          try {
            const { AuthStateManager } = await import("@/lib/auth/auth-state");
            const user = await AuthStateManager.getUserData();
            const username = user?.username || "user";

            // Use centralized navigation helper for settings route
            const target = buildNavigationTarget(
              `/settings/${encodeURIComponent(username)}`,
              { worldId, userRole },
              ["worldId", "userRole"],
            );

            router.push(target as any);
          } catch (err) {
            logger.category("navigation").warn("TopBar: failed to resolve username route, falling back", err);
            setShowErrorToast(true);
          }
        }}
        onReturnToWorldSelection={() => {
          setShowSettingsMenu(false);
          // Use centralized navigation helper
          const target = buildNavigationTarget(
            "/select/world-selection",
            {},
            [],
          );
          router.replace(target as any);
        }}
      />

      {/* Error feedback */}
      <AppToast
        visible={showErrorToast}
        message="Failed to navigate to settings. Please try again."
        type="error"
        onHide={() => setShowErrorToast(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: TOPBAR_BG,
    borderBottomWidth: 1,
    borderBottomColor: TOPBAR_BORDER,
  },
  containerMobile: {
    // Safe area padding handled dynamically
  },
  containerDesktop: {
    paddingTop: 8,
  },
  sideSlot: {
    width: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: TOPBAR_TEXT,
    fontWeight: "700",
    textAlign: "center",
    flexShrink: 1,
  },
  centerSlot: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  wifiIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
    backgroundColor: "#10B981",
    alignSelf: "center",
  },
});

export default memo(TopBar);
