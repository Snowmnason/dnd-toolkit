/**
 * Components Module — Barrel Export
 *
 * All app components: UI, modals, auth, offline, splash screens, etc.
 * Import from `@/components` instead of individual component files.
 *
 * ```ts
 * import {
 *   Button,
 *   AppModal,
 *   ConfirmModal,
 *   AppErrorBoundary,
 *   UIBlockerLayer,
 *   SplashScreen,
 * } from "@/components";
 * ```
 */

// Root-level components
export { AppErrorBoundary } from "./ErrorBoundary";
export { SmartDownloadButton } from "./SmartDownloadButton";
export { default as TopBar } from "./TopBar";
export { UIBlockerLayer } from "./UIBlockerLayer";
// UIBlockerContext is purposely a separate file (no SplashScreen/theme imports)
// so hooks/kernel can import useUIBlocker without creating a require cycle.
export { useUIBlocker } from "./UIBlockerContext";
export type { UIBlockerState } from "./UIBlockerContext";
export { default as VersionDisplay } from "./VersionDisplay";

// UI Components (re-export barrel)
export * from "./ui";

// Modal Components
export * from "./modals";

// Auth Components
export * from "./auth_components";

// Offline Components
export * from "./offline";

// Splash/Error Screens
export * from "./SplashScreen";

// Need, Nav Draw, progress bar, loading spinners, and other shared UI elements