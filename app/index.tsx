import Welcome from "@/Screens/Welcome";
import { SplashScreen } from "@/components/SplashScreen";
import { useBootstrapAuth } from "@/hooks/auth";
import { useAppKernel } from "@/hooks/kernel";
import { logger } from "@/hooks/utils";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

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

  // Check storage for a recent login to skip the welcome screen
  const { checked: isAuthChecked, hasAccount } = useBootstrapAuth(kernel.phases.appReady);

  // Show failsafe button after timeout, but only if we haven't completed auth check
  React.useEffect(() => {
    const timer = setTimeout(() => {
      // Only show failsafe if we're still waiting for auth check
      if (!isAuthChecked) {
        logger.category("bootstrap").warn(
          "⏱️ Failsafe timeout reached, showing manual navigation button",
        );
        setShowFailsafe(true);
      }
    }, FAILSAFE_TIMEOUT);

    return () => clearTimeout(timer);
  }, [isAuthChecked]);

  // Redirect to world selection when the hook confirms a recent login
  React.useEffect(() => {
    if (!isAuthChecked || !hasAccount) return;
    logger.category("bootstrap").info("✅ Recent login detected, redirecting to world selection");
    const t = setTimeout(() => router.replace("/select/world-selection"), 100);
    return () => clearTimeout(t);
  }, [isAuthChecked, hasAccount, router]);

  console.log(
    `[ui] [HomePage] render — appReady=${kernel.phases.appReady}, isAuthChecked=${isAuthChecked}, hasAccount=${hasAccount}`,
  );

  // While kernel is initializing, UIBlockerLayer (in _layout.tsx) shows the splash.
  // Render a fallback SplashScreen here too in case UIBlockerLayer is not yet mounted.
  if (!kernel.phases.appReady) {
    console.log('[ui] [HomePage] → rendering SplashScreen (kernel not ready)');
    return <SplashScreen subtitle="Loading App" message="Preparing your world..." />;
  }

  // Show welcome screen once auth check is complete
  // For authenticated users: they'll see the welcome screen momentarily,
  // but the select route guard will pull them to /select/world-selection
  if (isAuthChecked) {
    console.log(
      `[ui] [HomePage] → rendering Welcome screen (hasAccount=${hasAccount})`,
    );

    return (
      <View style={styles.container}>
        <Welcome />

        {showFailsafe && (
          <View style={styles.failsafeContainer}>
            <Pressable
              style={styles.failsafeButton}
              onPress={() => {
                logger.category("bootstrap").info(
                  "🚪 User clicked failsafe button, navigating to welcome",
                );
                // Welcome screen is already showing, so this is a manual refresh
              }}
            >
              <Text style={styles.failsafeIcon}>{randomLocation.icon}</Text>
              <Text style={styles.failsafeText}>{randomLocation.text}</Text>
              <Text style={styles.failsafeSubtext}>Manual Navigation</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  // Auth check in progress — show splash screen to avoid white flash.
  // UIBlockerLayer has already hidden (kernel is ready), so this route
  // must render visible content during the async storage reads.
  console.log('[ui] [HomePage] → rendering SplashScreen (auth check in progress)');
  return <SplashScreen subtitle="Authenticating" message="Checking your credentials..." />;
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
