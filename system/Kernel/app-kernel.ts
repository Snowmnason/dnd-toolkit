/**
 * AppKernel - Centralized app bootstrap and lifecycle management
 *
 * Consolidates all bootstrapping phases (config, preload, network, storage, services, auth, app ready)
 * into a single, explicit contract. Ensures all consumers subscribe to one source of truth.
 *
 * Phases (in order):
 * - IDLE: Initial state, not started
 * - CONFIG: Load Supabase env vars & initialize client (MUST run first)
 * - PRELOAD: Loading fonts, platform assets (critical, <500ms target)
 * - NETWORK: Network detection initialization (before storage for offline awareness)
 * - STORAGE: Cache validation & migrations (knows network status)
 * - SERVICES: Register auth provider, error tracker, analytics exporters (must be before AUTH)
 * - AUTH: Session restoration (non-blocking, fires in background after services ready)
 * - READY: App is ready to render main UI
 * - ERROR: A critical phase failed
 */

import {
  cleanupAnalyticsNetworkIntegration,
  initializeAnalyticsNetworkIntegration,
} from "@/lib/analytics/exporters/analytics-network-integration";
import {
  createSafeModeState,
  DEFAULT_SAFE_MODE_CONFIG,
  NetworkCascadeDetector,
  SafeModeLevel,
  SafeModeReason,
  type SafeModeState,
} from "@/lib/error";
import { logger } from "@/lib/utils";
import {
  NetworkDetection,
  NetworkStatus,
} from "@/system/Network";
import {
  KernelErrorCode,
  KernelPhase,
  type AppKernelState,
  type KernelCapabilities,
  type KernelError,
  type KernelListener,
} from "@/type-definitions/kernel-types";
import { authPhase } from "./phases/auth-phase";
import { configPhase } from "./phases/config-phase";
import { networkPhase } from "./phases/network-phase";
import { preloadPhase } from "./phases/preload-phase";
import { servicesPhase } from "./phases/services-phase";
import { storagePhase } from "./phases/storage-phase";
import { offlinePhase } from "./phases/sync-phase";
import { userPhase } from "./phases/user-phase";

// FUTURE ENHANCEMENT: Phase Progress Callbacks
// To add progress tracking for phases (e.g., "Loading fonts... 50%"):
// 1. Add `onProgress?: (progress: number, message: string) => void` to runPhase()
// 2. Call onProgress() with incremental updates during async operations
// 3. Emit progress events through kernel.subscribe() with extended state
// Example: this.notifyProgress('preload', 0.5, 'Loading GrenzeGotisch font...');

/**
 * Re-exports for backward compatibility
 * All types are now centralized in @/type-definitions/kernel-types
 * These exports prevent breaking external imports from system/Kernel
 */
export {
  KernelErrorCode,
  KernelPhase, type AppKernelState,
  type KernelCapabilities,
  type KernelError,
  type KernelListener
} from "@/type-definitions/kernel-types";

class AppKernelClass {
  private state: AppKernelState = {
    currentPhase: KernelPhase.IDLE,
    phases: {
      configReady: false,
      preloadReady: false,
      networkReady: false,
      storageReady: false,
      servicesReady: false,
      authReady: false,
      syncReady: false,
      appReady: false,
    },
    error: null,
    timing: {},
    capabilities: {
      storage: false,
      network: false,
      auth: false,
      analytics: false,
      backend: false,
      platform: "unknown", // Will be detected on initialize()
    },
    networkStatus: null,
    safeMode: null, // NORMAL state (no safe mode active)
  };

  private listeners: Set<KernelListener> = new Set();
  private initPromise: Promise<void> | null = null;
  private networkUnsubscribe: (() => void) | null = null;
  private bootstrapTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private bootstrapTimeoutUnsubscribe: (() => void) | null = null;

  /**
   * Initialize the kernel once
   * Safe to call multiple times - only initializes once
   */
  async initialize(): Promise<void> {
    // If already initializing or initialized, return the same promise
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._initializeInternal();
    return this.initPromise;
  }

  private async _initializeInternal(): Promise<void> {
    try {
      logger.category("bootstrap").info("AppKernel initializing...");

      // Detect platform and initial capabilities
      await this.detectCapabilities();

      // Set up kernel timeout — if bootstrap doesn't reach appReady, trigger RECOVERY safe mode
      this.setupBootstrapTimeout();

      // ═══════════════════════════════════════════════════════════════
      // CORE PHASES — these block appReady
      // ═══════════════════════════════════════════════════════════════

      // Phase 0: CONFIG — validate app configuration (critical, throws on failure)
      await this.runPhase("config", () => configPhase());

      // Phase 1: PRELOAD — load fonts, themes, platform assets (non-critical)
      await this.runPhase("preload", () => preloadPhase());

      // Phase 2: NETWORK — initialize detection + telemetry (non-critical, app works offline)
      await this.runPhase("network", async () => {
        await networkPhase();
        this.setupNetworkSubscription();
      });

      // Phase 3: STORAGE — classification validation, health monitoring, defaults (non-critical)
      await this.runPhase("storage", () => storagePhase());

      // Phase 4: SERVICES — register auth/error/analytics providers (critical, throws on failure)
      await this.runPhase("services", () => servicesPhase());

      // Phase 5: AUTH — restore persisted session (non-critical, guest mode on failure)
      await this.runPhase("auth", () => authPhase());

      // Phase 6: SYNC — offline queue + sync manager (prevents read/write race conditions)
      await this.runPhase("sync", () => offlinePhase());

      // ═══════════════════════════════════════════════════════════════
      // APP READY — all phases complete, UI can render
      // ═══════════════════════════════════════════════════════════════

      this.updateState({
        currentPhase: KernelPhase.READY,
        phases: { ...this.state.phases, appReady: true },
      });

      this.logBootstrapSummary();

      // Fire-and-forget post-ready background tasks
      this.runPostReadyTasks();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.category("bootstrap").error("AppKernel initialization failed", {
        error: err.message,
        stack: err.stack?.substring(0, 200),
      });

      const kernelError = this.createKernelError(
        KernelErrorCode.UNKNOWN_ERROR,
        err.message,
        this.state.currentPhase,
        err,
        true,
      );

      this.updateState({
        currentPhase: KernelPhase.ERROR,
        error: kernelError,
      });
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Bootstrap Helpers
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Set up kernel bootstrap timeout
   * Triggers RECOVERY safe mode if appReady is not reached within the configured time
   */
  private setupBootstrapTimeout(): void {
    const timeoutMs = DEFAULT_SAFE_MODE_CONFIG.kernelTimeoutMs;

    this.bootstrapTimeoutHandle = setTimeout(() => {
      if (!this.state.phases.appReady) {
        // Don't double-trigger if already in RECOVERY
        if (
          this.state.safeMode &&
          this.state.safeMode.level === SafeModeLevel.RECOVERY
        ) {
          logger
            .category("bootstrap")
            .debug(
              "Kernel timeout occurred but app already in RECOVERY safe mode",
            );
          return;
        }

        logger
          .category("bootstrap")
          .error(
            "Kernel timeout - appReady not reached within configured time",
            {
              timeoutMs,
              currentPhase: this.state.currentPhase,
              existingSafeMode: this.state.safeMode?.level,
            },
          );

        const safeMode = createSafeModeState(
          SafeModeReason.KERNEL_TIMEOUT,
          {
            details: `Kernel bootstrap exceeded ${timeoutMs}ms timeout at phase: ${this.state.currentPhase}`,
          },
        );
        this.setSafeMode(safeMode);
      }
    }, timeoutMs);

    // Subscribe to state changes to clear timeout when appReady
    this.bootstrapTimeoutUnsubscribe = this.subscribe(
      (state: AppKernelState) => {
        if (state.phases.appReady && this.bootstrapTimeoutHandle) {
          clearTimeout(this.bootstrapTimeoutHandle);
          this.bootstrapTimeoutHandle = null;
          if (this.bootstrapTimeoutUnsubscribe) {
            this.bootstrapTimeoutUnsubscribe();
            this.bootstrapTimeoutUnsubscribe = null;
          }
        }
      },
    );
  }

  /**
   * Set up network status subscription and update kernel state on changes
   * Called after networkPhase() initializes the NetworkDetection state machine
   */
  private setupNetworkSubscription(): void {
    // Clean up existing subscription
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }

    // Subscribe to network changes
    this.networkUnsubscribe = NetworkDetection.subscribe((status) => {
      this.updateState({ networkStatus: status });
      logger
        .category("bootstrap")
        .debug(
          `Network status changed: online=${status.isOnline}, type=${status.type}`,
        );
    });

    // Get and set initial status
    const initialStatus = NetworkDetection.getStatus();
    this.updateState({
      networkStatus: initialStatus,
      capabilities: { ...this.state.capabilities, network: true },
    });

    logger
      .category("bootstrap")
      .debug(
        `Network subscription active: online=${initialStatus.isOnline}, type=${initialStatus.type}`,
      );
  }

  /**
   * Log bootstrap timing summary after appReady
   */
  private logBootstrapSummary(): void {
    const totalBootstrapTime = Object.values(this.state.timing).reduce(
      (a, b) => a + b,
      0,
    );

    logger.category("bootstrap").info("AppKernel ready", {
      timing: this.state.timing,
      totalMs: totalBootstrapTime,
    });
  }

  /**
   * Fire-and-forget background tasks that run after appReady
   * Non-critical: failures don't affect app functionality
   *
   * These run AFTER the user has access to the app — network subscriptions,
   * user settings, feature flags, analytics. None affect core functionality.
   */
  private runPostReadyTasks(): void {
    ;(async () => {
      // ─── User Settings ────────────────────────────────────────────
      // Load user settings + persist preferences to storage for next launch
      try {
        await userPhase();
      } catch (error) {
        logger.category("bootstrap").warn("User settings phase failed (non-critical)", {
          error: (error as Error).message,
        });
      }

      // ─── Analytics Network Integration ────────────────────────────
      // Auto-flush analytics buffer on network reconnect
      try {
        initializeAnalyticsNetworkIntegration();
        logger.category("bootstrap").debug("Analytics network integration initialized");
      } catch (error) {
        logger
          .category("bootstrap")
          .warn("Analytics network integration initialization failed (non-critical)", {
            error: (error as Error).message,
          });
      }

      // ─── Job Queue Handlers ───────────────────────────────────────
      try {
        const { getJobQueue } = await import("@/lib/jobs");
        const queue = getJobQueue();
        queue.registerHandler("feature_flags_refresh", async () => {
          const { SubscriptionManager } = await import("@/lib/premium");
          await SubscriptionManager.refresh();
          logger.category("jobs").info("feature_flags_refresh job completed");
          return { updatedAt: Date.now() };
        });
        logger.category("bootstrap").debug("Job queue handlers registered");
      } catch (error) {
        logger
          .category("bootstrap")
          .warn("Failed to register job queue handlers (non-critical)", {
            error: (error as Error).message,
          });
      }

      // ─── Feature Flags Bootstrap ──────────────────────────────────
      try {
        const { FeatureFlagsManager } =
          await import("@/lib/feature-flags/server-sync");
        const { getDatabaseProvider } = await import("@/system/Services");
        const { getSupabaseClient } = await import(
          "@/system/Services/supabase/supabase-client"
        );

        if (!getDatabaseProvider().isConfigured()) {
          logger
            .category("bootstrap")
            .warn("Database not configured — skipping feature flags bootstrap");
        } else {
          const supClient = getSupabaseClient();
          let userId: string | undefined;
          try {
            const { AuthStateManager } = await import("@/lib/auth/auth-state");
            userId = await AuthStateManager.getUserId();
          } catch {
            // userId unavailable — remote per-user overrides won't load
          }
          await FeatureFlagsManager.initialize(supClient, userId);

          const clockValid = await FeatureFlagsManager.verifyDeviceClock();
          if (!clockValid) {
            logger
              .category("bootstrap")
              .warn(
                "Device clock validation failed - premium features may be restricted",
              );
          }

          await FeatureFlagsManager.bootstrapFlags();
          logger
            .category("bootstrap")
            .info("Feature flags bootstrapped successfully");

          // Bridge server-synced flags to the legacy FeatureFlags system
          try {
            const { FeatureFlags } = await import(
              "@/lib/feature-flags/feature-flags"
            );
            const serverFlags = FeatureFlagsManager.getAllFlags();
            FeatureFlags.syncFromServer(serverFlags);

            const debugLogsEnabled = FeatureFlagsManager.getFlag(
              "debugLogs",
              false,
            );
            logger.reconfigure(debugLogsEnabled);
          } catch (bridgeError) {
            logger
              .category("bootstrap")
              .warn(
                "Failed to bridge server flags to legacy system (non-critical)",
                {
                  error: (bridgeError as Error).message,
                },
              );
          }
        }
      } catch (error) {
        logger
          .category("bootstrap")
          .warn(
            "Feature flags bootstrap failed (using hardcoded fallback)",
            {
              error: (error as Error).message,
            },
          );
      }

      // ─── Analytics Tracking ───────────────────────────────────────
      try {
        const totalBootstrapTime = Object.values(this.state.timing).reduce(
          (a, b) => a + b,
          0,
        );
        const { Analytics } = await import("@/lib/analytics");
        Analytics.track("app_bootstrap_complete", {
          total: totalBootstrapTime,
          ...this.state.timing,
        });
        logger.category("bootstrap").debug("Bootstrap metrics tracked");
      } catch (analyticsError) {
        logger
          .category("bootstrap")
          .debug(
            `Analytics tracking skipped: ${(analyticsError as Error).message}`,
          );
      }
    })().catch((e) => {
      logger
        .category("bootstrap")
        .warn("Post-ready background tasks failed (non-critical)", {
          error: (e as Error).message,
        });
    });
  }

  /**
   * Detect platform and available capabilities
   * All checks run in parallel via Promise.allSettled for faster startup
   */
  private async detectCapabilities(): Promise<void> {
    const capabilities: KernelCapabilities = {
      storage: false,
      network: false,
      auth: false,
      analytics: false,
      backend: false,
      platform: "unknown",
    };

    try {
      // Run all independent capability checks in parallel
      const [platformResult, storageResult, analyticsResult, supabaseResult] =
        await Promise.allSettled([
          import("react-native"),
          import("@/lib/storage"),
          import("@/lib/analytics"),
          import("@/system/Services/supabase/supabase-client"),
        ]);

      // Platform detection
      if (platformResult.status === "fulfilled") {
        const { Platform } = platformResult.value;
        const isElectron =
          typeof window !== "undefined" && (window as any).electron !== undefined;
        capabilities.platform = isElectron
          ? "desktop"
          : Platform.OS === "web"
            ? "web"
            : Platform.OS === "ios"
              ? "ios"
              : Platform.OS === "android"
                ? "android"
                : "unknown";
      } else {
        logger.category("bootstrap").warn("Platform detection failed");
      }

      // Storage availability
      capabilities.storage = storageResult.status === "fulfilled";
      if (storageResult.status === "rejected") {
        logger.category("bootstrap").warn("Storage not available");
      }

      // Analytics availability
      if (analyticsResult.status === "fulfilled") {
        try {
          capabilities.analytics = analyticsResult.value.Analytics.enabled();
        } catch {
          logger.category("bootstrap").debug("Analytics.enabled() failed");
        }
      } else {
        logger.category("bootstrap").debug("Analytics not available");
      }

      // Backend (Supabase) availability
      if (supabaseResult.status === "fulfilled") {
        const { isSupabaseConfigured } = supabaseResult.value;
        capabilities.backend = isSupabaseConfigured();
        capabilities.auth = isSupabaseConfigured(); // Auth depends on backend
      } else {
        logger.category("bootstrap").debug("Backend not configured");
      }

      this.updateState({ capabilities });
      logger.category("bootstrap").info("Capabilities detected", capabilities);
    } catch (error) {
      logger.category("bootstrap").error("Capability detection failed", {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Create a structured kernel error
   */
  private createKernelError(
    code: KernelErrorCode,
    message: string,
    phase: KernelPhase,
    originalError?: Error,
    recoverable: boolean = false,
  ): KernelError {
    return {
      code,
      name: `KernelError[${code}]`,
      message,
      phase,
      originalError,
      recoverable,
      timestamp: Date.now(),
    };
  }

  /**
   * Run a phase with timing and error handling
   */
  private async runPhase(
    phaseName: string,
    fn: () => Promise<void>,
  ): Promise<void> {
    const phaseKey = `${phaseName}Ready` as keyof AppKernelState["phases"];
    const startTime = Date.now();

    try {
      this.updateState({
        currentPhase:
          KernelPhase[phaseName.toUpperCase() as keyof typeof KernelPhase] ||
          KernelPhase.IDLE,
      });
      await fn();
      const duration = Date.now() - startTime;
      this.updateState({
        phases: { ...this.state.phases, [phaseKey]: true },
        timing: { ...this.state.timing, [phaseName]: duration },
      });
      logger
        .category("bootstrap")
        .debug(`${phaseName} phase complete (${duration}ms)`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const duration = Date.now() - startTime;
      logger.category("bootstrap").error(`${phaseName} phase failed`, {
        error: err.message,
        durationMs: duration,
      });
      throw err;
    }
  }

  /**
   * Update internal state and notify all listeners
   */
  private updateState(partial: Partial<AppKernelState>): void {
    this.state = { ...this.state, ...partial };
    this.notifyListeners();
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener({ ...this.state });
      } catch (error) {
        logger
          .category("error")
          .error("Kernel listener error", { error: (error as Error).message });
      }
    });
  }

  /**
   * Subscribe to kernel state changes
   * Returns unsubscribe function
   */
  subscribe(fn: KernelListener): () => void {
    this.listeners.add(fn);
    // Immediately call with current state
    fn({ ...this.state });
    return () => this.listeners.delete(fn);
  }

  /**
   * Get current kernel state
   */
  getState(): AppKernelState {
    return { ...this.state };
  }

  /**
   * Reset kernel (for testing or app reset scenarios)
   */
  reset(): void {
    logger.category("bootstrap").info("AppKernel reset requested");

    // Cleanup bootstrap timeout and subscription
    if (this.bootstrapTimeoutHandle) {
      clearTimeout(this.bootstrapTimeoutHandle);
      this.bootstrapTimeoutHandle = null;
    }
    if (this.bootstrapTimeoutUnsubscribe) {
      this.bootstrapTimeoutUnsubscribe();
      this.bootstrapTimeoutUnsubscribe = null;
    }

    // Cleanup network subscription
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }

    this.state = {
      currentPhase: KernelPhase.IDLE,
      phases: {
        configReady: false,
        preloadReady: false,
        networkReady: false,
        storageReady: false,
        servicesReady: false,
        authReady: false,
        syncReady: false,
        appReady: false,
      },
      error: null,
      timing: {},
      capabilities: {
        storage: false,
        network: false,
        auth: false,
        analytics: false,
        backend: false,
        platform: "unknown", // Will be detected on next initialize()
      },
      networkStatus: null,
      safeMode: null, // Reset safe mode to NORMAL
    };
    this.initPromise = null;

    this.notifyListeners();
  }

  /**
   * Retry initialization after error
   * Useful for recovering from transient failures
   */
  async retry(): Promise<void> {
    logger.category("bootstrap").info("AppKernel retry requested");

    if (this.state.currentPhase !== KernelPhase.ERROR) {
      logger
        .category("bootstrap")
        .warn("Retry called but kernel is not in ERROR state", {
          currentPhase: this.state.currentPhase,
        });
      return;
    }

    // Reset and reinitialize
    this.reset();
    return this.initialize();
  }

  /**
   * Re-run a specific phase
   * Useful for refreshing auth, network status, etc. without full restart
   */
  async rerunPhase(phase: "auth" | "sync" | "network" | "storage"): Promise<void> {
    logger.category("bootstrap").info("Rerunning phase", { phase });

    if (this.state.currentPhase === KernelPhase.ERROR) {
      throw new Error(
        "Cannot rerun phase while kernel is in ERROR state. Call retry() first.",
      );
    }

    switch (phase) {
      case "auth":
        await this.runPhase("auth", () => authPhase());
        break;

      case "sync":
        await this.runPhase("sync", () => offlinePhase());
        break;

      case "network":
        await this.runPhase("network", async () => {
          await networkPhase();
          this.setupNetworkSubscription();
        });
        break;

      case "storage":
        await this.runPhase("storage", () => storagePhase());
        break;

      default:
        throw new Error(
          `Cannot rerun phase: ${phase}. Only auth, sync, network, and storage can be rerun.`,
        );
    }
  }

  /**
   * Get redacted diagnostics snapshot for debugging
   * Safe to expose to users or send to logs
   */
  getDiagnostics(): {
    phase: KernelPhase;
    phases: AppKernelState["phases"];
    timing: Record<string, number>;
    totalBootstrapTime: number;
    capabilities: KernelCapabilities;
    networkStatus: NetworkStatus | null;
    error: {
      code: string;
      message: string;
      phase: string;
      recoverable: boolean;
      timestamp: number;
    } | null;
    platform: string;
    appVersion: string;
    timestamp: number;
  } {
    const totalBootstrapTime = Object.values(this.state.timing).reduce(
      (a, b) => a + b,
      0,
    );

    return {
      phase: this.state.currentPhase,
      phases: { ...this.state.phases },
      timing: { ...this.state.timing },
      totalBootstrapTime,
      capabilities: { ...this.state.capabilities },
      networkStatus: this.state.networkStatus
        ? { ...this.state.networkStatus }
        : null,
      error: this.state.error
        ? {
            code: this.state.error.code,
            message: this.state.error.message,
            phase: this.state.error.phase,
            recoverable: this.state.error.recoverable,
            timestamp: this.state.error.timestamp,
          }
        : null,
      platform: this.state.capabilities.platform,
      appVersion: process.env.EXPO_PUBLIC_VERSION || "unknown",
      timestamp: Date.now(),
    };
  }

  /**
   * Set safe mode state
   * Called when critical systems fail or recovery is needed
   *
   * Guard against double triggers:
   * - If already in safe mode with same reason, ignore to prevent duplicate events
   * - If escalating (e.g., DEGRADED → RECOVERY), allow the transition
   * - Otherwise, replace the current safe mode state
   */
  setSafeMode(safeMode: SafeModeState | null): void {
    const currentSafeMode = this.state.safeMode;

    // Guard: If already in same safe mode, ignore to prevent duplicate triggers
    if (
      currentSafeMode &&
      safeMode &&
      currentSafeMode.reason === safeMode.reason &&
      currentSafeMode.level === safeMode.level
    ) {
      logger.category("error").debug("Ignoring duplicate safe mode trigger", {
        reason: safeMode.reason,
        level: safeMode.level,
      });
      return;
    }

    this.state.safeMode = safeMode;

    // Log safe mode transitions
    if (safeMode) {
      // Detect escalation vs. transition
      const isEscalation =
        currentSafeMode &&
        this.getLevelSeverity(safeMode.level) >
          this.getLevelSeverity(currentSafeMode.level);

      logger
        .category("error")
        .warn(
          isEscalation ? "App escalating safe mode" : "App entering safe mode",
          {
            level: safeMode.level,
            reason: safeMode.reason,
            features: safeMode.affectedFeatures,
            previousLevel: currentSafeMode?.level,
          },
        );
    } else {
      logger.category("error").info("App exiting safe mode (recovered)");

      // Reset network cascade detector when exiting safe mode
      // This prevents the elevated failure counter from making it too easy to re-trigger safe mode
      NetworkCascadeDetector.reset();
      logger
        .category("network")
        .debug("Network cascade detector reset on safe mode exit");
    }

    this.notifyListeners();
  }

  /**
   * Helper to determine severity of a safe mode level for escalation detection
   * Higher number = more severe
   */
  private getLevelSeverity(level: SafeModeLevel): number {
    switch (level) {
      case SafeModeLevel.NORMAL:
        return 0;
      case SafeModeLevel.DEGRADED:
        return 1;
      case SafeModeLevel.SAFE:
        return 2;
      case SafeModeLevel.RECOVERY:
        return 3;
      default:
        return 0;
    }
  }

  /**
   * Check if app is in safe mode
   */
  isSafeMode(): boolean {
    return this.state.safeMode !== null;
  }

  /**
   * Get current safe mode state (null if NORMAL)
   */
  getSafeMode(): SafeModeState | null {
    return this.state.safeMode;
  }

  /**
   * Check if app is in a specific safe mode level
   */
  isInSafeModeLevel(level: SafeModeLevel): boolean {
    return this.state.safeMode?.level === level;
  }

  /**
   * Cleanup resources on app shutdown
   */
  destroy(): void {
    logger.category("bootstrap").info("AppKernel shutting down");

    // Cleanup analytics network integration
    try {
      cleanupAnalyticsNetworkIntegration();
    } catch (error) {
      logger.category("bootstrap").warn("Failed to cleanup analytics network integration", {
        error: (error as Error).message,
      });
    }

    // Unsubscribe from network changes
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }

    // Clear all listeners
    this.listeners.clear();
  }
}

/**
 * Global singleton instance of AppKernel
 */
export const AppKernel = new AppKernelClass();
