import { logger, useAppKernel } from "@/lib";
import { STORAGE_KEYS, getPrivacyStorageBackend } from "@/lib/storage";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Welcome from "../Screens/Welcome";
import LoadingOverlay from "../components/LoadingOverlay";

const FAILSAFE_TIMEOUT = 8000; // Show failsafe button after 8 seconds

const TAVERN_LOCATIONS = [
  { text: "Enter the Tavern", icon: "🍺" },
  { text: "Enter the Dungeon", icon: "🗝️" },
  { text: "Enter the Castle", icon: "🏰" },
  { text: "Enter the Camp", icon: "⛺" },
  { text: "Enter the Plane", icon: "✨" },
  { text: "Enter the Guild Hall", icon: "🛡️" },
  { text: "Enter the Temple", icon: "⛪" },
  { text: "Enter the Dragon's Lair", icon: "🐉" },
];

export default function HomePage() {
  const router = useRouter();
  const [showFailsafe, setShowFailsafe] = React.useState(false);
  const [isAuthChecked, setIsAuthChecked] = React.useState(false);
  const [hasAccount, setHasAccount] = React.useState(false);

  // Pick a random location on mount
  const randomLocation = React.useMemo(() => {
    const randomIndex = Math.floor(Math.random() * TAVERN_LOCATIONS.length);
    // Use .at() to safely access array element
    const location = TAVERN_LOCATIONS.at(randomIndex);
    if (!location) {
      // Fallback to first location if random index fails
      const fallback = TAVERN_LOCATIONS.at(0);
      return fallback || { text: "Enter the Tavern", icon: "🍺" };
    }
    return location;
  }, []);

  // Wait for kernel to complete before routing
  const kernel = useAppKernel();

  // Show failsafe button after timeout, but only if we haven't completed auth check
  React.useEffect(() => {
    const timer = setTimeout(() => {
      // Only show failsafe if we're still waiting for auth check
      if (!isAuthChecked) {
        logger.warn(
          "bootstrap",
          "⏱️ Failsafe timeout reached, showing manual navigation button",
        );
        setShowFailsafe(true);
      }
    }, FAILSAFE_TIMEOUT);

    return () => clearTimeout(timer);
  }, [isAuthChecked]);

  // Simple time-based check: if user logged in within 7 days, redirect (skip welcome)
  React.useEffect(() => {
    // Don't proceed until kernel is complete
    if (!kernel.phases.appReady) {
      logger.debug("bootstrap", "⏸️ Waiting for kernel to complete");
      return;
    }

    logger.info("bootstrap", "🚀 Kernel ready! Checking login recency...");

    const checkLoginRecency = async () => {
      try {
        // CRITICAL: Check hasAccount first - if user logged out, don't use cached login time
        // This prevents the redirect loop after logout
        const hasAccountBackend = getPrivacyStorageBackend(
          STORAGE_KEYS.HAS_ACCOUNT,
        );
        const authState = await hasAccountBackend.getJSON<{
          hasAccount: boolean;
        }>(STORAGE_KEYS.HAS_ACCOUNT);
        const hasAccount = authState?.hasAccount === true;

        // If user explicitly logged out (hasAccount is false/null/undefined), show welcome
        if (!hasAccount) {
          logger.debug(
            "bootstrap",
            "⏭️ User not logged in (hasAccount=false), showing welcome",
          );
          setIsAuthChecked(true);
          setHasAccount(false);
          return;
        }

        // User is logged in, check if their last login is recent
        const lastLoggedInBackend = getPrivacyStorageBackend(
          STORAGE_KEYS.LAST_LOGGED_IN,
        );
        const lastLoggedInStr = await lastLoggedInBackend.getItem(
          STORAGE_KEYS.LAST_LOGGED_IN,
        );

        if (!lastLoggedInStr) {
          logger.debug(
            "bootstrap",
            "⏭️ No recent login found, showing welcome",
          );
          setIsAuthChecked(true);
          setHasAccount(false);
          return;
        }

        const lastLoggedInMs = parseInt(lastLoggedInStr, 10);
        const now = Date.now();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
        const isWithinSevenDays = now - lastLoggedInMs < sevenDaysMs;

        if (isWithinSevenDays) {
          logger.info(
            "bootstrap",
            `✅ Recent login detected (${Math.floor((now - lastLoggedInMs) / (1000 * 60 * 60))} hours ago), redirecting to world selection`
          );
          setIsAuthChecked(true);
          setHasAccount(true);
          // Redirect to world selection after a brief moment to ensure state is set
          setTimeout(() => {
            router.replace("/select/world-selection");
          }, 100);
          return;
        }

        logger.debug(
          "bootstrap",
          "⏭️ Login is stale (>7 days), showing welcome",
        );
        setIsAuthChecked(true);
        setHasAccount(false);
      } catch (error) {
        // If check fails, just show welcome - no harm done
        logger.debug(
          "bootstrap",
          "⚠️ Login recency check failed, showing welcome:",
          error,
        );
        setIsAuthChecked(true);
        setHasAccount(false);
      }
    };

    checkLoginRecency();
  }, [kernel.phases.appReady, router]);

  // Show loading spinner while kernel is initializing
  if (!kernel.phases.appReady) {
    const loadingMessage = kernel.phases.preloadReady
      ? "Restoring session..."
      : "Loading assets...";
    logger.debug(
      "bootstrap",
      "⏳ Rendering index loading overlay:",
      loadingMessage,
    );

    return (
      <View style={styles.container}>
        <LoadingOverlay
          message={loadingMessage}
          error={kernel.error}
          assetsLoaded={kernel.phases.preloadReady}
        />
      </View>
    );
  }

  // Show welcome screen once auth check is complete
  // For authenticated users: they'll see the welcome screen momentarily,
  // but the select route guard will pull them to /select/world-selection
  if (isAuthChecked) {
    logger.debug(
      "bootstrap",
      `📋 Rendering welcome screen (hasAccount: ${hasAccount})`,
    );

    return (
      <View style={styles.container}>
        <Welcome />

        {showFailsafe && (
          <View style={styles.failsafeContainer}>
            <TouchableOpacity
              style={styles.failsafeButton}
              onPress={() => {
                logger.info(
                  "bootstrap",
                  "🚪 User clicked failsafe button, navigating to welcome",
                );
                // Welcome screen is already showing, so this is a manual refresh
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.failsafeIcon}>{randomLocation.icon}</Text>
              <Text style={styles.failsafeText}>{randomLocation.text}</Text>
              <Text style={styles.failsafeSubtext}>Manual Navigation</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // Show loading while determining auth status
  logger.debug("bootstrap", "⏳ Checking auth status...");
  return (
    <View style={styles.container}>
      <LoadingOverlay
        message="Checking authentication..."
        error={kernel.error}
        assetsLoaded={kernel.phases.preloadReady}
      />
    </View>
  );
}
// Using StyleSheet since this is a fail safe with a very specific style
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#2f353d",
  },
  failsafeContainer: {
    position: "absolute",
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10000,
  },
  failsafeButton: {
    backgroundColor: "rgba(212, 175, 55, 0.95)", // Gold
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: "#8B4513", // Saddle brown
    boxShadow: "#000, 0 4px 8px",
    elevation: 8,
    alignItems: "center",
    minWidth: 200,
  },
  failsafeIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  failsafeText: {
    color: "#2f353d",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 2,
  },
  failsafeSubtext: {
    color: "rgba(47, 53, 61, 0.7)",
    fontSize: 12,
    textAlign: "center",
    fontStyle: "italic",
  },
});
