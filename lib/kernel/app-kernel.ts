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
import { NetworkCascadeDetector } from "@/lib/error/network-cascade-detector";
import type { SafeModeState } from "@/lib/error/safe-mode";
import {
  createSafeModeState,
  DEFAULT_SAFE_MODE_CONFIG,
  SafeModeLevel,
  SafeModeReason,
} from "@/lib/error/safe-mode";
import { getStorageDefaults } from "@/lib/kernel/storage-defaults";
import {
  NetworkDetection,
  NetworkStatus,
} from "@/lib/network/network-detection";
import { logger } from "@/lib/utils/logger";
import { validateClassifications } from "@/type-definitions/data-classification";

// FUTURE ENHANCEMENT: Phase Progress Callbacks
// To add progress tracking for phases (e.g., "Loading fonts... 50%"):
// 1. Add `onProgress?: (progress: number, message: string) => void` to runPhase()
// 2. Call onProgress() with incremental updates during async operations
// 3. Emit progress events through kernel.subscribe() with extended state
// Example: this.notifyProgress('preload', 0.5, 'Loading GrenzeGotisch font...');

export enum KernelPhase {
  IDLE = "idle",
  CONFIG = "config",
  PRELOAD = "preload",
  NETWORK = "network",
  STORAGE = "storage",
  SERVICES = "services",
  AUTH = "auth",
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

export interface AppKernelState {
  currentPhase: KernelPhase;
  phases: {
    configReady: boolean;
    preloadReady: boolean;
    networkReady: boolean;
    storageReady: boolean;
    servicesReady: boolean;
    authReady: boolean;
    appReady: boolean;
  };
  error: KernelError | null;
  timing: Record<string, number>; // Phase timing in milliseconds
  capabilities: KernelCapabilities;
  networkStatus: NetworkStatus | null;
  safeMode: SafeModeState | null; // Safe mode state (null = NORMAL)
}

type KernelListener = (state: AppKernelState) => void;

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
  private authCompletionTime: number | null = null;
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

      // Validate configuration before proceeding
      const { getAppConfig, validateConfig, logValidationResults } =
        await import('@/config');
      const config = getAppConfig();
      const configValidation = validateConfig(config);
      logValidationResults(configValidation);

      if (!configValidation.valid) {
        throw new Error(
          `Configuration validation failed: ${configValidation.errors.join("; ")}`,
        );
      }

      // Detect platform and initial capabilities
      await this.detectCapabilities();

      // Set up kernel timeout - if we don't reach appReady in time, trigger RECOVERY
      const timeoutMs = DEFAULT_SAFE_MODE_CONFIG.kernelTimeoutMs;

      const startTimeout = () => {
        this.bootstrapTimeoutHandle = setTimeout(() => {
          if (!this.state.phases.appReady) {
            // Check if safe mode was already triggered by another system
            // Only trigger kernel timeout if not already in RECOVERY (highest level)
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
      };

      // Subscribe to state changes to clear timeout when appReady
      // Store unsubscribe function in class instance for cleanup during reset
      this.bootstrapTimeoutUnsubscribe = this.subscribe(
        (state: AppKernelState) => {
          if (state.phases.appReady && this.bootstrapTimeoutHandle) {
            clearTimeout(this.bootstrapTimeoutHandle);
            this.bootstrapTimeoutHandle = null;
            // Stop listening after appReady
            if (this.bootstrapTimeoutUnsubscribe) {
              this.bootstrapTimeoutUnsubscribe();
              this.bootstrapTimeoutUnsubscribe = null;
            }
          }
        },
      );

      startTimeout();

      // Phase 0: CONFIG
      // Database provider initialization is deferred to the SERVICES phase
      // to keep kernel responsibilities focused and avoid duplicated init.
      await this.runPhase("config", async () => {
        try {
          logger
            .category("bootstrap")
            .info("CONFIG phase completed — deferring database provider initialization to SERVICES phase");
        } catch (error) {
          logger.category("bootstrap").error("CONFIG phase failed", {
            error: (error as Error).message,
          });
          throw error;
        }
      });

      // Phase 1: Preload (fonts, platform assets)
      await this.runPhase("preload", async () => {
        try {
          const { Platform } = await import("react-native");
          const { preloadThemes } = await import("@/theme");
          const { injectWebFonts } =
            await import("@/lib/utils/web/web-font-loader");

          if (Platform.OS === "web") {
            await injectWebFonts();
          } else {
            try {
              const FontModule = await import("expo-font");
              const Font = FontModule.default || FontModule;
              const criticalFonts = {
                GrenzeGotisch: require("../../assets/fonts/GrenzeGotisch.ttf"),
              };
              await Font.loadAsync(criticalFonts);
            } catch (fontError) {
              logger
                .category("bootstrap")
                .warn("Font loading failed (non-critical)", {
                  error: (fontError as Error).message,
                });
            }
          }

          // Preload themes in background
          preloadThemes().catch(() => {
            logger.category("bootstrap").debug("Theme preload in background");
          });
        } catch (error) {
          logger
            .category("bootstrap")
            .warn("Preload assets failed (non-critical)", {
              error: (error as Error).message,
            });
        }
      });

      // Phase 2: Network (initialize detection - BEFORE storage for offline awareness)
      await this.runPhase("network", async () => {
        try {
          await NetworkDetection.initialize();

          // Clean up existing subscription before creating a new one
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

          // Get initial status
          const initialStatus = NetworkDetection.getStatus();
          this.updateState({
            networkStatus: initialStatus,
            capabilities: { ...this.state.capabilities, network: true },
          });

          logger
            .category("bootstrap")
            .debug(
              `Network detection initialized: online=${initialStatus.isOnline}, type=${initialStatus.type}`,
            );

          // Initialize offline sync manager (Phase 1: Foundation)
          try {
            const { OnlineSyncManager } = await import("@/lib/offline");
            await OnlineSyncManager.initialize();
            logger.category("bootstrap").debug("OnlineSyncManager initialized");
          } catch (error) {
            logger
              .category("bootstrap")
              .warn("OnlineSyncManager initialization failed (non-critical)", {
                error: (error as Error).message,
              });
          }

          // Initialize network telemetry (Phase 1a: Quality & Health Events)
          try {
            const { initializeTelemetry, startHealthCheckInterval } = await import(
              "@/lib/network"
            );
            initializeTelemetry();
            // Skip initial check since initializeTelemetry() already captured initial state
            startHealthCheckInterval(300000, true); // 5 minutes default, skip initial
            logger.category("bootstrap").debug("Network telemetry initialized");
          } catch (error) {
            logger
              .category("bootstrap")
              .warn("Network telemetry initialization failed (non-critical)", {
                error: (error as Error).message,
              });
          }

          // Initialize analytics network integration (Phase 1b: Buffer auto-flush on reconnect)
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

          // Register feature_flags_refresh job handler (Phase 4: Integration)
          try {
            const { getJobQueue } = await import("@/lib/jobs");
            const queue = getJobQueue();
            queue.registerHandler("feature_flags_refresh", async (payload) => {
              // Import SubscriptionManager to refresh subscription state
              const { SubscriptionManager } = await import("@/lib/premium");
              await SubscriptionManager.refresh();
              logger
                .category("jobs")
                .info("feature_flags_refresh job completed");
              return { updatedAt: Date.now() };
            });
            logger
              .category("bootstrap")
              .debug("feature_flags_refresh job handler registered");
          } catch (error) {
            logger
              .category("bootstrap")
              .warn(
                "Failed to register feature_flags_refresh job handler (non-critical)",
                {
                  error: (error as Error).message,
                },
              );
          }
        } catch (error) {
          logger
            .category("bootstrap")
            .warn("Network detection failed (non-critical)", {
              error: (error as Error).message,
            });
          // Network failure is non-critical - app works offline
        }
      });

      // Phase 3: Storage (cache validation/migrations - runs AFTER network, knows offline status)
      await this.runPhase("storage", async () => {
        try {
          // Validate data classification registry integrity early
          // Catch configuration errors (mismatched keys, invalid sensitivity, bad patterns) immediately
          validateClassifications();
          logger
            .category("bootstrap")
            .debug("Data classification registry validated");

          // Initialize storage health monitoring (validates storage + starts polling)
          const { initializeStorageHealthMonitoring } =
            await import("@/lib/storage/utilites/storage-health-monitor");
          await initializeStorageHealthMonitoring();

          // Initialize all storage keys with safe defaults on startup
          await this.initializeStorageDefaults();

          // Validate critical storage entries during bootstrap
          // Only validate what's needed for app to function - don't block on world data
          logger
            .category("bootstrap")
            .debug("Running storage validation for critical cache entries");

          // Storage validation happens lazily on first access via SecureStorage.getValidatedJSON()
          // This phase ensures storage system is initialized and ready
          logger
            .category("bootstrap")
            .debug("Storage system initialized and ready");
        } catch (error) {
          logger
            .category("bootstrap")
            .warn("Storage validation warning (non-critical)", {
              error: (error as Error).message,
            });
        }
      });

      // Phase 4: Services (register auth provider, error tracker, analytics exporter)
      // MUST be before AUTH so AuthStateManager can use the registered provider
      await this.runPhase("services", async () => {
        const { initializeServices } = await import("@/lib/services");
        await initializeServices();
        logger
          .category("bootstrap")
          .info("✅ Services initialized successfully");

        // Configure AuthStateManager with the registered auth provider (if available)
        // initializeServices() may not have registered a provider if Supabase is not configured
        const { getAuthProviderSync } = await import("@/lib/services");
        const { AuthStateManager } = await import("@/lib/auth/auth-state");

        const provider = getAuthProviderSync();

        if (!provider) {
          // Auth not available (e.g., no Supabase env vars)
          // Skip wiring and log warning; auth-guarded routes will fail gracefully
          logger
            .category("bootstrap")
            .warn("No auth provider registered — auth features unavailable. Public routes only.");
        } else {
          try {
            AuthStateManager.configure(provider);
            logger
              .category("bootstrap")
              .info("AuthStateManager configured with registered provider");
          } catch (error) {
            logger
              .category("bootstrap")
              .error("Failed to configure AuthStateManager with provider", {
                error: (error as Error).message,
              });
            const safeMode = createSafeModeState(
              SafeModeReason.KERNEL_CONFIG_FAILED,
              {
                details: "Auth provider configuration failed",
                originalError: error instanceof Error ? error : new Error(String(error)),
              }
            );
            this.setSafeMode(safeMode);
            throw error; // Let runPhase propagate — services are critical
          }
        }
      });

      // Phase 5: Auth (restore session - non-blocking, services already registered)
      // Services ran synchronously above, so AuthStateManager already has a registered
      // provider. Auth is fired in background so appReady is not gated on network latency.
      this.runPhase("auth", async () => {
        const authPhaseStart = performance.now();
        try {
          const { AuthStateManager } = await import("@/lib/auth/auth-state");
          
          // CRITICAL: Restore the auth session first (web platform support)
          // On web, session persistence is disabled for security, so we manually restore it
          // This must happen BEFORE checking auth state or any authenticated requests
          logger.category("bootstrap").debug("Restoring auth session from storage...");
          const restoreStart = performance.now();
          await AuthStateManager.restoreAuthSession();
          const restoreTime = performance.now() - restoreStart;
          logger.category("bootstrap").info("✅ Auth session restored", { 
            restoreTimeMs: restoreTime,
          });
          
          await AuthStateManager.getAuthState();
          logger.category("bootstrap").debug("Auth state loaded");

          // Initialize AuthLayer with default strategies
          const { AuthLayer } = await import("@/lib/api/auth-layer");
          const {
            createUserAuthStrategy,
            createPublicAuthStrategy,
            createInviteAuthStrategy,
          } = await import("@/lib/api/default-strategies");
          AuthLayer.registerAuthStrategy("user", createUserAuthStrategy());
          AuthLayer.registerAuthStrategy("public", createPublicAuthStrategy());
          AuthLayer.registerAuthStrategy("invite", createInviteAuthStrategy());
          logger
            .category("bootstrap")
            .debug(
              "AuthLayer initialized with user, public, and invite strategies",
            );

          // Initialize auth health monitoring (validates auth + starts polling)
          const { initializeAuthHealthMonitoring } =
            await import("@/lib/auth/health/auth-health-monitor");
          await initializeAuthHealthMonitoring();

          // Track auth completion time
          this.authCompletionTime = performance.now() - authPhaseStart;

          // Mark auth as ready after successful load
          this.updateState({
            phases: { ...this.state.phases, authReady: true },
          });

          logger
            .category("bootstrap")
            .info(
              `✅ authReady = true (${this.authCompletionTime}ms)`,
            );

          // Initialize offline queue system
          try {
            const { OfflineQueueManager } =
              await import("@/lib/api/resilience/offline-queue");
            const { initializeOfflineQueueReplay } =
              await import("@/lib/api/resilience/offline-queue-replay");

            // Load persisted queue from storage
            await OfflineQueueManager.initialize();

            // Set up network listener for automatic replay on reconnect
            await initializeOfflineQueueReplay();

            logger
              .category("bootstrap")
              .info("Offline queue system initialized");
          } catch (queueError) {
            logger
              .category("bootstrap")
              .warn("Failed to initialize offline queue system", {
                error: (queueError as Error).message,
              });
            // Non-critical: app continues without offline queue
          }

          // Initialize analytics consent (restores from storage or database)
          try {
            const { AnalyticsConsent } = await import("@/lib/analytics");
            const initialLevel = await AnalyticsConsent.initialize();
            logger
              .category("bootstrap")
              .info("Analytics consent initialized", {
                level: initialLevel,
              });
          } catch (consentError) {
            logger
              .category("bootstrap")
              .warn("Failed to initialize analytics consent (non-critical)", {
                error: (consentError as Error).message,
              });
            // Non-critical: app continues with default consent
          }

          // Initialize consent sync queue and set up network hook for auto-processing
          try {
            const { ConsentSyncQueue } = await import("@/lib/analytics/consent/consent-sync-queue");
            
            // Load persisted consent sync items from storage
            await ConsentSyncQueue.initialize();
            
            // Set up network detection hook to automatically process queue on reconnect
            // Only process items that are ready for retry (respects retry backoff)
            const networkUnsubscribeForConsent = NetworkDetection.subscribe((status) => {
              if (status.isOnline && ConsentSyncQueue.size() > 0) {
                ConsentSyncQueue.processQueue().catch((error) => {
                  logger
                    .category("analytics")
                    .warn("Failed to process consent sync queue on network recovery", { error });
                });
              }
            });
            
            // Store unsubscribe function for cleanup on app shutdown
            if (!this.networkUnsubscribe) {
              this.networkUnsubscribe = networkUnsubscribeForConsent;
            }
            
            logger
              .category("bootstrap")
              .debug("Consent sync queue initialized", {
                queueSize: ConsentSyncQueue.size(),
              });
          } catch (consentQueueError) {
            logger
              .category("bootstrap")
              .warn("Failed to initialize consent sync queue (non-critical)", {
                error: (consentQueueError as Error).message,
              });
            // Non-critical: app continues without consent queue processing
          }
        } catch (e) {
          this.authCompletionTime = performance.now() - authPhaseStart;
          logger
            .category("auth")
            .error("Auth state load failed", { error: (e as Error).message });
          // Mark auth as ready even on failure - app should still work
          this.updateState({
            phases: { ...this.state.phases, authReady: true },
          });
        }
      }).catch((e) => {
        logger.category("bootstrap").warn("Auth phase error (non-blocking)", {
          error: (e as Error).message,
        });
      });

      // Mark app ready - services ready, auth completing in background
      this.updateState({
        currentPhase: KernelPhase.READY,
        phases: { ...this.state.phases, appReady: true },
      });

      logger
        .category("bootstrap")
        .info(`✅ appReady = true (auth phase running in background, provider already registered)`);

      // Log timing summary immediately — appReady is set, all critical phases complete
      const totalBootstrapTime = Object.values(this.state.timing).reduce(
        (a, b) => a + b,
        0,
      );

      logger.category("bootstrap").info("AppKernel ready", {
        timing: this.state.timing,
        totalMs: totalBootstrapTime,
        note: "Auth phase runs asynchronously - not included in total. Provider registered before auth starts.",
      });

      // Fire-and-forget: feature flags + analytics tracking
      // Neither is critical; they should not block or slow appReady
      ;(async () => {
        // Initialize Feature Flags Manager
        try {
          const { FeatureFlagsManager } =
            await import("@/lib/feature-flags/server-sync");
          const { getDatabaseProvider } = await import("@/lib/services");
          const { getSupabaseClient } = await import("@/lib/services/supabase/supabase-client");

          if (!getDatabaseProvider().isConfigured()) {
            logger
              .category("bootstrap")
              .warn("Database not configured — skipping feature flags bootstrap");
          } else {
            const supClient = getSupabaseClient();
            // Try to get userId from storage (may be available from a previous session)
            // Auth runs asynchronously, so we can't guarantee it's available yet,
            // but SecureStorage may have the user data from a prior session.
            let userId: string | undefined;
            try {
              const { AuthStateManager } = await import("@/lib/auth/auth-state");
              userId = await AuthStateManager.getUserId();
            } catch {
              // userId unavailable - remote per-user overrides won't load this time
            }
            await FeatureFlagsManager.initialize(supClient, userId);

            // Verify device clock validity early
            const clockValid = await FeatureFlagsManager.verifyDeviceClock();
            if (!clockValid) {
              logger
                .category("bootstrap")
                .warn("Device clock validation failed - premium features may be restricted");
            }

            // Bootstrap flags from server (one-time fetch at startup)
            await FeatureFlagsManager.bootstrapFlags();
            logger.category("bootstrap").info("Feature flags bootstrapped successfully");

            // Bridge server-synced flags to the legacy FeatureFlags system
            // and reconfigure the Logger so it respects the remote debugLogs value.
            try {
              const { FeatureFlags } =
                await import("@/lib/feature-flags/feature-flags");
              const serverFlags = FeatureFlagsManager.getAllFlags();

              // 1. Sync legacy system so useFeatureFlag hooks see server values
              FeatureFlags.syncFromServer(serverFlags);

              // 2. Reconfigure Logger with the resolved debugLogs value
              const debugLogsEnabled = FeatureFlagsManager.getFlag("debugLogs", false);
              logger.reconfigure(debugLogsEnabled);
            } catch (bridgeError) {
              logger
                .category("bootstrap")
                .warn("Failed to bridge server flags to legacy system (non-critical)", {
                  error: (bridgeError as Error).message,
                });
            }
          }
        } catch (error) {
          logger
            .category("bootstrap")
            .warn("Feature flags bootstrap failed (using hardcoded fallback)", {
              error: (error as Error).message,
            });
        }

        // Track performance metrics in Analytics
        try {
          const { Analytics } = await import("@/lib/analytics");
          Analytics.track("app_bootstrap_complete", {
            total: totalBootstrapTime,
            ...this.state.timing,
            authCompletedAsynchronously: true,
            authDurationMs: this.authCompletionTime || 0,
          });
          logger.category("bootstrap").debug("Bootstrap metrics tracked");
        } catch (analyticsError) {
          logger
            .category("bootstrap")
            .debug(`Analytics tracking skipped: ${(analyticsError as Error).message}`);
        }
      })().catch((e) => {
        logger
          .category("bootstrap")
          .warn("Post-ready background tasks failed (non-critical)", {
            error: (e as Error).message,
          });
      });
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
          import("@/lib/services/supabase/supabase-client"),
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
    this.authCompletionTime = null;

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
        await this.runPhase("auth", async () => {
          const { AuthStateManager } = await import("@/lib/auth/auth-state");
          await AuthStateManager.getAuthState();
          this.updateState({
            phases: { ...this.state.phases, authReady: true },
          });
        });
        break;

      case "network":
        await this.runPhase("network", async () => {
          await NetworkDetection.initialize();
        });
        break;

      case "storage":
        await this.runPhase("storage", async () => {
          logger.category("bootstrap").debug("Storage system revalidated");
        });
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
   * Initialize all storage keys with safe defaults on startup
   * Ensures every key exists with a sensible default value
   * Prevents "undefined" values and cascading failures
   */
  private async initializeStorageDefaults(): Promise<void> {
    try {
      // Avoid initializing browser-only storage during server-side rendering
      // or static export where `window` is undefined. Initializing storage
      // there can create a mismatched encryption state (keys generated
      // during SSR are not persisted to the client). Only initialize
      // storage when running in a real browser/runtime environment.
      if (typeof window === "undefined") {
        logger
          .category("bootstrap")
          .debug(
            "Skipping storage defaults initialization during SSR (no window)",
          );
        return;
      }

      const { SecureStorage } = await import("@/lib/storage");

      // Check each key and collect those that need initialization
      const defaults = getStorageDefaults();
      const entries = Object.entries(defaults).filter(([, v]) => v !== null) as [string, string][];

      // Read all keys in parallel, then write missing ones in parallel
      const existingValues = await Promise.all(
        entries.map(([key]) => SecureStorage.getItem(key)),
      );

      await Promise.all(
        entries
          .filter((_, i) => existingValues[i] === null)
          .map(async ([key, defaultValue]) => {
            await SecureStorage.setItem(key, defaultValue);
            logger
              .category("bootstrap")
              .debug(`Storage key initialized: ${key} = ${defaultValue}`);
          }),
      );

      logger
        .category("bootstrap")
        .info("Storage defaults initialized successfully");
    } catch (error) {
      logger
        .category("bootstrap")
        .warn("Failed to initialize storage defaults (non-critical)", {
          error: (error as Error).message,
        });
      // Non-critical - app can still boot
    }
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
