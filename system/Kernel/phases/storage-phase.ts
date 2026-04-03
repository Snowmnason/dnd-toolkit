/**
 * Phase 3: Storage Phase (CRITICAL)
 * 
 * Responsibility: Initialize SecureStorage and validate data integrity
 * Called by: system/Kernel/app-kernel.ts
 * 
 * Timing: ~50-200ms, max 1000ms (defined in app-kernel)
 * Critical: YES — persistent storage is required for app operation (caching, offline mutation queue, session persistence)
 * Failure mode: Reported as critical crash; app enters safe mode
 * 
 * Does:
 * 1. Validate data classification registry
 * 2. Initialize SecureStorage (encrypted, platform-specific)
 * 3. Initialize storage health monitoring
 * 4. Load offline mutation queue from persisted state
 * 5. Initialize cache versioning and migrations
 * 
 * What initializes:
 * - SecureStorage instance (iOS Keychain, Android Keystore, web localStorage)
 * - Cache versioning system
 * - Offline mutation queue
 * - Query cache class
 *
 * NOTE: Critical component — storage unavailability is a fatal bootstrap error
 */

/**
 * Execute storage phase
 * 
 * Initializes SecureStorage system, validates data classifications,
 * and sets default values for all storage keys. Critical failures
 * trigger crash handler and enter safe mode.
 * 
 * @param state - Mutable kernel state
 */
export async function storagePhase(signal: AbortSignal): Promise<void> {
  try {
    if (signal.aborted) return;
    const { logger } = await import("@/lib/utils");
    const { validateClassifications } = await import("@/type-definitions");
    const { getAppConfig } = await import("@/config");

    // Validate data classification registry integrity early
    // Catch configuration errors (mismatched keys, invalid sensitivity, bad patterns) immediately
    validateClassifications();
    logger.category("bootstrap").debug("Data classification registry validated");

    // DEFERRED: Storage health monitoring is deferred to jobSetupPhase (Phase 5)
    // because it transitively uses the job queue singleton, which is not yet
    // initialized with storage adapters until after this phase completes.
    // See jobSetupPhase() which calls registerStorageHealthCheckJob() after queue is ready.

    // Initialize LRU cache capacity management (load config and initialize LRU eviction)
    const appConfig = getAppConfig();
    if (appConfig.cacheCapacity) {
      const { cacheInvalidationOrchestrator } = await import("@/system/Storage/");
      const cacheCapacity = appConfig.cacheCapacity;
      
      // Validate required properties exist
      if (
        typeof cacheCapacity.hardMaxBytes === 'number' &&
        typeof cacheCapacity.softThreshold === 'number' &&
        typeof cacheCapacity.targetAfterEviction === 'number'
      ) {
        cacheInvalidationOrchestrator.initialize({ cacheCapacity });
        logger.category("bootstrap").debug("Cache invalidation orchestrator initialized", {
          hardMaxBytes: cacheCapacity.hardMaxBytes,
          softThreshold: cacheCapacity.softThreshold,
          targetAfterEviction: cacheCapacity.targetAfterEviction,
        });
      } else {
        logger.category("bootstrap").warn("Invalid cacheCapacity config: missing or invalid required properties");
      }
    }

    // Initialize all storage keys with safe defaults on startup
    await initializeStorageDefaultsInternal();

    logger
      .category("bootstrap")
      .debug("Storage system initialized and ready");
  } catch (error) {
    const { logger } = await import("@/lib/utils");
    const { reportStorageCrash } = await import(
      "@/system/Degrade/handlers/crash-handlers"
    );
    const errorMsg = (error as Error).message;
    logger
      .category("bootstrap")
      .warn("Storage initialization error (critical)", {
        error: errorMsg,
      });
    // Mark storage as crashed — storage unavailability is a critical failure
    reportStorageCrash(`Storage initialization failed: ${errorMsg}`, false);
    // Critical failure — app must enter safe mode
  }
}

/**
 * Internal: Initialize storage defaults
 * 
 * Sets default values for all storage keys on first boot.
 * Skips during SSR (server-side rendering).
 */
async function initializeStorageDefaultsInternal(): Promise<void> {
  const { logger } = await import("@/lib/utils");

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

  const { SecureStorage } = await import("@/system/Storage");
  const { getStorageDefaults } = await import("@/maps/storage-defaults");

  // Check each key and collect those that need initialization
  const defaults = getStorageDefaults();
  const entries = Object.entries(defaults).filter(
    ([, v]) => v !== null,
  ) as [string, string][];

  // Read all keys in parallel, then write missing ones in parallel
  const existingValues = await Promise.all(
    entries.map(([key]) => SecureStorage.getItem(key)),
  );

  await Promise.all(
    entries
      // eslint-disable-next-line security/detect-object-injection
      .filter((_, i) => existingValues[i] === null)
      .map(async ([key, defaultValue]) => {
        await SecureStorage.setItem(key, defaultValue);
        logger
          .category("bootstrap")
          .debug(`Storage key initialized: ${key} = ${defaultValue}`);
      }),
  );

  logger.category("bootstrap").info("Storage defaults initialized successfully");
}
