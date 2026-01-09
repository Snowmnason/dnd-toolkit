/**
 * Navigation Configuration Service
 * 
 * Centralized route configuration for D&D Toolkit.
 * Each route defines TopBar appearance, back behavior, modals, aliases, and more.
 */

import { Router } from 'expo-router';
import { normalizePath, pathEquals, pathStartsWith, RouteParams } from './uri-helpers';

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
  // Root/Index
  {
    path: '/',
    title: 'D&D Toolkit',
    showTopBar: false,
    analyticsName: 'root_index',
  },
  
  // Login routes
  {
    path: '/login',
    aliases: ['/login/welcome'],
    title: 'Welcome',
    showTopBar: false,
    analyticsName: 'login_welcome',
  },
  {
    path: '/login/sign-in',
    title: 'Sign In',
    showTopBar: false,
    back: '/login/welcome',
    analyticsName: 'login_signin',
  },
  {
    path: '/login/create-account',
    title: 'Create Account',
    showTopBar: false,
    back: '/login/welcome',
    analyticsName: 'login_create',
  },
  
  // Select routes
  {
    path: '/select/world-selection',
    title: 'Select World',
    showTopBar: true,
    showHamburger: true,
    analyticsName: 'select_world',
  },
  {
    path: '/select/join-world',
    title: 'Join World',
    showTopBar: true,
    back: '/select/world-selection',
    analyticsName: 'select_join',
  },
  {
    path: '/select/create-world',
    title: 'Create World',
    showTopBar: true,
    back: '/select/world-selection',
    analyticsName: 'select_create',
  },
  
  // Main routes
  {
    path: '/main/main-landing',
    title: 'Main',
    showTopBar: true,
    showHamburger: true,
    requiredParams: ['worldId', 'userRole'],
    preserveParamsOnBack: ['worldId', 'userRole'],
    analyticsName: 'main_landing',
    redirectIf: (context) => {
      // Example: redirect if no worldId (will be wired in follow-up)
      if (!context.worldId) {
        return '/select/world-selection';
      }
      return undefined;
    },
  },
  {
    path: '/main/characters-npcs',
    title: 'Characters & NPCs',
    showTopBar: true,
    back: '/main/main-landing',
    requiredParams: ['worldId', 'userRole'],
    preserveParamsOnBack: ['worldId', 'userRole'],
    analyticsName: 'main_characters',
  },
  {
    path: '/main/map-board',
    title: 'Map & Board',
    showTopBar: true,
    back: '/main/main-landing',
    requiredParams: ['worldId', 'userRole'],
    preserveParamsOnBack: ['worldId', 'userRole'],
    analyticsName: 'main_map',
  },
  {
    path: '/main/items-equipment',
    title: 'Items & Equipment',
    showTopBar: true,
    back: '/main/main-landing',
    requiredParams: ['worldId', 'userRole'],
    preserveParamsOnBack: ['worldId', 'userRole'],
    analyticsName: 'main_items',
  },
  {
    path: '/main/lore-locations',
    title: 'Lore & Locations',
    showTopBar: true,
    back: '/main/main-landing',
    requiredParams: ['worldId', 'userRole'],
    preserveParamsOnBack: ['worldId', 'userRole'],
    analyticsName: 'main_lore',
  },
  {
    path: '/main/quests-missions',
    title: 'Quests & Missions',
    showTopBar: true,
    back: '/main/main-landing',
    requiredParams: ['worldId', 'userRole'],
    preserveParamsOnBack: ['worldId', 'userRole'],
    analyticsName: 'main_quests',
  },
  {
    path: '/main/bestiary-monsters',
    title: 'Bestiary & Monsters',
    showTopBar: true,
    back: '/main/main-landing',
    requiredParams: ['worldId', 'userRole'],
    preserveParamsOnBack: ['worldId', 'userRole'],
    analyticsName: 'main_bestiary',
  },
  
  // Settings routes
  {
    path: '/settings',
    aliases: ['/settings/:username'],
    title: (context) => {
      const username = Object.prototype.hasOwnProperty.call(context.params, 'username') 
        ? context.params.username 
        : undefined;
      return username ? `Settings - ${username}` : 'Settings';
    },
    showTopBar: true,
    showHamburger: true,
    analyticsName: 'settings',
  },
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
    animation: 'slide',
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
