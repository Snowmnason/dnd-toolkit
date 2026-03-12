/**
 * Navigation module barrel export
 * Centralized access to route configuration and URI utilities
 */

export {
    getAllRouteConfigs, getRouteConfig, getTransitionAnimation, registerRouteConfig, resolveBackTarget, resolveTitle, shouldRedirect, type A11yFocusTarget,
    type AnimationType,
    type ModalConfig, type NavigationContext, type RouteConfig
} from "./navigation-config";

export {
    buildNavigationTarget, buildRoute, extractParamsFromUrl, hasRequiredParams, mergeParams, normalizePath,
    pathEquals,
    pathStartsWith, preserveParams, validateParams, type RouteParams
} from "./uri-helpers";

export {
    LOGIN_ROUTES, MAIN_ROUTES, SELECT_ROUTES, SETTINGS_ROUTES,
    WEB_ROUTES
} from "./routes";

/**
 * Account Navigation Module
 *
 * Centralizes all navigation decisions for authentication flows.
 * - Enter flows: sign-in, sign-up, re-auth
 * - Exit flows: sign-out, delete account
 */

export { determineEnterErrorRedirect, determineEnterRedirect } from './account/enter-navigation';
export type { EntryFlowType, NavigationDecision, NavigationUser } from './account/enter-navigation';

export { determineExitErrorRedirect, determineExitRedirect } from './account/exit-navigation';
export type { ExitFlowType } from './account/exit-navigation';

