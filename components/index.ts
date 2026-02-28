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
 *   LoadingOverlay,
 *   SplashScreen,
 * } from "@/components";
 * ```
 */

// Root-level components
export { AppErrorBoundary } from "./ErrorBoundary";
export { default as LoadingOverlay } from "./LoadingOverlay";
export { SmartDownloadButton } from "./SmartDownloadButton";
export { default as TopBar } from "./TopBar";
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

