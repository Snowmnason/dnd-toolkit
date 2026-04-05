import { ChromeBottomBar } from "@/components/chrome/ChromeBottomBar";
import { useChrome } from "@/contexts";
import { useAuthGuard } from "@/hooks/auth";
import { useAppKernel } from "@/hooks/kernel";
import { useNavigate } from "@/hooks/navigation";
import { logger } from "@/hooks/utils";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { Platform, useWindowDimensions, View } from "react-native";

export default function MainLayout() {
  const router = useRouter();
  const { replace } = useNavigate();
  const kernel = useAppKernel();
  const authState = useAuthGuard(kernel.phases.appReady, "world-required");
  const params = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const isMobile = Platform.OS !== "web" || width < 900;

  // Chrome context for shared navigation state
  const { activeTab, setActiveTab } = useChrome();

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
      replace("/select/world-selection");
      return;
    }

    // The auth guard already verified access via Supabase, so we're good
    // (see useAuthGuard with 'world-required' level in this component)
    logger.category("navigation").debug("[MainLayout] Auth guard passed, rendering world screen", {
      urlWorldId,
    });
  }, [authState, params.worldId, replace, router]);

  // Update active tab from URL params
  useEffect(() => {
    const tabParam = typeof params.tab === "string" ? params.tab : undefined;
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [params.tab, activeTab]);

  // 🧭 Handle tab switching with centralized navigation helpers
  const handleTabChange = (tabKey: string) => {
    setActiveTab(tabKey); // Update context state for chrome layer
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

  // Always render content - UIBlockerLayer handles loading overlay with splash screen
  return (
    <View style={{ flex: 1 }}>
      {/* Stack for main routes and nested navigation */}
      <Stack screenOptions={{ headerShown: false }} />

      {/* Chrome BottomBar - mobile only (Platform check is inside ChromeBottomBar) */}
      {isMobile && (
        <ChromeBottomBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
      )}
    </View>
  );
}

/*
══════════════════════════════════════════════════════════════════════
   OLD CODE: Commented out for reference during transition
   
   Previous implementation used useState for activeTab management.
   Now replaced with ChromeContext state via useChrome() hook.
   BottomTabBar component is no longer used - replaced with ChromeBottomBar.
   Delete this section once migration is verified.
══════════════════════════════════════════════════════════════════════

  OLD: const [activeTab, setActiveTab] = useState("characters");

  OLD RENDER:
  {isMobile && (
    <BottomTabBar activeTab={activeTab} onTabChange={handleTabChange} />
  )}

══════════════════════════════════════════════════════════════════════ */
