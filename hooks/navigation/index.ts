// Barrel export for navigation hooks
export { useActivePanel } from './use-active-panel';
export type { PanelKey } from '@/lib/navigation/routes/resolvers/parent-panel-resolver';
export { PanelNavigationProvider, usePanelNavigation } from "@/contexts/PanelNavigationContext";
export type { PanelNavigationContextType, PanelNavigationProviderProps } from "@/contexts/PanelNavigationContext";
export { useNavigation } from "./use-navigation";
export type { NavigationCallOptions, UseNavigation } from "./use-navigation";
export { useBootstrapRouteGuard } from "./use-bootstrap-route-guard";
export { useRouteChangeObserver } from "./use-route-change-observer";
export { useRouteConfig } from "./use-route-config";
export type { RouteConfigState } from "./use-route-config";

