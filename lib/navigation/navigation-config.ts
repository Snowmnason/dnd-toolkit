/**
 * Navigation Configuration Service
 * 
 * Centralized route configuration for D&D Toolkit.
 * Each route defines TopBar appearance, back behavior, modals, aliases, and more.
 * 
 * ## Modals
 * Modal components (SettingsModal, CreateWorldModals, etc.) are **presentational only**.
 * They do not have route URLs and are controlled via React state (visible prop).
 * The `modal` config field is reserved for future modal-as-route patterns.
 * 
 * ## Animations
 * Animation types are defined in route config but not yet implemented in Expo Router.
 * Use `getTransitionAnimation()` helper for future integration.
 */

import { Router } from 'expo-router';
import { normalizePath, pathEquals, pathStartsWith, RouteParams } from './uri-helpers';
import { LOGIN_ROUTES } from './routes/login-routes';
import { MAIN_ROUTES } from './routes/main-routes';
import { SELECT_ROUTES } from './routes/select-routes';
import { SETTINGS_ROUTES } from './routes/settings-routes';
import { WEB_ROUTES } from './routes/web-routes';

/**
 * A11y focus target on route navigation
 * - 'title': Focus TopBar title (default, screen-reader friendly)
 * - 'firstInteractive': Focus first interactive element
 * - 'none': No automatic focus (for modals, etc.)
 */
export type A11yFocusTarget = 'title' | 'firstInteractive' | 'none';

/**
 * Animation type for route transitions (placeholder for future use)
 */
export type AnimationType = 'slide' | 'fade' | 'modal' | 'none';

/**
 * Modal configuration for routes that open as modals
 */
export interface ModalConfig {
  /** Is this route a modal? */
  isModal: boolean;
  /** Back button dismisses modal instead of navigating */
  dismissOnBack?: boolean;
  /** Custom dismiss handler */
  onDismiss?: (context: NavigationContext) => void;
}

/**
 * Conditional redirect hook for access control
 * Returns target path if redirect is needed, undefined otherwise
 */
export type RedirectIfHook = (context: NavigationContext) => string | undefined;

/**
 * Context passed to route config handlers
 */
export interface NavigationContext {
  /** Current route segments from useSegments() */
  segments: string[];
  /** Current route params (worldId, userRole, etc.) */
  params: RouteParams;
  /** Expo router instance */
  router: Router;
  /** Current world ID (convenience) */
  worldId?: string;
  /** Current user role (convenience) */
  userRole?: string;
  /** Is mobile platform */
  isMobile: boolean;
  /** Is authenticated */
  isAuthenticated: boolean;
}

/**
 * Route configuration definition
 */
export interface RouteConfig {
  /** Route path pattern (e.g., '/main/characters-npcs') */
  path: string;
  
  /** Route aliases for case-insensitive or alternative paths */
  aliases?: string[];
  
  /** TopBar title (can be function for dynamic titles) */
  title: string | ((context: NavigationContext) => string);
  
  /** Back button target path or handler */
  back?: string | ((context: NavigationContext) => string);
  
  /** Show hamburger menu button */
  showHamburger?: boolean;
  
  /** Show TopBar entirely (default true, false for login/public routes) */
  showTopBar?: boolean;
  
  /** Required params for this route */
  requiredParams?: string[];
  
  /** Preserve these params when navigating away */
  preserveParamsOnBack?: string[];
  
  /** Modal configuration */
  modal?: ModalConfig;
  
  /** Conditional redirect (e.g., unauthorized world access) */
  redirectIf?: RedirectIfHook;
  
  /** Analytics tracking name */
  analyticsName?: string;
  
  /** Animation type for transitions */
  animation?: AnimationType;
  
  /** A11y focus target on navigation */
  a11yFocusTarget?: A11yFocusTarget;
  
  /** Custom error boundary handler */
  onError?: (error: Error, context: NavigationContext) => void;
}

/**
 * Route configuration registry
 * Add new routes here with their configuration
 */
const ROUTE_CONFIGS: RouteConfig[] = [
  ...LOGIN_ROUTES,
  ...SELECT_ROUTES,
  ...MAIN_ROUTES,
  ...SETTINGS_ROUTES,
  ...WEB_ROUTES,
];

/**
 * Get route configuration for current navigation context
 * Uses intelligent matching: exact path, aliases, first segment, default
 */
export function getRouteConfig(context: NavigationContext): RouteConfig {
  const currentPath = '/' + context.segments.join('/');
  
  // Strategy 1: Exact match
  let match = ROUTE_CONFIGS.find((config) => 
    pathEquals(config.path, currentPath) ||
    config.aliases?.some((alias) => pathEquals(alias, currentPath))
  );
  
  if (match) {
    return applyDefaults(match);
  }
  
  // Strategy 2: Starts with (for nested routes like /main/characters-npcs/[id])
  match = ROUTE_CONFIGS.find((config) =>
    pathStartsWith(currentPath, config.path)
  );
  
  if (match) {
    return applyDefaults(match);
  }
  
  // Strategy 3: First segment match (e.g., /main/* matches /main/main-landing)
  const firstSegment = context.segments[0];
  if (firstSegment) {
    match = ROUTE_CONFIGS.find((config) => {
      const configFirstSegment = config.path.split('/').filter(Boolean)[0];
      return normalizePath(firstSegment) === normalizePath(configFirstSegment || '');
    });
    
    if (match) {
      return applyDefaults(match);
    }
  }
  
  // Strategy 4: Default fallback
  return applyDefaults({
    path: currentPath,
    title: 'D&D Toolkit',
    showTopBar: true,
    showHamburger: false,
    analyticsName: 'unknown_route',
  });
}

/**
 * Apply default values to route config
 */
function applyDefaults(config: RouteConfig): RouteConfig {
  return {
    showTopBar: true,
    showHamburger: false,
    a11yFocusTarget: 'title',
    animation: 'none',
    ...config,
  };
}

/**
 * Resolve dynamic title if it's a function
 */
export function resolveTitle(config: RouteConfig, context: NavigationContext): string {
  if (typeof config.title === 'function') {
    return config.title(context);
  }
  return config.title;
}

/**
 * Resolve back target if it's a function
 */
export function resolveBackTarget(
  config: RouteConfig,
  context: NavigationContext
): string | undefined {
  if (!config.back) {
    return undefined;
  }
  
  if (typeof config.back === 'function') {
    return config.back(context);
  }
  
  return config.back;
}

/**
 * Check if route should redirect based on redirectIf hook
 */
export function shouldRedirect(
  config: RouteConfig,
  context: NavigationContext
): string | undefined {
  if (!config.redirectIf) {
    return undefined;
  }
  
  return config.redirectIf(context);
}

/**
 * Get all route configs (for testing/debugging)
 */
export function getAllRouteConfigs(): RouteConfig[] {
  return ROUTE_CONFIGS;
}

/**
 * Get animation type for route transition (placeholder for future implementation)
 * Returns the animation type from route config, defaults to 'none'
 * 
 * Future: This will integrate with Expo Router stack options or custom transition handlers
 */
export function getTransitionAnimation(
  config: RouteConfig,
  context: NavigationContext
): AnimationType {
  return config.animation || 'none';
}

/**
 * Add or update a route config (for dynamic routes or testing)
 */
export function registerRouteConfig(config: RouteConfig): void {
  const existingIndex = ROUTE_CONFIGS.findIndex((c) => pathEquals(c.path, config.path));
  
  if (existingIndex >= 0) {
    // eslint-disable-next-line security/detect-object-injection
    ROUTE_CONFIGS[existingIndex] = config;
  } else {
    ROUTE_CONFIGS.push(config);
  }
}
