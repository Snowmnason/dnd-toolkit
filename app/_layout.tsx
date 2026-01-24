import { OfflineSyncNotificationLayer } from "@/components/offline";
import { NotificationContainer, TopBar } from "@/components/ui";
import { useAnalyticsNavigation } from "@/hooks/use-analytics-navigation";
import { NotificationProvider } from "@/hooks/use-notifications";
import {
  AppErrorBoundary,
  getRouteConfig,
  resolveBackTarget,
  resolveTitle,
} from "@/lib";
import { Analytics, sessionManager } from "@/lib/analytics";
import { getAppConfig } from "@/lib/config/loader";
import { AppKernelProvider, useAppKernel } from "@/lib/kernel";
import { buildNavigationTarget } from "@/lib/navigation/uri-helpers";
import { lazyLoadInBackground } from "@/lib/utils/lazy-imports";
import { logger } from "@/lib/utils/logger";
import { ScaleProvider } from "@/providers/ScaleProvider";
import { SubscriptionProvider } from "@/providers/SubscriptionProvider";
import { ThemeProvider, UseTheme } from "@/theme";
import Constants from "expo-constants";
import {
  Stack,
  useLocalSearchParams,
  useRouter,
  useSegments,
} from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import LoadingOverlay from "../components/LoadingOverlay";
import {
  CrashFallBack,
  RouteErrorBoundary,
  SplashScreen,
} from "../components/SplashScreen";
import {
  AppParamsStableProvider,
  useAppParamsStable,
  useUserId,
} from "../contexts/AppParamsStableContext";
import {
  AppParamsVolatileProvider,
  useAppParamsVolatile,
  useUserRole,
  useWorldId,
} from "../contexts/AppParamsVolatileContext";
import { PlatformProvider, usePlatform } from "../contexts/PlatformContext";
import { useSplashScreen } from "../hooks/use-splash-screen";
import { APP_VERSION } from "../lib/utils/version";

// Check if Sentry is enabled via feature flag
const config = getAppConfig();
const isSentryEnabled = config.features?.sentryEnabled ?? false;

// Get Sentry DSN from environment variables
const sentryDsn =
  process.env.EXPO_PUBLIC_SENTRY_DSN || Constants.expoConfig?.extra?.sentryDsn;

// Get environment from Expo config or default to development/production
const environment =
  process.env.EXPO_PUBLIC_ENVIRONMENT ||
  Constants.expoConfig?.extra?.environment ||
  "production";

const isDev = environment === "development";

// Lazy initialize Sentry only if enabled via feature flag AND DSN is provided
if (isSentryEnabled && sentryDsn) {
  lazyLoadInBackground(async () => {
    const Sentry = await import("@sentry/react-native");
    Sentry.init({
      dsn: sentryDsn,
      environment,
      release: `dnd-toolkit@${APP_VERSION}`,
      debug: isDev,
      sampleRate: isDev ? 1.0 : 0.1,
      sendDefaultPii: true,
      enableLogs: isDev,
      beforeSend: (event) => {
        if (isDev) {
          if (
            event.exception?.values?.[0]?.value?.includes(
              "Network request failed",
            )
          ) {
            return null;
          }
          if (event.exception?.values?.[0]?.value?.includes("Loading chunk")) {
            return null;
          }
        }
        return event;
      },
    });
    logger.info("[Sentry] Initialized in background");
    return Sentry;
  }, "Sentry").catch((error) => {
    logger.warn("[Sentry] Failed to initialize:", error);
  });
} else {
  if (!isSentryEnabled) {
    logger.info(
      "[Sentry] Disabled via feature flag (sentryEnabled=false) - not loading",
    );
  } else if (!sentryDsn) {
    logger.info("[Sentry] Disabled - no DSN provided");
  }
}

function RootLayoutContent() {
  // ==================== HOOKS SECTION ====================
  // ALL hooks must be called unconditionally before any early returns
  // (React Rules of Hooks requirement)

  // Theme and routing hooks
  const { theme } = UseTheme();
  const urlParams = useLocalSearchParams();
  const router = useRouter();
  const segments = useSegments();
  const { isMobile } = usePlatform();

  // Context hooks
  const userId = useUserId();
  const worldId = useWorldId();
  const userRole = useUserRole();
  const { updateVolatileParams, clearWorldParams } = useAppParamsVolatile();
  const { clearAllParams } = useAppParamsStable();

  // Data loading hooks
  const kernel = useAppKernel();
  const splash = useSplashScreen();

  // FUTURE: Offline conflict resolution (disabled for v1 - LWW only)
  // v1 uses automatic Last-Write-Wins for all conflicts

  // Log every render with session ID
  // Debug: Uncomment to trace root layout renders
  // useEffect(() => {
  //   logger.debug(
  //     "navigation",
  //     `[SESSION:${sessionId}] 📍 Root layout rendered - route: ${segments[0] || "index"}`,
  //   );
  // }, [sessionId, segments]);
  // Analytics hook (must be called unconditionally)
  useAnalyticsNavigation();

  // ==================== EFFECT HOOKS SECTION ====================
  // All effects that depend on above hooks

  // Identify user to analytics when available
  useEffect(() => {
    Analytics.identify(userId ? { id: userId } : null);

    // Start session when user is identified
    if (userId) {
      sessionManager.startSession(userId);
    }
  }, [userId]);

  // Update context params when URL params change
  useEffect(() => {
    const firstSegment = typeof segments[0] === "string" ? segments[0] : "";

    // Main routes: allow initial set from URL only if context is empty; otherwise ignore overrides
    if (firstSegment === "main") {
      const urlWorldId =
        typeof urlParams.worldId === "string" ? urlParams.worldId : undefined;
      const urlUserRole =
        typeof urlParams.userRole === "string" ? urlParams.userRole : undefined;

      // If no world in context yet, seed from URL once (owner navigating directly to their world)
      if (!worldId && urlWorldId) {
        logger.info("[NavGuard] Seeding world from URL on main route", {
          urlWorldId,
          urlUserRole,
        });
        updateVolatileParams({ worldId: urlWorldId, userRole: urlUserRole });
      }
      // Skip further processing for main routes to avoid clearing params
      return;
    }

    const currentWorldId =
      typeof urlParams.worldId === "string" ? urlParams.worldId : undefined;
    const currentUserRole =
      typeof urlParams.userRole === "string" ? urlParams.userRole : undefined;

    // Only update if values are different from context (userId is loaded from storage, not URL)
    let shouldUpdate = false;
    const updates: { worldId?: string; userRole?: string } = {};
    if (currentWorldId && currentWorldId !== worldId) {
      updates.worldId = currentWorldId;
      shouldUpdate = true;
    }
    if (currentUserRole && currentUserRole !== userRole) {
      updates.userRole = currentUserRole;
      shouldUpdate = true;
    }

    if (shouldUpdate) {
      updateVolatileParams(updates);
    }

    // Only clear params when entering login routes and params exist
    if (segments[0] === "login" && (userId || worldId || userRole)) {
      clearAllParams();
    }
    // Only clear world params when entering select routes and world params exist
    else if (segments[0] === "select" && (worldId || userRole)) {
      clearWorldParams();
    }
  }, [
    urlParams,
    segments,
    updateVolatileParams,
    clearAllParams,
    clearWorldParams,
    userId,
    worldId,
    userRole,
  ]);

  // ==================== RENDER LOGIC SECTION ====================
  // Show splash screen (if enabled via feature flag)
  // Splash screen displays BEFORE any other content
  if (splash.showSplash) {
    return <SplashScreen />;
  }

  // Show loading while app kernel is initializing
  if (!kernel.phases.appReady) {
    return (
      <LoadingOverlay
        message="Loading D&D Toolkit..."
        error={kernel.error}
        assetsLoaded={kernel.phases.preloadReady}
      />
    );
  }

  // Determine if we should show the TopBar - hide on login routes and index route
  // Hide TopBar when: on login flow, on welcome screen, on root/index (loading screen), or web routes (downloads)
  const firstSegment = typeof segments[0] === "string" ? segments[0] : "";
  const isRootRoute = segments[0] === undefined;
  const hideTopBar =
    isRootRoute || firstSegment === "login" || firstSegment === "web";

  // Build navigation context for route config
  const navContext = {
    segments,
    params: {
      worldId: worldId as string | undefined,
      userRole: userRole as string | undefined,
    },
    router,
    worldId: worldId as string | undefined,
    userRole: userRole as string | undefined,
    isMobile,
  };

  // Get route config for centralized TopBar, back behavior, and a11y
  const routeConfig = getRouteConfig(navContext);
  const topBarTitle = !hideTopBar
    ? resolveTitle(routeConfig, navContext)
    : undefined;
  const topBarBackTarget = !hideTopBar
    ? resolveBackTarget(routeConfig, navContext)
    : undefined;

  // Build back press handler using config
  const handleTopBarBack = () => {
    if (topBarBackTarget) {
      // Check if back target has params to preserve
      if (routeConfig.preserveParamsOnBack && (worldId || userRole)) {
        const target = buildNavigationTarget(
          topBarBackTarget,
          { worldId, userRole },
          routeConfig.preserveParamsOnBack || [],
        );
        router.replace(target as any);
      } else {
        router.replace(topBarBackTarget as any);
      }
    } else {
      const fallbackTarget = buildNavigationTarget(
        "/select/world-selection",
        { worldId, userRole },
        ["worldId", "userRole"],
      );
      router.replace(fallbackTarget as any);
    }
  };

  return (
    <RouteErrorBoundary
      routeConfig={routeConfig}
      navigationContext={navContext}
      fallbackRoute="/select/world-selection"
    >
      <View
        style={{
          height: "100%",
          width: "100%",
          backgroundColor: theme.background || "#2f353d",
        }}
      >
        {/* Global TopBar - driven by centralized navigation config */}
        {!hideTopBar && topBarTitle && (
          <TopBar
            title={topBarTitle}
            showBackButton={routeConfig.back !== undefined}
            showHamburger={routeConfig.showHamburger}
            onBackPress={handleTopBarBack}
            userId={userId}
            worldId={worldId}
            userRole={userRole}
            a11yFocusTarget={routeConfig.a11yFocusTarget}
          />
        )}

        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: "$background",
            },
          }}
        />

        {/* Notification Container - renders all queued notifications */}
        <NotificationContainer />

        {/* Offline sync status and notifications */}
        <OfflineSyncNotificationLayer />

        {/* FUTURE: Conflict resolution modal (disabled for v1 - LWW only) */}
        {/* v1 uses automatic Last-Write-Wins for all conflicts */}
      </View>
    </RouteErrorBoundary>
  );
}

// Main export with provider wrapper and error boundary
export default function RootLayout() {
  return (
    <AppKernelProvider>
      <ThemeProvider>
        <ScaleProvider>
          <PlatformProvider>
            <SubscriptionProvider>
              <AppParamsStableProvider>
                <AppParamsVolatileProvider>
                  <NotificationProvider>
                    <AppErrorBoundary
                      renderFallback={(error, onRetry) => (
                        <CrashFallBack error={error} onRetry={onRetry} />
                      )}
                    >
                      <RootLayoutContent />
                    </AppErrorBoundary>
                  </NotificationProvider>
                </AppParamsVolatileProvider>
              </AppParamsStableProvider>
            </SubscriptionProvider>
          </PlatformProvider>
        </ScaleProvider>
      </ThemeProvider>
    </AppKernelProvider>
  );
}
