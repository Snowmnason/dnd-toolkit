/**
 * Navigation module barrel export
 * Centralized access to route configuration and URI utilities
 */

export {
    getAllRouteConfigs, getRouteConfig, registerRouteConfig, resolveTitle, validateRouteRegistry,
    type A11yFocusTarget, type NavigationContext, type RouteConfig, type RouteRegistryViolation
} from "./navigationConfig";

export {
    canonicalizePath,
    pathEquals,
    pathStartsWith,
    type RouteParams
} from "./routeCanonicalizer";

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

export { determineEnterErrorRedirect, determineEnterRedirect } from './account/enterNavigation';
export type { EntryFlowType, NavigationDecision, NavigationUser } from './account/enterNavigation';

export { determineExitErrorRedirect, determineExitRedirect } from './account/exitNavigation';
export type { ExitFlowType } from './account/exitNavigation';


export {
    evaluateObservedRouteChange, executeExternalNavigation,
    executeHistoryNavigation,
    executeInternalRedirectNavigation,
    executeRouteNavigation,
    executeStateQueryNavigation,
    executeUtilityNavigation
} from './navManager';

