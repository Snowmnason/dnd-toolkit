import Welcome from "@/Screens/Welcome";
import { SplashScreen } from "@/components/SplashScreen";
import { useBootstrapAuth } from "@/hooks/auth";
import { useAppKernel } from "@/hooks/kernel";
import { logger } from "@/lib/utils";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";

export default function HomePage() {
  const router = useRouter();

  // Wait for kernel to complete before routing
  const kernel = useAppKernel();

  // Check storage for a recent login to skip the welcome screen
  const { checked: isAuthChecked, hasAccount } = useBootstrapAuth(kernel.phases.appReady);

  // Redirect to world selection when the hook confirms a recent login
  React.useEffect(() => {
    if (!isAuthChecked || !hasAccount) return;
    logger.category("bootstrap").info("✅ Recent login detected, redirecting to world selection");
    const t = setTimeout(() => router.replace("/select/world-selection"), 100);
    return () => clearTimeout(t);
  }, [isAuthChecked, hasAccount, router]);

  // console.log(
  //   `[ui] [HomePage] render — appReady=${kernel.phases.appReady}, isAuthChecked=${isAuthChecked}, hasAccount=${hasAccount}`,
  // );

  // While kernel is initializing, UIBlockerLayer (in _layout.tsx) shows the splash.
  // Render a fallback SplashScreen here too in case UIBlockerLayer is not yet mounted.
  if (!kernel.phases.appReady) {

    return <SplashScreen subtitle="Loading App" message="Preparing your world..." />;
  }

  // Show welcome screen once auth check is complete
  // For authenticated users: they'll see the welcome screen momentarily,
  // but the select route guard will pull them to /select/world-selection
  if (isAuthChecked) {

    return (
      <View style={styles.container}>
        <Welcome />
      </View>
    );
  }

  // Auth check in progress — show splash screen to avoid white flash.
  // UIBlockerLayer has already hidden (kernel is ready), so this route
  // must render visible content during the async storage reads.
  return <SplashScreen subtitle="Authenticating" message="Checking your credentials..." />;
}
// Styles for HomePage
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#2f353d",
  },
});
