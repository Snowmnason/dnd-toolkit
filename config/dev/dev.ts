/**
 * Dev Configuration Utilities
 *
 * Combines two concerns that are exclusively development-facing:
 *   1. Dev-only runtime utilities (createDevConsole, createDevTimer, devAssert, isDevBypassEnabled)
 *      — safe to call in production; all return no-ops
 *   2. Config Hot-Reload (ConfigHotReload, initializeHotReload, getHotReload)
 *      — watches appsettings.dev.json for changes and reloads without restart
 *      — completely disabled in production
 *
 * Usage:
 *   import { createDevConsole } from '@/lib/config/dev';
 *   const log = createDevConsole('MyModule');
 *   log.warn('only in dev');
 *
 *   import { initializeHotReload } from '@/lib/config/dev';
 *   const hotReload = initializeHotReload(config);
 *   await hotReload.start();
 */

import { logger } from '@/lib/utils/logger';
import type { AppSettings } from '../core/loader';
import { getAppConfig, isDevelopment, validateAppSettings } from '../core/loader';
import { CURRENT_CONFIG_VERSION, migrateConfig } from '../core/migrations';
import { mergeConfigForPlatform } from '../core/platform-config';

// =============================================================================
// Dev-Only Utilities
// =============================================================================

/**
 * Dev-only console logger factory.
 * In production, returns an object with no-op methods (minimal overhead).
 */
export function createDevConsole(scope: string) {
  if (!isDevelopment()) {
    return {
      log: () => {},
      warn: () => {},
      error: () => {},
    };
  }

  const config = getAppConfig();

  return {
    log: (...args: any[]) => {
      if (config.devTools.enableConsoleLogger) {
        console.log(`[${scope}]`, ...args);
      }
    },
    warn: (...args: any[]) => {
      if (config.devTools.enableConsoleLogger) {
        console.warn(`[${scope}]`, ...args);
      }
    },
    error: (...args: any[]) => {
      if (config.devTools.enableConsoleLogger) {
        console.error(`[${scope}]`, ...args);
      }
    },
  };
}

/**
 * Check if dev bypass mode is enabled (skips auth, feature gates, etc. during testing).
 * Only available in development; always returns false in production.
 */
export function isDevBypassEnabled(): boolean {
  if (!isDevelopment()) return false;
  const config = getAppConfig();
  return config.features.devBypass;
}

/**
 * Dev-only debug assertion.
 * Throws in dev if condition is false; returns immediately in production (no-op).
 */
export function devAssert(condition: boolean, message: string): void {
  if (!isDevelopment()) return;
  if (!condition) {
    const config = getAppConfig();
    if (config.overrides.verboseErrorMessages) {
      throw new Error(`[DEV ASSERTION] ${message}`);
    }
  }
}

/**
 * Dev-only performance monitoring.
 * In production, returns a timer with a no-op `end()` method (minimal overhead).
 */
export function createDevTimer(label: string) {
  if (!isDevelopment()) {
    return { end: () => {} };
  }

  const config = getAppConfig();
  const startTime = Date.now();

  return {
    end: () => {
      if (config.devTools.enablePerformanceLogger) {
        const elapsed = Date.now() - startTime;
        console.log(`[PERF] ${label}: ${elapsed}ms`);
      }
    },
  };
}

// =============================================================================
// Config Hot-Reload (Development Only)
// =============================================================================

interface HotReloadOptions {
  onReload?: (oldConfig: AppSettings, newConfig: AppSettings) => void;
  /** Default: 2000ms */
  pollInterval?: number;
  /** Default: 300ms */
  debounceInterval?: number;
}

/**
 * Deterministic deep-equal comparison for config objects.
 */
function deepEqual(a: any, b: any): boolean {
  const stableStringify = (value: any): string => {
    try {
      if (value === null) return 'null';
      if (value === undefined) return 'undefined';
      const t = typeof value;
      if (t !== 'object') return JSON.stringify(value);
      if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(',')}]`;
      }
      const keys = Object.keys(value).sort();
      /* eslint-disable-next-line security/detect-object-injection -- safe: keys derived from Object.keys */
      const props = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
      return `{${props.join(',')}}`;
    } catch {
      return String(value);
    }
  };
  return stableStringify(a) === stableStringify(b);
}

/**
 * Compute SHA256 hash of content string for change detection.
 */
async function hashContent(content: string): Promise<string> {
  try {
    try {
      const nodeCrypto = typeof require !== 'undefined' ? require('crypto') : null;
      if (nodeCrypto && typeof nodeCrypto.createHash === 'function') {
        return nodeCrypto.createHash('sha256').update(content).digest('hex');
      }
    } catch {
      // ignore and try Web Crypto
    }
    if (typeof globalThis !== 'undefined' && (globalThis as any).crypto?.subtle) {
      try {
        const enc = new TextEncoder();
        const data = enc.encode(content);
        const hashBuffer = await (globalThis as any).crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      } catch {
        // proceed to fallback
      }
    }
  } catch {
    // fall through
  }
  return `len:${content.length}:${content.charCodeAt(0) || 0}`;
}

/**
 * Watches appsettings.dev.json for changes and applies them without restart.
 * Full pipeline: load → migrate → merge platforms → validate.
 */
export class ConfigHotReload {
  private isWatching = false;
  private currentConfig: AppSettings;
  private listeners: ((config: AppSettings) => void)[] = [];
  private lastFileModified: string | null = null;
  private lastContentHash: string | null = null;
  private pollTimeout: ReturnType<typeof setTimeout> | null = null;
  private debounceTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingConfig: AppSettings | null = null;

  constructor(initialConfig: AppSettings) {
    this.currentConfig = initialConfig;
  }

  async start(options: HotReloadOptions = {}): Promise<void> {
    if (!this.isDevelopmentMode()) {
      logger.category('bootstrap').info('Hot-reload skipped (production mode)');
      return;
    }
    if (this.isWatching) {
      logger.category('bootstrap').info('Hot-reload already running');
      return;
    }
    this.isWatching = true;
    logger.category('bootstrap').debug('Config hot-reload started');
    const interval = options.pollInterval || 2000;
    const debounceInterval = options.debounceInterval || 300;
    this.startPolling(interval, debounceInterval, options.onReload);
  }

  stop(): void {
    this.isWatching = false;
    if (this.pollTimeout) { clearTimeout(this.pollTimeout); this.pollTimeout = null; }
    if (this.debounceTimeout) { clearTimeout(this.debounceTimeout); this.debounceTimeout = null; }
    logger.category('bootstrap').debug('Config hot-reload stopped');
  }

  subscribe(listener: (config: AppSettings) => void): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter((l) => l !== listener); };
  }

  getConfig(): AppSettings {
    return this.currentConfig;
  }

  private startPolling(
    interval: number,
    debounceInterval: number,
    onReload?: (oldConfig: AppSettings, newConfig: AppSettings) => void,
  ): void {
    const poll = async () => {
      if (!this.isWatching) return;

      try {
        const response = await this.fetchConfigHeaders();
        if (!response) return;

        const lastModified = response.lastModified;
        const fileChanged = lastModified
          ? lastModified !== this.lastFileModified
          : await this.checkContentHashChanged();

        if (fileChanged) {
          if (lastModified) this.lastFileModified = lastModified;

          if (this.debounceTimeout) clearTimeout(this.debounceTimeout);

          this.debounceTimeout = setTimeout(async () => {
            this.debounceTimeout = null;
            try {
              const newContent = await this.loadConfigContent();
              if (!newContent) return;

              try {
                const newConfig = this.processConfig(newContent);
                if (!deepEqual(this.currentConfig, newConfig)) {
                  const oldConfig = this.currentConfig;
                  this.currentConfig = newConfig;
                  logger.category('other').debug('Config hot-reloaded');
                  this.notifyListeners(newConfig);
                  if (onReload) {
                    try { await onReload(oldConfig, newConfig); }
                    catch (callbackError) {
                      logger.category('other').error(`onReload callback failed: ${callbackError}`);
                    }
                  }
                }
              } catch (validationError) {
                logger.category('other').warn(
                  `Config validation failed, keeping previous config: ${validationError}`,
                );
              }
            } catch (error) {
              logger.category('other').debug(`Hot-reload processing failed: ${error}`);
            }
          }, debounceInterval);
        }
      } catch (error) {
        logger.category('other').debug(`Hot-reload check failed: ${error}`);
      }

      if (this.isWatching) {
        this.pollTimeout = setTimeout(poll, interval);
      }
    };

    poll();
  }

  private async fetchConfigHeaders(): Promise<{ lastModified: string | null } | null> {
    try {
      if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
        const response = await fetch('/config/appsettings.dev.json', { method: 'HEAD', cache: 'no-store' });
        if (!response.ok) return null;
        return { lastModified: response.headers.get('Last-Modified') };
      }
      return null;
    } catch {
      return null;
    }
  }

  private async checkContentHashChanged(): Promise<boolean> {
    try {
      const newContent = await this.loadConfigContent();
      if (!newContent) return false;
      const newHash = await hashContent(newContent);
      if (newHash !== this.lastContentHash) {
        this.lastContentHash = newHash;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private async loadConfigContent(): Promise<string | null> {
    try {
      if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
        const response = await fetch('/config/appsettings.dev.json', { cache: 'no-store' });
        if (!response.ok) return null;
        return response.text();
      }
      return null;
    } catch {
      return null;
    }
  }

  private processConfig(content: string): AppSettings {
    let config: any;
    try {
      config = JSON.parse(content);
    } catch (_error) {
      throw new Error(`Config JSON is malformed: ${_error instanceof Error ? _error.message : String(_error)}`);
    }

    const detectedVersion = config.version;
    if (typeof detectedVersion !== 'number') {
      throw new Error(`Config version must be a number. Got: ${typeof detectedVersion}`);
    }

    try {
      config = migrateConfig(config, detectedVersion, CURRENT_CONFIG_VERSION);
    } catch (_error) {
      throw new Error(`Config migration failed: ${_error instanceof Error ? _error.message : String(_error)}`);
    }

    try {
      config = mergeConfigForPlatform(config as AppSettings);
    } catch (_error) {
      throw new Error(`Platform config merge failed: ${_error instanceof Error ? _error.message : String(_error)}`);
    }

    const validationResult = validateAppSettings(config as AppSettings);
    if (!validationResult.valid) {
      throw new Error(`Config validation failed: ${validationResult.errors.join('; ')}`);
    }

    return config as AppSettings;
  }

  private notifyListeners(config: AppSettings): void {
    for (const listener of this.listeners) {
      try { listener(config); }
      catch (error) { logger.category('other').error(`Listener error: ${error}`); }
    }
  }

  private isDevelopmentMode(): boolean {
    if (typeof process !== 'undefined' && process.env) {
      return process.env.NODE_ENV === 'development';
    }
    if (typeof window !== 'undefined') {
      return (globalThis as any).EXPO_PUBLIC_ENVIRONMENT === 'development';
    }
    return false;
  }
}

// Global instance
let hotReloadInstance: ConfigHotReload | null = null;

/**
 * Initialize global hot-reload instance.
 * Call once at app startup with the initial config.
 */
export function initializeHotReload(initialConfig: AppSettings): ConfigHotReload {
  if (hotReloadInstance) {
    logger.category('bootstrap').warn('Hot-reload already initialized');
    return hotReloadInstance;
  }
  hotReloadInstance = new ConfigHotReload(initialConfig);
  return hotReloadInstance;
}

/**
 * Get the global hot-reload instance. Throws if not yet initialized.
 */
export function getHotReload(): ConfigHotReload {
  if (!hotReloadInstance) {
    throw new Error('Hot-reload not initialized. Call initializeHotReload(config) first.');
  }
  return hotReloadInstance;
}

/**
 * Check if hot-reload is available (initialized).
 */
export function isHotReloadAvailable(): boolean {
  return hotReloadInstance !== null;
}
