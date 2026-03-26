/**
 * Kernel Manager — Bootstrap Facade
 *
 * Provides a single entry point for all bootstrap-time domain operations
 * AND runtime kernel state queries. Isolates the entire app from direct
 * system/Kernel imports.
 *
 * Architecture:
 * ```
 * system/Kernel/phases → kernel-manager.ts → lib/modules    (bootstrap)
 * hooks/screens        → kernel-manager.ts → system/Kernel  (runtime queries)
 * ```
 *
 * This keeps:
 * - Phases focused on orchestration (no lib imports)
 * - Hooks/screens never touch system/Kernel directly
 * - System layer immutable across apps
 * - lib changes contained (only manager needs updating)
 * - Clear separation of concerns at every layer
 */

// ═══════════════════════════════════════════════════════════════════
// Type Re-exports (so consumers never import from system/Kernel)
// ═══════════════════════════════════════════════════════════════════

import type { SafeModeState } from "@/lib/error";
import type {
  AppKernelState,
  KernelListener,
} from "@/type-definitions/kernel-types";
import {
  KernelPhase
} from "@/type-definitions/kernel-types";

export {
  KernelErrorCode,
  KernelPhase
} from "@/type-definitions/kernel-types";
export type {
  AppKernelState,
  KernelCapabilities,
  KernelError,
  KernelListener,
  PhaseProgress
} from "@/type-definitions/kernel-types";

/**
 * Network Telemetry Initialization
 * Called by network-phase during bootstrap
 */
export async function initializeNetworkTelemetry(): Promise<void> {
  const { initializeTelemetry, startHealthCheckInterval } = await import(
    "@/lib/network"
  );
  initializeTelemetry();
  startHealthCheckInterval(300000, true); // 5 minutes default, skip initial
}

/**
 * Offline Sync Initialization
 * Called by sync-phase during bootstrap
 */
export async function initializeSync(): Promise<void> {
  const { OnlineSyncManager } = await import("@/lib/offline");
  await OnlineSyncManager.initialize();
}

/**
 * Get authenticated user ID
 * Called by user-phase to determine if user is authenticated
 * Returns undefined if no authenticated user
 */
export async function getUserId(): Promise<string | undefined> {
  const { AuthStateManager } = await import("@/lib/auth/auth-state");
  return await AuthStateManager.getUserId();
}

/**
 * Load user settings by user ID
 * Called by user-phase after obtaining userId
 *
 * @param userId - Authenticated user ID to load settings for
 * @returns User settings or null if not found
 */
export async function loadUserSettings(userId: string): Promise<any> {
  const { userSettingsDB } = await import("@/lib/database/user_settings");
  return await userSettingsDB.fetchUserSettingsById(userId, {
    maxAgeMs: 4 * 60 * 60 * 1000, // 4 hours cache
  });
}

/**
 * Apply language preference
 * Called by user-phase after loading user settings
 * (i18n integration pending)
 *
 * @param language - Language code (e.g., 'en', 'es')
 */
export async function applyLanguagePreference(language: string): Promise<void> {
  if (!language || language === "en") {
    return; // Use default
  }

  // TODO: Integrate with i18n system when available
  // For now, just store for future use
}
// ═══════════════════════════════════════════════════════════════════
// State Queries & Subscriptions
// ═══════════════════════════════════════════════════════════════════

/**
 * Initialize the kernel bootstrap sequence
 * Safe to call multiple times — only runs once
 * Used by AppKernelProvider at app root
 */
export async function initializeKernel(): Promise<void> {
  const { AppKernel } = require("@/system/Kernel");
  return AppKernel.initialize();
}

/**
 * Check if app bootstrap is complete and ready for UI rendering
 * Used by splash screen to determine when to show main content
 */
export function isAppReady(): boolean {
  const { AppKernel } = require("@/system/Kernel");
  return AppKernel.getState().phases.appReady;
}

/**
 * Check if kernel is idle (not yet initialized or was reset)
 * Used by job schedulers to avoid rescheduling after app destruction
 */
export function isKernelIdle(): boolean {
  const { AppKernel } = require("@/system/Kernel");
  return AppKernel.getState().currentPhase === KernelPhase.IDLE;
}

/**
 * Get full kernel state snapshot
 * Includes current phase, phase completion status, timing, capabilities, network status
 */
export function getKernelState(): AppKernelState {
  const { AppKernel } = require("@/system/Kernel");
  return AppKernel.getState();
}

/**
 * Subscribe to kernel state changes
 * Callback receives full kernel state on each change
 * Returns unsubscribe function
 *
 * @param callback - Called with new kernel state when any phase completes
 * @returns Unsubscribe function
 */
export function onKernelStateChange(
  callback: KernelListener,
): () => void {
  const { AppKernel } = require("@/system/Kernel");
  return AppKernel.subscribe(callback);
}

/**
 * Subscribe specifically to appReady completion
 * Callback fires once when appReady becomes true
 * Used by splash screen to transition to main UI
 *
 * @param callback - Called once when app is ready
 * @returns Unsubscribe function
 */
export function onAppReady(callback: () => void): () => void {
  const { AppKernel } = require("@/system/Kernel");
  let fired = false;

  return AppKernel.subscribe((state: AppKernelState) => {
    if (!fired && state.phases.appReady) {
      fired = true;
      callback();
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// Safe Mode
// ═══════════════════════════════════════════════════════════════════

/**
 * Get current safe mode state
 * Returns null if app is in NORMAL state (no safe mode active)
 */
export function getSafeMode(): SafeModeState | null {
  const { AppKernel } = require("@/system/Kernel");
  return AppKernel.getSafeMode();
}

/**
 * Set safe mode state
 * Called when critical systems fail or recovery is needed
 * Pass a SafeModeState object to enter safe mode
 */
export function setSafeMode(safeMode: SafeModeState | null): void {
  const { AppKernel } = require("@/system/Kernel");
  AppKernel.setSafeMode(safeMode);
}

/**
 * Clear safe mode (exit to NORMAL)
 * Called after successful recovery
 */
export function clearSafeMode(): void {
  const { AppKernel } = require("@/system/Kernel");
  AppKernel.setSafeMode(null);
}
