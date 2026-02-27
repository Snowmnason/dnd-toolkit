import { AppLoading } from "@/components/ui";
import { useAuthGuard } from "@/hooks/auth";
import { useAppKernel } from "@/hooks/kernel";
import { buildRoute } from "@/lib/navigation/uri-helpers";
import { logger } from "@/lib/utils/logger";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, useWindowDimensions, View } from "react-native";
import { BottomTabBar } from "../../Screens/main-panels/BottomTabBar";

export default function MainLayout() {
  const router = useRouter();
  const kernel = useAppKernel();
  const authState = useAuthGuard(kernel.phases.appReady, "world-required");
  const params = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState("characters");
  const { width } = useWindowDimensions();
  const isMobile = Platform.OS !== "web" || width < 900;

  // All hooks must be called unconditionally (before any conditional returns)
  useEffect(() => {
    logger.category("navigation").info("[MainLayout] Rendering with params", {
      worldId: params.worldId,
      userRole: params.userRole,
    });
  }, [params.worldId, params.userRole]);

  // Validate world access on mount and when worldId changes
  useEffect(() => {
    // Skip validation while auth guard is still checking
    if (authState === "loading") return;

    const urlWorldId =
      typeof params.worldId === "string" ? params.worldId : undefined;

    // If no worldId in URL, redirect (shouldn't happen as guard checks this)
    if (!urlWorldId) {
      logger.category("navigation").warn(
        "[MainLayout] No worldId in URL, redirecting to world selection",
      );
      router.replace(buildRoute("/select/world-selection") as any);
      return;
    }

    // The auth guard already verified access via Supabase, so we're good
    // (see useAuthGuard with 'world-required' level in this component)
    logger.category("navigation").debug("[MainLayout] Auth guard passed, rendering world screen", {
      urlWorldId,
    });
  }, [authState, params.worldId, router]);

  // Update active tab from URL params
  useEffect(() => {
    const tabParam = typeof params.tab === "string" ? params.tab : undefined;
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [params.tab, activeTab]);

  // 🧭 Handle tab switching with centralized navigation helpers
  const handleTabChange = (tabKey: string) => {
    setActiveTab(tabKey); // Update UI immediately for responsive feedback
    const worldId =
      typeof params.worldId === "string" ? params.worldId : undefined;
    const userRole =
      typeof params.userRole === "string" ? params.userRole : undefined;

    // Build query string manually for reliability
    const query = new URLSearchParams();
    if (worldId) query.append("worldId", worldId);
    if (userRole) query.append("userRole", userRole);
    query.append("tab", tabKey);

    const target = `/main/main-landing?${query.toString()}`;
    router.replace(target as any);
  };

  // Show loading while auth guard is resolving
  if (authState === "loading") {
    return <AppLoading />;
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Stack for main routes and nested navigation */}
      <Stack screenOptions={{ headerShown: false }} />

      {/* Bottom bar only for mobile */}
      {isMobile && (
        <BottomTabBar activeTab={activeTab} onTabChange={handleTabChange} />
      )}
    </View>
  );
}
