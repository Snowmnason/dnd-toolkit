/**
 * Analytics Consent/Privacy Layer
 * 
 * Provides a foundation for consent-based analytics tracking.
 * Allows users to opt-in/out of analytics collection at runtime.
 * Future-proofs for GDPR, privacy regulations, and user preferences.
 * 
 * Default: Read from config.analytics.consent.defaultLevel (or 'basic' if missing/invalid).
 * This ensures GDPR compliance out-of-the-box. Users must explicitly
 * opt-in to 'full' tracking for usage analytics and performance monitoring.
 * 
 * Persistence: Consent level is stored in SecureStorage to survive app restarts.
 * Initialize early during app bootstrap via initialize().
 */

import { getAppConfig } from '@/config';
import { SecureStorage } from '@/lib/storage';
import { logger } from '@/lib/utils/logger';
import { STORAGE_KEYS } from "@/maps";

export type ConsentLevel = 'none' | 'basic' | 'full';

/**
 * Read and validate the configured default consent level.
 * Ensures config.analytics.consent.defaultLevel is a valid ConsentLevel,
 * falling back to 'basic' (GDPR minimum) if missing or invalid.
 *
 * Logs a warning if an invalid value is detected in config.
 */
function getConfiguredDefaultConsent(): ConsentLevel {
  const config = getAppConfig();
  const configValue = config.analytics?.consent?.defaultLevel;

  // Validate that the configured value is a valid ConsentLevel
  if (configValue && ['none', 'basic', 'full'].includes(configValue)) {
    return configValue as ConsentLevel;
  }

  // Invalid or missing config - log and fall back to 'basic'
    if (configValue) {
    logger.category('analytics').warn('InvalidConsentConfig', 'Invalid analytics consent level in config, using default', {
      configured: configValue,
      fallback: 'basic',
    });
  }

  return 'basic';
}

const DEFAULT_CONSENT: ConsentLevel = getConfiguredDefaultConsent();

class AnalyticsConsentManager {
  private consentLevel: ConsentLevel = DEFAULT_CONSENT;
  private isInitialized = false;

  /**
   * Initialize consent by preferring a fresh SecureStorage cache, then database, then default.
   *
   * Options:
   * - maxAgeMs: Cache freshness threshold (default 4 hours). Fresh cache is trusted; stale cache triggers DB refresh.
   * - forceRefresh: Skip cache, always fetch from database if authenticated
   *
   * Read Strategy (actual behavior):
   * 1. Check SecureStorage cache with timestamp validation (respects `maxAgeMs`).
   * 2. If cache is fresh, return it (SecureStorage is treated as the source of truth).
   * 3. If cache is stale/missing and authenticated, fetch from database.
   * 4. Cache database result back to SecureStorage for next time.
   * 5. If not authenticated or DB read fails, fall back to stale cache (if present) or configured default.
   *
   * Call this early during app bootstrap, before analytics dispatch.
   */
  async initialize(options?: { maxAgeMs?: number; forceRefresh?: boolean }): Promise<ConsentLevel> {
    const maxAgeMs = options?.maxAgeMs ?? (4 * 60 * 60 * 1000); // Default 4 hours
    const forceRefresh = options?.forceRefresh ?? false;
    let sourceOfTruth: ConsentLevel = DEFAULT_CONSENT;

    try {

      // Step 1: Try SecureStorage cache first (source of truth after initial load)
      if (!forceRefresh) {
        const stored = await SecureStorage.getItem(STORAGE_KEYS.ANALYTICS_CONSENT);
        const cacheMeta = await SecureStorage.getJSON<{ timestamp: number }>(
          STORAGE_KEYS.ANALYTICS_CONSENT_META,
        );

        if (stored && this.isValidConsentLevel(stored) && cacheMeta) {
          const cacheAge = Date.now() - cacheMeta.timestamp;
          const isCacheFresh = cacheAge < maxAgeMs;

          if (isCacheFresh) {
            // Cache is fresh - trust SecureStorage as source of truth
            sourceOfTruth = stored as ConsentLevel;
            logger.category('analytics').analytics('consent_initialized', `Loaded from SecureStorage cache (age: ${cacheAge}ms)`, {
              level: sourceOfTruth,
            });
            this.consentLevel = sourceOfTruth;
            this.isInitialized = true;
            return sourceOfTruth;
          }

          // Cache is stale - will try to refresh from database below
          logger.category('analytics').analytics('consent_initialized', `SecureStorage cache stale (age: ${cacheAge}ms), refreshing from database`);
        }
      } else {
        logger.category('analytics').analytics('consent_initialized', 'Force refresh requested, skipping cache');
      }

      // Step 2: Try database if authenticated and cache is stale/missing
      try {
        const { userSettingsDB } = await import('@/lib/database');
        const { getDatabaseProvider } = await import('@/lib/services');

        if (getDatabaseProvider().isConfigured()) {
          // Attempt to fetch user settings from database
          const settings = await userSettingsDB.fetchCurrentUserSettings({ forceRefresh: true });
          if (settings && settings.analytics_consent_level && this.isValidConsentLevel(settings.analytics_consent_level)) {
            sourceOfTruth = settings.analytics_consent_level as ConsentLevel;
            logger.category('analytics').analytics('consent_initialized', 'Loaded from database', {
              level: sourceOfTruth,
            });

            // Cache the database result back to SecureStorage for next time
            try {
              await SecureStorage.setItem(STORAGE_KEYS.ANALYTICS_CONSENT, sourceOfTruth);
              await SecureStorage.setJSON(STORAGE_KEYS.ANALYTICS_CONSENT_META, {
                timestamp: Date.now(),
                source: 'database',
              });
            } catch (storageErr) {
              logger.category('analytics').warn('consent_initialized', 'Failed to cache consent to SecureStorage (non-critical)', {
                error: storageErr,
              });
            }

            this.consentLevel = sourceOfTruth;
            this.isInitialized = true;
            return sourceOfTruth;
          }
        }
      } catch (dbErr) {
        // Database read failed (not authenticated or offline or DB error)
        // Fall back to SecureStorage cache or default below
        logger.category('analytics').warn('consent_initialized', 'Database read failed, falling back to SecureStorage or default', {
          error: dbErr instanceof Error ? dbErr.message : String(dbErr),
        });
      }

      // Step 3: Fall back to stale SecureStorage cache if available
      const stored = await SecureStorage.getItem(STORAGE_KEYS.ANALYTICS_CONSENT);
      if (stored && this.isValidConsentLevel(stored)) {
        sourceOfTruth = stored as ConsentLevel;
        logger.category('analytics').analytics('consent_initialized', 'Using stale SecureStorage cache as fallback', {
          level: sourceOfTruth,
        });
        this.consentLevel = sourceOfTruth;
        this.isInitialized = true;
        return sourceOfTruth;
      }

      // Step 4: Fall back to default
      logger.category('analytics').analytics('consent_initialized', 'Using default consent level', {
        level: DEFAULT_CONSENT,
      });
      sourceOfTruth = DEFAULT_CONSENT;
    } catch (err) {
      // Catch-all for any unexpected errors
      logger.category('analytics').error('consent_initialized', 'Unexpected error during initialization, using default', {
        error: err instanceof Error ? err.message : String(err),
      });
      sourceOfTruth = DEFAULT_CONSENT;
    }

    this.consentLevel = sourceOfTruth;
    this.isInitialized = true;
    return sourceOfTruth;
  }

  /**
   * Set the consent level and persist to SecureStorage.
   * - 'none': No analytics tracking
   * - 'basic': Only essential events (errors, auth)
   * - 'full': All analytics events including usage/performance
   * 
   * Non-blocking: Persists locally immediately, queues server sync for later.
   */
  async setLevel(level: ConsentLevel): Promise<void> {
    if (!this.isValidConsentLevel(level)) {
      const error = new Error(`Invalid consent level: ${level}`);
      logger.category('analytics').error('consent', 'Attempted to set invalid consent level', { level, error });
      throw error;
    }

    const previousLevel = this.consentLevel;
    this.consentLevel = level;

    try {
      await SecureStorage.setItem(STORAGE_KEYS.ANALYTICS_CONSENT, level);
      // Update meta timestamp so next app start treats cache as fresh
      await SecureStorage.setJSON(STORAGE_KEYS.ANALYTICS_CONSENT_META, {
        timestamp: Date.now(),
        source: 'user',
      });
    } catch (err) {
      logger.category('analytics').error('consent', 'Failed to persist consent level to storage', { level, error: err });
    }

    // If consent was downgraded, purge all pending analytics buffers and breadcrumbs
    const CONSENT_ORDER: Record<ConsentLevel, number> = { none: 0, basic: 1, full: 2 };
    // eslint-disable-next-line security/detect-object-injection
    if (CONSENT_ORDER[level] < CONSENT_ORDER[previousLevel]) {
      logger.category('analytics').analytics('consent', 'Consent downgraded — purging analytics buffers and breadcrumbs', { previousLevel, level });
      try {
        const { handleAnalyticsConsentWithdrawal } = await import('./analytics-network-integration');
        await handleAnalyticsConsentWithdrawal();
      } catch (err) {
        logger.category('analytics').warn('consent', 'Failed to purge analytics buffer on consent withdrawal (non-critical)', { error: err });
      }
      try {
        const { breadcrumbQueue } = await import('./breadcrumb-queue');
        await breadcrumbQueue.clear();
      } catch (err) {
        logger.category('analytics').warn('consent', 'Failed to purge breadcrumb queue on consent withdrawal (non-critical)', { error: err });
      }
    }

    // Queue the update to sync queue (fire-and-forget, non-blocking)
    // This will sync the change to the database when online
    try {
      const { ConsentSyncQueue } = await import('./consent-sync-queue');
      const syncId = await ConsentSyncQueue.enqueue(level);
      logger.category('analytics').analytics('consent', 'Queued consent change for sync', { level, syncId });
    } catch (err) {
      logger.category('analytics').warn('consent', 'Failed to queue consent sync (non-critical)', { level, error: err });
      // Don't throw - local persistence succeeded, queue failure is non-blocking
    }
  }

  /**
   * Get current consent level (in-memory)
   */
  getLevel(): ConsentLevel {
    return this.consentLevel;
  }

  /**
   * Get stored consent from SecureStorage without updating in-memory state.
   */
  async getStoredConsent(): Promise<ConsentLevel> {
    try {
      const stored = await SecureStorage.getItem(STORAGE_KEYS.ANALYTICS_CONSENT);
      if (stored && this.isValidConsentLevel(stored)) {
        return stored as ConsentLevel;
      }
    } catch (err) {
      // Ignore storage errors
      logger.category('analytics').error('consent', 'Failed to retrieve stored consent level from storage', { error: err });
    }
    return DEFAULT_CONSENT;
  }

  /**
   * Reset consent to default 'basic' (for testing only)
   */
  resetToDefault(): void {
    this.consentLevel = DEFAULT_CONSENT;
    this.isInitialized = false;
    logger.category('analytics').analytics('consent', 'Consent reset to default');
  }

  /**
   * Check if tracking is allowed for a given consent category.
   *
   * @deprecated Prefer `shouldEmitEvent(category, AnalyticsConsent.getLevel())` from consent-gating.ts.
   * This method is kept for backwards-compat with tests; logic mirrors shouldEmitEvent().
   *
   * Gate logic:
   * - 'essential': always true (even for 'none')
   * - 'performance': true if >= 'basic'
   * - 'usage': true only for 'full'
   */
  isAllowed(category: 'essential' | 'performance' | 'usage'): boolean {
    switch (category) {
      case 'essential':
        return true; // Essential always allowed, even for 'none'
      case 'performance':
        return this.consentLevel === 'basic' || this.consentLevel === 'full';
      case 'usage':
        return this.consentLevel === 'full';
      default:
        return true;
    }
  }

  /**
   * Validate consent level
   */
  private isValidConsentLevel(level: any): level is ConsentLevel {
    return ['none', 'basic', 'full'].includes(level);
  }
}

export const AnalyticsConsent = new AnalyticsConsentManager();
