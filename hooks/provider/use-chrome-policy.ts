import { getAppConfig } from '@/config'

/**
 * ChromePolicy
 *
 * Fully resolved chrome visibility state for the current route group.
 * Derived from AppConfig `ui.chrome` + current segments + platform rules.
 *
 * Rules enforced here:
 * - topBar uses skipRoutes (opt-out): shown on all routes except those listed
 * - bottomBar uses routeGroups (opt-in): shown only on listed routes
 * - showHamburger is derived: always true when showTopBar is true
 * - showBottomBar implies !showTopBar (mutually exclusive)
 * - showBottomBar enforcement to mobile-only happens in ChromeLayer
 * - showNavDrawer consolidates the navDrawer inline logic from _layout.tsx
 */
export interface ChromePolicy {
  /** Whether the top chrome bar (TopBar) should be rendered */
  showTopBar: boolean
  /** Whether the bottom chrome bar (BottomBar) should be rendered — mobile-only enforcement is in ChromeLayer */
  showBottomBar: boolean
  /** Derived: always true when showTopBar is true */
  showHamburger: boolean
  /** Whether the nav drawer should be rendered, based on ui.navDrawer config */
  showNavDrawer: boolean
}

/**
 * useChromePolicy
 *
 * Resolves the chrome visibility policy for the current route group.
 * Replaces the inline segment checks in _layout.tsx with declarative AppConfig.
 *
 * @param segments - Expo Router segments array (from useSegments())
 */
export function useChromePolicy(segments: string[]): ChromePolicy {
  const config = getAppConfig()
  const chromeConfig = config.ui?.chrome
  const navDrawerConfig = config.ui?.navDrawer

  const firstSegment = typeof segments[0] === 'string' ? segments[0] : ''
  // Full exact path for skipPaths matching (e.g., '/select/no-topbar')
  const fullPath = '/' + segments.filter((s) => typeof s === 'string').join('/')

  // Top bar: exact-path override first, then first-segment opt-out
  const topBarSkipPaths = chromeConfig?.topBar?.skipPaths ?? []
  const topBarSkipRoutes = chromeConfig?.topBar?.skipRoutes ?? ['', 'login', 'web']
  const showTopBar = !topBarSkipPaths.includes(fullPath) && !topBarSkipRoutes.includes(firstSegment)

  // Bottom bar: opt-in — only on listed route groups, mutually exclusive with top bar
  // skipPaths on bottomBar acts as an exact-path "force-show" override (show even outside normal groups)
  const bottomBarGroups = chromeConfig?.bottomBar?.routeGroups ?? []
  const bottomBarForcePaths = chromeConfig?.bottomBar?.skipPaths ?? []
  const showBottomBar = !showTopBar && (bottomBarGroups.includes(firstSegment) || bottomBarForcePaths.includes(fullPath))

  // Hamburger is derived: shown whenever top bar is shown
  const showHamburger = showTopBar

  // Nav drawer: exact-path override first, then first-segment skipRoutes check
  const navDrawerEnabled = navDrawerConfig?.enabled ?? false
  const navDrawerSkipRoutes = navDrawerConfig?.skipRoutes ?? []
  const navDrawerSkipPaths = navDrawerConfig?.skipPaths ?? []
  const showNavDrawer =
    navDrawerEnabled &&
    !navDrawerSkipRoutes.includes(firstSegment) &&
    !navDrawerSkipPaths.includes(fullPath)

  return {
    showTopBar,
    showBottomBar,
    showHamburger,
    showNavDrawer,
  }
}
