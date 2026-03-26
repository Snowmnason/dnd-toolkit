/**
 * Kernel Types
 *
 * Centralized type definitions for the app kernel bootstrap system.
 * Used by system/Kernel/app-kernel.ts and lib/kernel/kernel-manager.ts.
 */

import type { SafeModeState } from "@/lib/error";
import type { NetworkStatus } from "@/system/Network";
import type { PhaseName } from "@/lib/localization/phase-messages";

/**
 * Phase lifecycle stages
 */
export enum KernelPhase {
  IDLE = "idle",
  CONFIG = "config",
  PRELOAD = "preload",
  NETWORK = "network",
  STORAGE = "storage",
  SERVICES = "services",
  JOB_SETUP = "jobSetup",
  AUTH = "auth",
  SYNC = "sync",
  READY = "ready",
  ERROR = "error",
}

/**
 * Error codes for kernel failures
 * Allows consumers to handle specific error types
 */
export enum KernelErrorCode {
  CONFIG_FAILED = "CONFIG_FAILED",
  PRELOAD_FAILED = "PRELOAD_FAILED",
  STORAGE_MIGRATION_FAILED = "STORAGE_MIGRATION_FAILED",
  STORAGE_VALIDATION_FAILED = "STORAGE_VALIDATION_FAILED",
  NETWORK_INIT_FAILED = "NETWORK_INIT_FAILED",
  AUTH_RESTORE_FAILED = "AUTH_RESTORE_FAILED",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

/**
 * Detailed error information for kernel failures
 * Extends Error to be compatible with standard error handling
 */
export interface KernelError extends Error {
  code: KernelErrorCode;
  name: string; // Error interface requirement
  message: string;
  phase: KernelPhase;
  originalError?: Error;
  recoverable: boolean; // Can retry() recover from this?
  timestamp: number;
}

/**
 * Platform capabilities tracked by kernel
 * Determines what features are available at runtime
 */
export interface KernelCapabilities {
  storage: boolean; // SecureStorage available
  network: boolean; // Network detection working
  auth: boolean; // Auth system available
  analytics: boolean; // Analytics tracking enabled
  backend: boolean; // Supabase configured
  platform: "web" | "ios" | "android" | "desktop" | "unknown";
}

/**
 * Phase progress tracking state
 * Provides real-time progress updates during kernel bootstrap
 * Useful for progress bars and bootstrap status displays
 */
export interface PhaseProgress {
  currentPhaseIndex: number; // 0-7 for 8 core phases, or PHASE_SEQUENCE.length when complete
  currentPhaseName: PhaseName; // Narrowly typed to match PHASE_MESSAGES keys: "config", "preload", ..., "ready"
  progressPercent: number; // 0-100 based on phases completed
  phaseLabel: string; // e.g., "2/8 Loading fonts..."
}

/**
 * Full kernel state snapshot
 * Includes phase completion, timing, capabilities, network status, and safe mode state
 */
export interface AppKernelState {
  currentPhase: KernelPhase;
  phases: {
    configReady: boolean;
    preloadReady: boolean;
    networkReady: boolean;
    storageReady: boolean;
    servicesReady: boolean;
    jobSetupReady: boolean;
    authReady: boolean;
    syncReady: boolean;
    appReady: boolean;
  };
  error: KernelError | null;
  timing: Record<string, number>; // Phase timing in milliseconds
  capabilities: KernelCapabilities;
  networkStatus: NetworkStatus | null;
  safeMode: SafeModeState | null;
  phaseProgress: PhaseProgress;
}

/**
 * Phase function type
 * All bootstrap phases conform to this signature
 */
export type PhaseFunction = () => Promise<void>;

/**
 * Kernel state listener callback
 * Called whenever kernel state changes during bootstrap
 */
export type KernelListener = (state: AppKernelState) => void;
