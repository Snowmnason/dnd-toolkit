import {
  AppErrorBoundary,
  AppToastLayer,
  ChromeLayer,
  JobOperationLayer,
  NavDrawerLayer,
  NotificationContainer,
  SnackBarLayer,
  UIBlockerLayer
} from "@/components";
import SettingsModal from "@/components/modals/SettingsModal";
import { OfflineSyncNotificationLayer } from "@/components/offline";
import {
  CrashFallBack,
  RouteErrorBoundary,
  SafeModeErrorBoundary,
  SafeModeScreen,
} from "@/components/SplashScreen";
import { OverlayProvider, useChrome } from "@/contexts";
// Trigger modal registration side effects — must run before any openModal() call.
// Imported here (leaf module) instead of modal-context.tsx to avoid circular dependency.
import "@/components/modals/register-all-modals";
import { getAppConfig } from "@/config";
import { Analytics, sessionManager } from "@/hooks/analytics";
import { SafeModeReason, executeRecoveryAction } from "@/hooks/error";
import { useClearSafeMode } from "@/hooks/error/use-safe-mode";
import { useAppKernel, useKernelLoadingSync, useSyncSplash } from "@/hooks/kernel";
import { usePanelNavigation, useRouteChangeObserver, useRouteConfig } from "@/hooks/navigation";
import {
  type AccessRole,
} from "@/hooks/storage";
import { logger, useInjectToastSystem } from "@/hooks/utils";
import {
  AppKernelProvider,
  SubscriptionProvider,
  UseTheme,
  useAppParamsStable,
  useAppParamsVolatile,
  usePlatform,
  useUserId,
  useUserRole,
  useWorldId
} from "@/providers";
import { AppParamsProvider } from "@/providers/AppParamsProvider";
import { ViewportProvider } from "@/providers/ViewportProvider";
import {
  Stack,
  useLocalSearchParams,
  useRouter,
  useSegments,
} from "expo-router";
import { useEffect } from "react";
import { Platform, View } from "react-native";

// Suppress known benign warnings from React Navigation / Expo Router / React Native Web
// 1. "Blocked aria-hidden on an element because its descendant retained focus"
//    - Focus management timing issue in navigation library (doesn't affect functionality)
// 2. "props.pointerEvents is deprecated. Use style.pointerEvents"
//    - Coming from third-party components during bootstrap; we're fixing this proactively in our codebase
if (typeof window !== "undefined") {
  const originalWarn = console.warn;

  console.warn = (...args: any[]) => {
    try {
      const message = args[0]?.toString?.() || "";
      if (
        (message.includes("Blocked aria-hidden") &&
          message.includes("descendant retained focus")) ||
        message.includes("props.pointerEvents is deprecated")
      ) {
        return; // Suppress these specific warnings
      }
    } catch {
      // Ignore errors in filter logic, pass through to original warn
    }
    originalWarn(...args);
  };
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
  const { closeSettingsMenu, settingsMenuVisible } = useChrome();

  // Data loading hooks
  const kernel = useAppKernel();
  const clearKernelSafeMode = useClearSafeMode();

  // Sync kernel bootstrap state with UIBlocker overlay.
  // Shows splash screen while kernel initializes, updates phase progress,
  // and hides automatically when appReady or on kernel error.
  useKernelLoadingSync();
  useSyncSplash();

  // Inject the centralized toast system for degradation handlers
  // Allows lib/error layers to display toasts without React dependencies
  useInjectToastSystem();

  // FUTURE: Offline conflict resolution (disabled for v1 - LWW only)
  // v1 uses automatic Last-Write-Wins for all conflicts

  // Log every render with session ID
  // Debug: Uncomment to trace root layout renders
  // useEffect(() => {
  //   logger.category('navigation').debug(
  //     `[SESSION:${sessionId}] 📍 Root layout rendered - route: ${segments[0] || "index"}`,
  //   );
  // }, [sessionId, segments]);

  // NavDrawer feature flag: Determine if drawer should be rendered based on global flag and route
  const config = getAppConfig();
  const navDrawerConfig = config.ui?.navDrawer;
  const navDrawerEnabled = navDrawerConfig?.enabled ?? false;
  const skipRoutes = navDrawerConfig?.skipRoutes ?? [];
  const currentRoute = segments[0] || 'index';
  const shouldRenderNavDrawer = navDrawerEnabled && !skipRoutes.includes(currentRoute);

  // Navigation hooks (must be called unconditionally before any early returns)
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

  const { config: routeConfig, title: resolvedTitle, backTarget: topBarBackTarget } = useRouteConfig(navContext);
  const panelNav = usePanelNavigation();

  // Route change observer — catches deep links, URL edits, back button
  // Mounted unconditionally; starts observing once kernel.phases.appReady gates the tree
  useRouteChangeObserver();

  // ==================== EFFECT HOOKS SECTION ====================
  // All effects that depend on above hooks

  // Reset right panel to left whenever the route group changes.
  // Prevents stale panel state (right panel open) from persisting across navigations.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { panelNav.goToLeftPanel(); }, [(segments as string[])[0], (segments as string[])[1]]);

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
        typeof urlParams.userRole === "string" ? (urlParams.userRole as AccessRole) : undefined;

      // If no world in context yet, seed from URL once (owner navigating directly to their world)
      if (!worldId && urlWorldId) {
        logger.category("navigation").info("[NavGuard] Seeding world from URL on main route", {
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
      typeof urlParams.userRole === "string" ? (urlParams.userRole as AccessRole) : undefined;

    // Only update if values are different from context (userId is loaded from storage, not URL)
    let shouldUpdate = false;
    const updates: { worldId?: string; userRole?: AccessRole } = {};
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
  // Note: UIBlockerLayer (outermost in provider tree) handles all loading overlays.
  // Kernel and other systems call setLoading() via useUIBlocker().

  // Helper to determine safe navigation target based on safe mode reason
  const getNavigationTarget = (reason?: string): string => {
    // Auth failures → must go to login
    if (
      reason === SafeModeReason.AUTH_EXPIRED ||
      reason === SafeModeReason.AUTH_INVALID ||
      reason === SafeModeReason.SESSION_LOST
    ) {
      return "/login/sign-in";
    }

    // Storage/kernel issues → try world selection (auth should be OK)
    if (
      reason === SafeModeReason.STORAGE_UNREADABLE ||
      reason === SafeModeReason.STORAGE_CORRUPTED ||
      reason === SafeModeReason.STORAGE_QUOTA_EXCEEDED ||
      reason === SafeModeReason.KERNEL_TIMEOUT ||
      reason === SafeModeReason.KERNEL_PRELOAD_FAILED ||
      reason === SafeModeReason.KERNEL_CONFIG_FAILED
    ) {
      return "/select/world-selection";
    }

    // Network issues → try world selection
    if (
      reason === SafeModeReason.NETWORK_SYNC_FAILURES ||
      reason === SafeModeReason.NETWORK_CASCADE ||
      reason === SafeModeReason.NETWORK_UNAVAILABLE
    ) {
      return "/select/world-selection";
    }

    // Default/unknown → safest option is index (welcome/splash screen)
    return "/";
  };

  // DEBUG: Log safe mode state
  if (kernel.safeMode) {
    console.log('[ui] [RootLayoutContent] → rendering SafeModeScreen', {
      reason: kernel.safeMode?.reason,
      level: kernel.safeMode?.level,
    });
  }

  // Show safe mode screen if app entered safe mode (takes priority over normal rendering)
  // CRITICAL: SafeModeScreen is wrapped in error boundary - if it crashes, we still have fallback UI
  if (kernel.safeMode) {
    return (
      <SafeModeErrorBoundary>
        <SafeModeScreen
          state={kernel.safeMode}
          onNavigateHome={() => {
            // Navigate to appropriate route based on safe mode reason
            const target = getNavigationTarget(kernel.safeMode?.reason);
            router.replace(target as any);
          }}
          onRecoveryAction={async (action) => {
            // Execute the recovery action
            logger
              .category("bootstrap")
              .info(`[SafeMode] Executing recovery action: ${action}`);

            try {
              const result = await executeRecoveryAction(
                action,
                kernel.safeMode!,
                router,
                () => {
                  // On success, clear the safe mode state to exit safe mode
                  // This allows the app to resume normal operation after recovery
                  logger
                    .category("bootstrap")
                    .info(`[SafeMode] Recovery action succeeded: ${action}`);
                  clearKernelSafeMode();
                },
              );

              if (!result.success) {
                logger
                  .category("error")
                  .warn(`[SafeMode] Recovery action failed: ${result.message}`);
              }
            } catch (error) {
              logger
                .category("error")
                .error("[SafeMode] Recovery action execution failed:", error);
            }
          }}
        />
      </SafeModeErrorBoundary>
    );
  }

  // Determine if we should show the TopBar - hide on login routes and index route
  // Hide TopBar when: on login flow, on welcome screen, on root/index (loading screen), or web routes (downloads)
  const firstSegment = typeof segments[0] === "string" ? segments[0] : "";
  const isRootRoute = segments[0] === undefined;
  const hideTopBar =
    isRootRoute || firstSegment === "login" || firstSegment === "web";

  const topBarTitle = !hideTopBar ? resolvedTitle : undefined;

  // Build back press handler using config
  // Panel navigation gets first chance to handle back (right panel → left panel on mobile)
  const handleTopBarBack = () => {
    // If panel navigation handles the back (mobile right→left), stop here
    if (panelNav.handleBackPress()) {
      return;
    }

    if (topBarBackTarget) {
      if (routeConfig.preserveParamsOnBack && (worldId || userRole)) {
        navigateTo(
          topBarBackTarget,
          { worldId, userRole },
          routeConfig.preserveParamsOnBack || [],
        );
      } else {
        router.replace(topBarBackTarget as any);
      }
    } else {
      navigateTo(
        "/select/world-selection",
        { worldId, userRole },
        ["worldId", "userRole"],
      );
    }
  };

  // SettingsMenu handlers
  const handleAccountSettings = async () => {
    closeSettingsMenu();
    try {
      const { AuthStateManager } = await import("@/lib/auth/auth-state");
      const user = await AuthStateManager.getUserData();
      const username = user?.username || "user";

      // TODO: replace when navigation adapter is fully built
      router.push({
        pathname: `/settings/${encodeURIComponent(username)}` as any,
        params: { worldId, userRole },
      });
    } catch (err) {
      logger.category("navigation").warn("Root layout: failed to resolve username route, falling back", err);
    }
  };

  const handleReturnToWorldSelection = () => {
    closeSettingsMenu();
    // TODO: replace when navigation adapter is fully built
    router.replace("/select/world-selection" as any);
  };

  return (
    <RouteErrorBoundary
      routeConfig={routeConfig}
      navigationContext={navContext}
      fallbackRoute="/select/world-selection"
    >
      <View
        style={{
          flex: 1,
          flexDirection: 'column',
          backgroundColor: theme.background || "#2f353d",
        }}
      >
        {/* Gate the entire navigator tree on appReady.
            UIBlockerLayer already shows the splash screen on top during bootstrap,
            but React still mounts and runs effects in hidden components unless we
            explicitly suppress mounting. Rendering null here prevents route-level
            useEffects (auth guards, data fetches, etc.) from firing against
            uninitialized services during bootstrap. */}
        {kernel.phases.appReady && (
          <>
            {/* Global ChromeLayer (TopBar + BottomBar) - driven by centralized navigation config */}
            {!hideTopBar && topBarTitle && (
              <ChromeLayer
                topBar={{
                  title: topBarTitle,
                  showBackButton: routeConfig.back !== undefined,
                  showHamburger: routeConfig.showHamburger ?? false,
                  onBackPress: handleTopBarBack,
                  a11yFocusTarget: routeConfig.a11yFocusTarget,
                }}
              />
            )}

            {/* SettingsMenu Modal */}
            <SettingsModal
              visible={settingsMenuVisible}
              onClose={closeSettingsMenu}
              onAccountSettings={handleAccountSettings}
              onReturnToWorldSelection={handleReturnToWorldSelection}
            />

            {/* Content area: sidebar + stack in row layout on desktop */}
            <View style={{ flex: 1, flexDirection: Platform.OS === 'web' ? 'row' : 'column' }}>
              {/* Desktop sidebar — inline, always visible, animated width (feature-flagged) */}
              {Platform.OS === 'web' && shouldRenderNavDrawer && <NavDrawerLayer mode="expandable" />}

              {/* Stack container - flex-grows to fill remaining space */}
              <View style={{ flex: 1 }}>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: {
                      backgroundColor: "$background",
                    },
                  }}
                />
              </View>
            </View>

            {/* Notification Container - renders all queued notifications */}
            <NotificationContainer />

            {/* App Toast Layer - renders global app-level toasts */}
            <AppToastLayer />

            {/* Job Operation Panel - Google Drive-style job tracking overlay */}
            <JobOperationLayer />

            {/* Snackbar Layer - renders global bottom-anchored snackbars */}
            <SnackBarLayer />

            {/* Mobile drawer overlay — modal-based, only on native (feature-flagged) */}
            {Platform.OS !== 'web' && shouldRenderNavDrawer && <NavDrawerLayer mode="modal" position="left" />}

            {/* Offline sync status and notifications */}
            <OfflineSyncNotificationLayer />

            {/* FUTURE: Conflict resolution modal (disabled for v1 - LWW only) */}
            {/* v1 uses automatic Last-Write-Wins for all conflicts */}
          </>
        )}
      </View>
    </RouteErrorBoundary>
  );
}

/* ═════════════════════════════════════════════════════════════
   OLD CODE: Commented out for reference during transition
   
   Previous implementation used inline TopBar component with local state.
   Now replaced with ChromeLayer (orchestration) + ChromeContext (state).
   Delete this section once ChromeLayer is verified working.
   ═════════════════════════════════════════════════════════════
   
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
   
   ═════════════════════════════════════════════════════════════ */

// Main export with provider wrapper and error boundary
export default function RootLayout() {
  return (
    <AppKernelProvider>
        <ViewportProvider>
          <SubscriptionProvider>
            <AppParamsProvider>
              <OverlayProvider>
              {/* UIBlockerLayer renders the splash overlay (isLoading: true by default)
                  and provides the setLoading() context. Placed here — inside all theme
                  providers (SplashScreen needs UseTheme) but above RootLayoutContent
                  where useKernelLoadingSync() calls setLoading(false) on appReady. */}
                      <UIBlockerLayer>
                        <AppErrorBoundary
                          renderFallback={(error: Error | null, onRetry: () => void) => (
                            <CrashFallBack error={error} onRetry={onRetry} />
                          )}
                      >
                    <RootLayoutContent />
                  </AppErrorBoundary>
                </UIBlockerLayer>
              </OverlayProvider>
            </AppParamsProvider>
          </SubscriptionProvider>
        </ViewportProvider>
    </AppKernelProvider>
  );
}
