/**
 * Barrel export for all context providers
 *
 * Usage:
 *   import { AppToastProvider, useAppToast } from '@/contexts';
 *   import { NotificationProvider, useNotifications } from '@/contexts';
 *   import { ThemeContext, useTheme } from '@/contexts';
 *   import { WorldSelectionProvider, useWorldSelection } from '@/contexts';
 */

// App Toast Context
export { AppToastProvider, useAppToast } from './app-toast-context';
export type { AppToastState, ToastType } from './app-toast-context';

// App Snackbar Context
export { AppSnackbarProvider, useAppSnackbar } from './app-snackbar-context';
export type { AppSnackbarState, SnackbarTone } from './app-snackbar-context';

// Notification Context
export { NotificationProvider, useNotifications } from './notifications-context';

// Modal Context
export { ModalProvider, registerModal, useIsModalOpen, useModal } from './modal-context';
export type { ModalState } from './modal-context';

// Nav Drawer Context
export { NavDrawerProvider, useNavDrawer } from './nav-drawer-context';
export type { DrawerPosition, NavDrawerContextType, NavDrawerState } from './nav-drawer-context';

// Chrome Context (TopBar + BottomBar navigation chrome)
export { ChromeProvider, useChrome } from './chrome-context';
export type { ChromeContextType } from './chrome-context';

// Overlay Provider (composite: Modal + NavDrawer + Notification + Toast + Snackbar)
export { OverlayProvider } from '../providers/overlay-provider';

// Theme Context
export { ThemeContext, useTheme } from './ThemeContext';
export type { ThemeContextType } from './ThemeContext';

// World Selection Context
export { useWorldSelection, WorldSelectionProvider } from './single_screen/WorldSelectionContext';

// UIBlockerContext is purposely a separate file (no SplashScreen/theme imports)
// so hooks/kernel can import useUIBlocker without creating a require cycle.
export { useUIBlocker } from "./UIBlockerContext";
export type { UIBlockerState } from "./UIBlockerContext";

