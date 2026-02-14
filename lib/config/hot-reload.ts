/**
 * Runtime Config Hot-Reload (Development Only)
 *
 * Watches appsettings.dev.json for changes and applies them without restart.
 * Reapplies full config pipeline: load → migrate → merge platforms → validate.
 * Gracefully handles validation errors (keeps previous config, logs error).
 *
 * **Development-Only**: Completely disabled in production via isDevelopment() guard.
 *
 * Usage:
 *   const config = getAppConfig();
 *   const hotReload = initializeHotReload(config);
 *   await hotReload.start({ pollInterval: 1000 });
 *
 *   // Subscribe to config changes
 *   const unsubscribe = hotReload.subscribe((newConfig) => {
 *     logger.info("config", "Config changed!");
 *     updateModuleState(newConfig);
 *   });
 */

import { logger } from "@/lib/utils/logger";
import { validateAppSettings } from "./config-validator";
import type { AppSettings } from "./loader";
import { CURRENT_CONFIG_VERSION, migrateConfig } from "./migrations";
import { mergeConfigForPlatform } from "./platform-config";

interface HotReloadOptions {
  onReload?: (oldConfig: AppSettings, newConfig: AppSettings) => void;
  pollInterval?: number; // Default: 2000ms; debounced to 300-500ms on rapid successive writes
  debounceInterval?: number; // Default: 300ms
}

/**
 * ConfigHotReload: Watches config file for changes and applies without restart.
 * Full pipeline: load → migrate → merge platforms → validate.
 */
export class ConfigHotReload {
  private isWatching = false;
  private currentConfig: AppSettings;
  private listeners: ((config: AppSettings) => void)[] = [];
  private lastFileModified: string | null = null; // Last-Modified header value
  private pollTimeout: ReturnType<typeof setTimeout> | null = null;
  private debounceTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingConfig: AppSettings | null = null;

  constructor(initialConfig: AppSettings) {
    this.currentConfig = initialConfig;
  }

  /**
   * Start watching config file for changes (dev only).
   * Polls appsettings.dev.json for file content changes.
   */
  async start(options: HotReloadOptions = {}): Promise<void> {
    // Only allow in development; silently skip in production
    if (!this.isDevelopmentMode()) {
      logger.info("bootstrap", "Hot-reload skipped (production mode)");
      return;
    }

    if (this.isWatching) {
      logger.info("bootstrap", "Hot-reload already running");
      return;
    }

    this.isWatching = true;
    logger.debug("bootstrap", "Config hot-reload started");

    const interval = options.pollInterval || 2000; // Default: 2000ms (less aggressive)
    const debounceInterval = options.debounceInterval || 300; // Debounce rapid writes
    this.startPolling(interval, debounceInterval, options.onReload);
  }

  /**
   * Stop watching config file.
   */
  stop(): void {
    this.isWatching = false;
    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout);
      this.pollTimeout = null;
    }
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = null;
    }
    logger.debug("bootstrap", "Config hot-reload stopped");
  }

  /**
   * Subscribe to config changes.
   * Returns unsubscribe function.
   */
  subscribe(listener: (config: AppSettings) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Get current runtime config.
   */
  getConfig(): AppSettings {
    return this.currentConfig;
  }

  /**
   * Start polling for file changes with debouncing.
   * Reapplies full config pipeline: load → migrate → merge platforms → validate
   * Debounces rapid successive changes (e.g., from editor auto-save) to reduce noise.
   */
  private startPolling(
    interval: number,
    debounceInterval: number,
    onReload?: (oldConfig: AppSettings, newConfig: AppSettings) => void
  ): void {
    const poll = async () => {
      if (!this.isWatching) return;

      try {
        const response = await this.fetchConfigHeaders();
        if (!response) return;

        const lastModified = response.lastModified;

        // Only process if file was actually modified
        if (lastModified && lastModified !== this.lastFileModified) {
          this.lastFileModified = lastModified;

          // Debounce: rapid successive changes are queued and processed once
          if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
          }

          this.debounceTimeout = setTimeout(async () => {
            this.debounceTimeout = null;
            try {
              const newContent = await this.loadConfigContent();
              if (!newContent) return;

              try {
                const newConfig = this.processConfig(newContent);

                // Only notify if config differs (ignore formatting changes)
                if (JSON.stringify(this.currentConfig) !== JSON.stringify(newConfig)) {
                  const oldConfig = this.currentConfig;
                  this.currentConfig = newConfig;

                  logger.debug("other", "Config hot-reloaded");
                  this.notifyListeners(newConfig);

                  if (onReload) {
                    try {
                      await onReload(oldConfig, newConfig);
                    } catch (callbackError) {
                      logger.error(
                        "other",
                        `onReload callback failed: ${callbackError}`
                      );
                    }
                  }
                }
              } catch (validationError) {
                // Validation failed: keep old config and log error
                logger.warn(
                  "other",
                  `Config validation failed, keeping previous config: ${validationError}`
                );
              }
            } catch (error) {
              logger.debug("other", `Hot-reload processing failed: ${error}`);
            }
          }, debounceInterval);
        }
      } catch (error) {
        logger.debug("other", `Hot-reload check failed: ${error}`);
      }

      // Schedule next poll
      if (this.isWatching) {
        this.pollTimeout = setTimeout(poll, interval);
      }
    };

    poll();
  }

  /**
   * Fetch headers (Last-Modified) from appsettings.dev.json to detect changes efficiently.
   * Returns { lastModified } or null on failure.
   */
  private async fetchConfigHeaders(): Promise<{ lastModified: string | null } | null> {
    try {
      if (typeof window !== "undefined" && typeof fetch !== "undefined") {
        const response = await fetch("/config/appsettings.dev.json", {
          method: "HEAD",
          cache: "no-store",
        });
        if (!response.ok) return null;
        return {
          lastModified: response.headers.get("Last-Modified"),
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Load raw content from appsettings.dev.json
   * On web: fetch from public folder
   * On native: return null (not yet supported)
   */
  private async loadConfigContent(): Promise<string | null> {
    try {
      if (typeof window !== "undefined" && typeof fetch !== "undefined") {
        // Web: fetch from public folder
        const response = await fetch("/config/appsettings.dev.json", {
          cache: "no-store",
        });
        if (!response.ok) return null;
        return response.text();
      }
      // Native: not yet supported
      return null;
    } catch {
      // Network/fetch errors; return null to skip this poll cycle
      return null;
    }
  }

  /**
   * Process config through full pipeline:
   * 1. Parse JSON
   * 2. Validate version field exists
   * 3. Apply migrations (version → CURRENT_CONFIG_VERSION)
   * 4. Merge platform-specific overrides
   * 5. Validate complete config
   *
   * Throws on any error in the pipeline.
   */
  private processConfig(content: string): AppSettings {
    // Step 1: Parse JSON
    let config: any;
    try {
      config = JSON.parse(content);
    } catch (_error) {
      throw new Error(`Config JSON is malformed: ${_error instanceof Error ? _error.message : String(_error)}`);
    }

    // Step 2: Validate version field exists
    const detectedVersion = config.version;
    if (typeof detectedVersion !== "number") {
      throw new Error(
        `Config version must be a number. Got: ${typeof detectedVersion}`
      );
    }

    // Step 3: Apply migrations if version is old
    try {
      config = migrateConfig(config, detectedVersion, CURRENT_CONFIG_VERSION);
    } catch (_error) {
      throw new Error(
        `Config migration failed: ${_error instanceof Error ? _error.message : String(_error)}`
      );
    }

    // Step 4: Merge platform-specific config
    try {
      config = mergeConfigForPlatform(config as AppSettings);
    } catch (_error) {
      throw new Error(
        `Platform config merge failed: ${_error instanceof Error ? _error.message : String(_error)}`
      );
    }

    // Step 5: Validate entire merged config
    const validationResult = validateAppSettings(config as AppSettings);
    if (!validationResult.valid) {
      throw new Error(
        `Config validation failed: ${validationResult.errors.join("; ")}`
      );
    }

    return config as AppSettings;
  }

  /**
   * Notify all listeners of config change.
   * Errors in listeners are caught and logged; don't propagate.
   */
  private notifyListeners(config: AppSettings): void {
    for (const listener of this.listeners) {
      try {
        listener(config);
      } catch (error) {
        logger.error("other", `Listener error: ${error}`);
      }
    }
  }

  /**
   * Check if running in development mode.
   * Uses a simple check: avoid circular imports by detecting context.
   */
  private isDevelopmentMode(): boolean {
    // Check environment variable
    if (typeof process !== "undefined" && process.env) {
      return process.env.NODE_ENV === "development";
    }
    // On web: check EXPO_PUBLIC_ENVIRONMENT
    if (typeof window !== "undefined") {
      return (globalThis as any).EXPO_PUBLIC_ENVIRONMENT === "development";
    }
    // Fallback: assume production if we can't detect
    return false;
  }
}

// Global instance
let hotReloadInstance: ConfigHotReload | null = null;

/**
 * Initialize global hot-reload instance.
 * Should be called once at app startup with the initial config.
 */
export function initializeHotReload(
  initialConfig: AppSettings
): ConfigHotReload {
  if (hotReloadInstance) {
    logger.warn("bootstrap", "Hot-reload already initialized");
    return hotReloadInstance;
  }
  hotReloadInstance = new ConfigHotReload(initialConfig);
  return hotReloadInstance;
}

/**
 * Get the global hot-reload instance.
 * Throws if not yet initialized.
 */
export function getHotReload(): ConfigHotReload {
  if (!hotReloadInstance) {
    throw new Error(
      "Hot-reload not initialized. Call initializeHotReload(config) first."
    );
  }
  return hotReloadInstance;
}

/**
 * Check if hot-reload is available (initialized).
 * Note: Returns true even if not currently running (start() not called yet).
 */
export function isHotReloadAvailable(): boolean {
  return hotReloadInstance !== null;
}
