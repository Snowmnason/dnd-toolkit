/**
 * AppKernel - Centralized app bootstrap and lifecycle management
 *
 * Consolidates all bootstrapping phases (config, preload, network, storage, services, jobs, registration, auth, feature flags, app ready)
 * into a single, explicit contract. Ensures all consumers subscribe to one source of truth.
 *
 * Phases (in order):
 * - IDLE: Initial state, not started
 * - CONFIG: Load Supabase env vars & initialize client (MUST run first)
 * - PRELOAD: Loading fonts, platform assets (critical, <500ms target)
 * - NETWORK: Network detection initialization (before storage for offline awareness)
 * - STORAGE: Cache validation & migrations (knows network status)
 * - SERVICES: Register auth provider, error tracker, analytics exporters (must be before AUTH)
 * - JOB_SETUP: Initialize job queue infrastructure (non-critical, runs before AUTH)
 * - AUTH: Session restoration (non-blocking, fires in background after job setup ready)
 * - FEATURE_FLAGS: Load and apply feature flags (non-critical, runs after AUTH)
 * - REGISTRATION: Register job handlers + activate subscriptions (non-critical, runs after FEATURE_FLAGS)
 * - READY: App is ready to render main UI
 * - ERROR: A critical phase failed
 */

import {
  cleanupAnalyticsNetworkIntegration,
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
import { getPhaseMessage, type PhaseName } from "@/localization";
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
  type PhaseProgress,
} from "@/type-definitions/kernel-types";
import { authPhase } from "./phases/auth-phase";
import { configPhase } from "./phases/config-phase";
import { featureFlagsPhase } from "./phases/feature-flags-phase";
import { jobSetupPhase } from "./phases/job-setup-phase";
import { networkPhase } from "./phases/network-phase";
import { preloadPhase } from "./phases/preload-phase";
import { registrationPhase } from "./phases/registration-phase";
import { servicesPhase } from "./phases/services-phase";
import { storagePhase } from "./phases/storage-phase";

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
  type KernelListener,
  type PhaseProgress
} from "@/type-definitions/kernel-types";

/**
 * Phase sequence for progress tracking
 * These phases are executed sequentially during bootstrap
 * Used to calculate progress percentage and phase index
 */
const PHASE_SEQUENCE = [
  "config",
  "preload",
  "network",
  "storage",
  "services",
  "jobSetup",
  "auth",
  "featureFlags",
  "registration",
] as const;

const INITIAL_PHASE_PROGRESS: PhaseProgress = {
  currentPhaseIndex: 0, // Start at phase 0 (config) — the first incomplete phase in initial state
  currentPhaseName: "config",
  progressPercent: 0,
  phaseLabel: "0/9 Initializing...",
};

/**
 * Minimum display time per phase (milliseconds)
 * UX readability only — ensures user has time to read messages even on fast phases
 * NOT a performance optimization; adds small artificial delay on fast devices
 *
 * Configurable per-phase for future tuning (Issue #39)
 * Example: Config takes 30ms, waits 70ms extra = 100ms total
 *          Storage takes 500ms, no wait = 500ms total
 */
const PHASE_MIN_DISPLAY_MS = {
  config:       50,
  preload:      50,
  network:      50,
  storage:      50,
  services:     50,
  jobSetup:     50,
  auth:         50,
  featureFlags: 50,
  registration: 50,
} as const;

class AppKernelClass {
  private state: AppKernelState = {
    currentPhase: KernelPhase.IDLE,
    phases: {
      configReady: false,
      preloadReady: false,
      networkReady: false,
      storageReady: false,
      servicesReady: false,
      jobSetupReady: false,
      authReady: false,
      featureFlagsReady: false,
      registrationReady: false,
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
    phaseProgress: INITIAL_PHASE_PROGRESS,
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

      // Phase 5: JOB_SETUP — initialize job queue infrastructure (non-critical)
      await this.runPhase("jobSetup", () => jobSetupPhase());

      // Phase 6: AUTH — restore persisted session + evaluate staleness (non-critical, redirects to login on failure via useAuthGuard)
      await this.runPhase("auth", () => authPhase());

      // Phase 7: FEATURE_FLAGS — bootstrap feature flags from remote or cache (non-critical)
      await this.runPhase("featureFlags", () => featureFlagsPhase());

      // Phase 8: REGISTRATION — register job handlers + activate subscriptions (non-critical)
      await this.runPhase("registration", () => registrationPhase());

      // ═══════════════════════════════════════════════════════════════
      // APP READY — all phases complete, UI can render
      // ═══════════════════════════════════════════════════════════════

      this.updateState({
        currentPhase: KernelPhase.READY,
        phases: { ...this.state.phases, appReady: true },
        phaseProgress: {
          currentPhaseIndex: PHASE_SEQUENCE.length,
          currentPhaseName: "ready",
          progressPercent: 100,
          phaseLabel: `${PHASE_SEQUENCE.length}/${PHASE_SEQUENCE.length} Ready!`,
        },
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

        // Auto-clear KERNEL_TIMEOUT safe mode if bootstrap completed successfully
        if (
          state.phases.appReady &&
          state.safeMode?.reason === SafeModeReason.KERNEL_TIMEOUT
        ) {
          console.log('[CRITICAL] Kernel completed after timeout — auto-clearing KERNEL_TIMEOUT safe mode');
          logger
            .category('bootstrap')
            .info('Kernel completed after timeout — auto-clearing KERNEL_TIMEOUT safe mode');
          this.setSafeMode(null);
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
    const t = this.state.timing;
    // Static key access avoids Generic Object Injection Sink warning.
    // Explicit ordering mirrors PHASE_SEQUENCE — all phases always present.
    const orderedTiming = {
      config:       t["config"]       ?? 0,
      preload:      t["preload"]      ?? 0,
      network:      t["network"]      ?? 0,
      storage:      t["storage"]      ?? 0,
      services:     t["services"]     ?? 0,
      jobSetup:     t["jobSetup"]     ?? 0,
      authPhase:    t["auth"]         ?? 0,  // keyed as "authPhase" — "auth" matches PII redaction rules
      featureFlags: t["featureFlags"] ?? 0,
      registration: t["registration"] ?? 0,
    };

    const totalMs =
      orderedTiming.config + orderedTiming.preload + orderedTiming.network +
      orderedTiming.storage + orderedTiming.services + orderedTiming.jobSetup +
      orderedTiming.authPhase + orderedTiming.featureFlags + orderedTiming.registration;

    logger.category("bootstrap").info(`✅ AppKernel ready — ${totalMs}ms end-to-end`, {
      timing: orderedTiming,
      totalMs,
    });
  }

  /**
   * Fire-and-forget background tasks that run after appReady
   * Non-critical: failures don't affect app functionality
   *
   * These run AFTER the user has access to the app — network subscriptions,
   * analytics. None affect core functionality.
   * 
   * NOTE: User settings are now loaded as part of performDataSync during re-auth/sign-in,
   * so they don't need separate loading here.
   */
  private runPostReadyTasks(): void {
    ;(async () => {
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
   * Calculate phase progress based on completed phases
   * Returns updated PhaseProgress object
   */
  private calculatePhaseProgress(phases: AppKernelState["phases"]): void {
    // Static phase checks — no dynamic indexing (avoids object injection sink)
    const phaseChecks = [
      { name: "config", completed: phases.configReady },
      { name: "preload", completed: phases.preloadReady },
      { name: "network", completed: phases.networkReady },
      { name: "storage", completed: phases.storageReady },
      { name: "services", completed: phases.servicesReady },
      { name: "jobSetup", completed: phases.jobSetupReady },
      { name: "auth", completed: phases.authReady },
      { name: "featureFlags", completed: phases.featureFlagsReady },
      { name: "registration", completed: phases.registrationReady },
    ];

    let completedCount = 0;
    let currentPhaseIndex = -1; // -1 = sentinel for "not yet set" (unambiguous, unlike 0)
    let currentPhaseName: PhaseName = "config"; // Explicitly typed to ensure type safety

    for (const [i, phase] of phaseChecks.entries()) {
      if (phase.completed) {
        completedCount++;
      } else if (currentPhaseIndex === -1) {
        // First incomplete phase found - set it and stop looking
        currentPhaseIndex = i;
        currentPhaseName = phase.name as PhaseName; // Ensure phase.name conforms to PhaseName
      }
    }

    // If all phases are complete (currentPhaseIndex still -1), set to sentinel beyond sequence
    if (currentPhaseIndex === -1) {
      currentPhaseIndex = PHASE_SEQUENCE.length;
      currentPhaseName = "ready"; // All phases done, now ready
    }

    const progressPercent = Math.round(
      (completedCount / PHASE_SEQUENCE.length) * 100,
    );
    const phaseLabel = `${completedCount}/${PHASE_SEQUENCE.length} ${currentPhaseName}...`;

    this.state.phaseProgress = {
      currentPhaseIndex,
      currentPhaseName,
      progressPercent,
      phaseLabel,
    };
  }

  /**
   * Resolve phase name to its state key via static switch (avoids object injection sink)
   */
  private resolvePhaseKey(phaseName: typeof PHASE_SEQUENCE[number]): keyof AppKernelState["phases"] {
    switch (phaseName) {
      case "config": return "configReady";
      case "preload": return "preloadReady";
      case "network": return "networkReady";
      case "storage": return "storageReady";
      case "services": return "servicesReady";
      case "jobSetup": return "jobSetupReady";
      case "auth": return "authReady";
      case "featureFlags": return "featureFlagsReady";
      case "registration": return "registrationReady";
    }
  }

  /**
   * Run a phase with timing and error handling
   * Enforces minimum display time (UX readability) per phase
   * 
   * For phases > 50ms, polls every 250ms to update fake progress within phase range
   * (UX theater only — makes long phases feel responsive, never pretends completion at 97% cap)
   * 
   * Fake progress math:
   * - Real progress: 100/7 ≈ 14% per phase
   * - Fake increment per tick: 0.5% of the phase's progress range (ensures smooth animation)
   * - Display: currentRealProgress + (tickCount * increment), capped at nextPhaseRealProgress
   */
  private async runPhase(
    phaseName: typeof PHASE_SEQUENCE[number],
    fn: () => Promise<void>,
  ): Promise<void> {
    const phaseKey = this.resolvePhaseKey(phaseName);
    const startTime = Date.now();
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let pollTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
    let messageTickCount = 0;

    // Calculate real progress for this phase
    const phaseIndex = PHASE_SEQUENCE.indexOf(phaseName);
    const realProgressPerPhase = Math.round(100 / PHASE_SEQUENCE.length);
    const currentPhaseRealProgress = phaseIndex * realProgressPerPhase;
    const nextPhaseRealProgress = Math.min(
      (phaseIndex + 1) * realProgressPerPhase,
      97, // Cap at 97% until phase actually completes
    );
    // Increment = 0.5% of phase's progress range. This ensures smooth animation for all phases:
    // - Phase 0: (14 - 0) * 0.05 = 0.7% per tick
    // - Phase 3: (42 - 28) * 0.05 = 0.7% per tick
    // - Phase 6: (97 - 84) * 0.05 = 0.65% per tick
    const phaseProgressRange = nextPhaseRealProgress - currentPhaseRealProgress;
    const fakeIncrementPerTick = phaseProgressRange * 0.05;

    try {
      this.updateState({
        currentPhase:
          KernelPhase[phaseName.toUpperCase() as keyof typeof KernelPhase] ||
          KernelPhase.IDLE,
      });

      // Schedule polling for long-running phases (UX theater)
      // CRITICAL: Must capture the timeout handle to cancel if phase completes quickly
      pollTimeoutHandle = setTimeout(() => {
        // Only start polling if phase is still running (not already completed)
        if (pollInterval === null) {
          pollInterval = setInterval(() => {
            messageTickCount++;
            // Fake progress: increment from current phase, capped at next phase or 97%
            const fakeProgress = Math.min(
              currentPhaseRealProgress + messageTickCount * fakeIncrementPerTick,
              nextPhaseRealProgress,
            );

            this.updateState({
              phaseProgress: {
                ...this.state.phaseProgress,
                progressPercent: Math.round(fakeProgress),
                phaseLabel: getPhaseMessage(phaseName),
              },
            });
          }, 250); // Every 250ms = "TikTok brain" responsiveness
        }
      }, 50); // Wait 50ms before starting polling (phase might complete in <50ms)

      await fn();
      const actualDuration = Date.now() - startTime;

      // Clean up both the timeout and polling interval (MUST do both)
      if (pollTimeoutHandle) clearTimeout(pollTimeoutHandle);
      if (pollInterval) clearInterval(pollInterval);

      // Enforce minimum display time for UX readability
      // Use static switch to avoid object injection sink warning
      const minDisplay = (() => {
        switch (phaseName) {
          case "config": return PHASE_MIN_DISPLAY_MS.config;
          case "preload": return PHASE_MIN_DISPLAY_MS.preload;
          case "network": return PHASE_MIN_DISPLAY_MS.network;
          case "storage": return PHASE_MIN_DISPLAY_MS.storage;
          case "services": return PHASE_MIN_DISPLAY_MS.services;
          case "jobSetup": return PHASE_MIN_DISPLAY_MS.jobSetup;
          case "auth": return PHASE_MIN_DISPLAY_MS.auth;
          case "featureFlags": return PHASE_MIN_DISPLAY_MS.featureFlags;
          case "registration": return PHASE_MIN_DISPLAY_MS.registration;
        }
      })();
      const enforceDelay = Math.max(0, minDisplay - actualDuration);
      if (enforceDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, enforceDelay));
      }

      // Wall-clock duration = actual fn time + forced display delay
      // Ensures fast phases (e.g. auth on unauthenticated path) always record a non-zero value
      const wallClockDuration = actualDuration + enforceDelay;

      // Mark phase complete first, then calculate progress with updated phases
      const updatedPhases = { ...this.state.phases, [phaseKey]: true };
      this.calculatePhaseProgress(updatedPhases);
      this.updateState({
        phases: updatedPhases,
         
        timing: { ...this.state.timing, [phaseName]: wallClockDuration },
        phaseProgress: { ...this.state.phaseProgress },
      });

      if (enforceDelay > 0) {
        logger
          .category("bootstrap")
          .debug(
            `${phaseName} phase complete (${actualDuration}ms fn + ${enforceDelay}ms display = ${wallClockDuration}ms)`,
          );
      } else {
        logger
          .category("bootstrap")
          .debug(`${phaseName} phase complete (${actualDuration}ms)`);
      }
    } catch (error) {
      // Clean up both the timeout and polling interval on error
      if (pollTimeoutHandle) clearTimeout(pollTimeoutHandle);
      if (pollInterval) clearInterval(pollInterval);

      const err = error instanceof Error ? error : new Error(String(error));
      const actualDuration = Date.now() - startTime;
      logger.category("bootstrap").error(`${phaseName} phase failed`, {
        error: err.message,
        durationMs: actualDuration,
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
        jobSetupReady: false,
        servicesReady: false,
        authReady: false,
        featureFlagsReady: false,
        registrationReady: false,
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
      phaseProgress: INITIAL_PHASE_PROGRESS,
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
  async rerunPhase(phase: "auth" | "network" | "storage"): Promise<void> {
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
          `Cannot rerun phase: ${phase}. Only auth, network, and storage can be rerun.`,
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
