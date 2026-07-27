// Layer components — direct file imports to avoid resolving the full @/components barrel,
// which transitively includes the entire UI barrel (42 components) and all modal files.
import { AppToastLayer } from "@/components/layer/AppToastLayer";
import { ChromeLayer } from "@/components/layer/ChromeLayer";
import { AppErrorBoundary } from "@/components/layer/ErrorBoundary";
import { JobOperationLayer } from "@/components/layer/JobOperationLayer";
import { NavDrawerLayer } from "@/components/layer/NavDrawerLayer";
import { NotificationContainer } from "@/components/layer/NotificationContainer";
import { SnackBarLayer } from "@/components/layer/SnackBarLayer";
import { UIBlockerLayer } from "@/components/layer/UIBlockerLayer";
import { OfflineSyncNotificationLayer } from "@/components/offline/OfflineSyncNotificationLayer";
import {
  CrashFallBack,
  RouteErrorBoundary,
  SafeModeErrorBoundary,
  SafeModeScreen,
} from "@/components/SplashScreen";
// Contexts — direct file imports to avoid resolving the full @/contexts barrel,
// which includes toast, snackbar, notification, modal, nav-drawer, and theme contexts.
import { PanelNavDrawer } from "@/AppScreens/main-panels/PanelNavDrawer";
import { useAnalyticsSession } from "@/hooks/analytics";
import { useAuthLinkObserver } from "@/hooks/auth";
import { executeRecoveryAction, getSafeModeNavigationTarget } from "@/hooks/error";
import { useClearSafeMode } from "@/hooks/error/use-safe-mode";
import { useAppKernel, useKernelLoadingSync, useSyncSplash } from "@/hooks/kernel";
import { useBootstrapRouteGuard, useNavigation, usePanelNavigation, useRouteChangeObserver, useRouteConfig } from "@/hooks/navigation";
import { useAppParamsSync } from "@/hooks/provider/use-app-params-sync";
import { useChromeBottom } from "@/hooks/provider/use-chrome-bottom";
import { useChromePolicy } from "@/hooks/provider/use-chrome-policy";
import { logger, useInjectToastSystem } from "@/hooks/utils";
import { OverlayProvider } from "@/providers/overlay-provider";
// Providers — direct file imports to avoid resolving the full @/providers barrel,
// which includes ScaleProvider, TooltipPortalProvider, DropdownPortalProvider, and others.
import { AppKernelProvider } from "@/providers/AppKernelProvider";
import { AppParamsProvider } from "@/providers/AppParamsProvider";
import { useUserId } from "@/providers/AppParamsStableProvider";
import { useUserRole, useWorldId } from "@/providers/AppParamsVolatileProvider";
import { usePlatform } from "@/providers/PlatformProvider";
import { SubscriptionProvider } from "@/providers/SubscriptionProvider";
import { UseTheme } from "@/providers/ThemeProvider";
import { ViewportProvider } from "@/providers/ViewportProvider";
import {
  Stack,
  useSegments,
} from "expo-router";
import { useEffect } from "react";
import { Platform, View } from "react-native";

function RootLayoutContent() {
  // ==================== HOOKS SECTION ====================
  // ALL hooks must be called unconditionally before any early returns
  // (React Rules of Hooks requirement)

  // Theme and routing hooks
  const { theme } = UseTheme();
  const segments = useSegments();
  const { isMobile } = usePlatform();

  // Context hooks
  const userId = useUserId();
  const worldId = useWorldId();
  const userRole = useUserRole();

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

  // Chrome visibility policy: resolved from AppConfig ui.chrome + navDrawer config
  const chromePolicy = useChromePolicy(segments as string[]);
  const { showTopBar, showBottomBar, showHamburger, showNavDrawer: shouldRenderNavDrawer } = chromePolicy;

  // Bottom bar behavior hook
  const chromeBottom = useChromeBottom();

  // Navigation hooks (must be called unconditionally before any early returns)
  const navContext = {
    segments,
    params: {
      worldId: worldId as string | undefined,
      userRole: userRole as string | undefined,
    },
    worldId: worldId as string | undefined,
    userRole: userRole as string | undefined,
    isMobile,
  };

  const { config: routeConfig, title: resolvedTitle } = useRouteConfig(navContext);
  const panelNav = usePanelNavigation();
  const navigate = useNavigation();

  // Bootstrap route guard (web-only) — validates the initial route on fresh page load.
  // Runs once when appReady fires, before the UIBlocker drops. Handles deep links, URL
  // edits, browser back/forward (all cause full remount on web with static export).
  useBootstrapRouteGuard(kernel.phases.appReady);

  // Route change observer — runtime fallback for in-memory route changes.
  // On web, most route changes cause a full remount (handled by bootstrap guard above).
  // This catches the rare in-memory change and native deep links that don't remount.
  useRouteChangeObserver();

  // Auth link observer — intercepts email redirect URLs (signup, password reset, invites)
  // Fires on mount and param changes, processes entry via lib/auth/account/email-link-system.ts
  useAuthLinkObserver();

  // URL→context param sync: seed-on-main, clear-on-login, clear-world-on-select
  useAppParamsSync();

  // ==================== EFFECT HOOKS SECTION ====================
  // All effects that depend on above hooks

  // Reset right panel to left whenever the route group changes.
  // Prevents stale panel state (right panel open) from persisting across navigations.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { panelNav.goToLeftPanel(); }, [(segments as string[])[0], (segments as string[])[1]]);

  // Initialize analytics session and user context
  useAnalyticsSession(userId);

  // ==================== RENDER LOGIC SECTION ====================
  // Note: UIBlockerLayer (outermost in provider tree) handles all loading overlays.
  // Kernel and other systems call setLoading() via useUIBlocker().

  // Show safe mode screen if app entered safe mode (takes priority over normal rendering)
  // CRITICAL: SafeModeScreen is wrapped in error boundary - if it crashes, we still have fallback UI
  if (kernel.safeMode) {
    return (
      <SafeModeErrorBoundary>
        <SafeModeScreen
          state={kernel.safeMode}
          onNavigateHome={() => {
            // Navigate to appropriate route based on safe mode reason
            const target = getSafeModeNavigationTarget(kernel.safeMode?.reason);
            navigate.replace(target);
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
                async (targetRoute: string) => {
                  // Navigation callback: handle navigation after recovery succeeds
                  navigate.replace(targetRoute);
                },
              );

              if (result.success) {
                // On success, clear the safe mode state to exit safe mode
                // This allows the app to resume normal operation after recovery
                logger
                  .category("bootstrap")
                  .info(`[SafeMode] Recovery action succeeded: ${action}`);
                clearKernelSafeMode();
              } else {
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

  const topBarTitle = showTopBar ? resolvedTitle : undefined;

  // Resolve backDestination if it's a function (e.g. platform-conditional)
  const resolvedBackDestination = routeConfig.backDestination
    ? typeof routeConfig.backDestination === 'function'
      ? routeConfig.backDestination(navContext)
      : routeConfig.backDestination
    : undefined;

  // Back button: panel-first (right→left on mobile), then history pop, then backDestination fallback
  const handleTopBarBack = () => {
    try {
      if (panelNav.handleBackPress()) return;
      if (navigate.canGoBack()) {
        navigate.back();
      } else if (resolvedBackDestination) {
        navigate.replace(resolvedBackDestination);
      }
    } catch (err) {
      logger.category('navigation').warn('Back press failed', err);
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
            {/* Global ChromeLayer (TopBar + BottomBar) - driven by AppConfig chrome policy */}
            {showTopBar && topBarTitle && (
              <ChromeLayer
                topBar={{
                  title: topBarTitle,
                  showBackButton: (!panelNav.isDesktop && panelNav.activePanel === 'right') || navigate.canGoBack() || !!resolvedBackDestination,
                  showHamburger: showHamburger, // Whether to show the hamburger menu, add conditional logic if needed
                  onBackPress: handleTopBarBack,
                  a11yFocusTarget: routeConfig.a11yFocusTarget,
                }}
                bottomBar={showBottomBar ? {
                  visible: chromeBottom.visible,
                  activeTab: chromeBottom.activeTab,
                  onTabChange: chromeBottom.onTabChange,
                } : undefined}
              />
            )}

            {/* Content area: sidebar + stack in row layout on desktop */}
            <View style={{ flex: 1, flexDirection: Platform.OS === 'web' ? 'row' : 'column' }}>
              {/* Desktop sidebar — inline, always visible, animated width (feature-flagged) */}
              {Platform.OS === 'web' && shouldRenderNavDrawer && (
                <NavDrawerLayer
                  mode="expandable"
                  childrenClosed={<PanelNavDrawer collapsed />}
                  childrenOpen={<PanelNavDrawer />}
                />
              )}

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
