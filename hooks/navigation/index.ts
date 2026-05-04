// Barrel export for navigation hooks
export { PanelNavigationProvider, usePanelNavigation } from "@/contexts/PanelNavigationContext";
export type { PanelNavigationContextType, PanelNavigationProviderProps } from "@/contexts/PanelNavigationContext";
export type { PanelKey } from '@/lib/navigation/routes/resolvers/parent-panel-resolver';
export { useActivePanel } from './use-active-panel';
export { useBootstrapRouteGuard } from "./use-bootstrap-route-guard";
export { useNavigation } from "./use-navigation";
export type { NavigationCallOptions, UseNavigation } from "./use-navigation";
export { useRouteChangeObserver } from "./use-route-change-observer";
export { useRouteConfig } from "./use-route-config";
export type { RouteConfigState } from "./use-route-config";
export { useSettingsActions } from "./use-settings-actions";

