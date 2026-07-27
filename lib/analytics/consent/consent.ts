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
import { AnalyticsError } from '@/lib/analytics/utils';
import { logger } from '@/lib/utils/logger';
import { STORAGE_KEYS } from "@/maps";
import { loadAnalyticsQueue, loadAnalyticsQueueJSON, persistAnalyticsQueue, persistAnalyticsQueueJSON } from "@/middleware/storage";
import { setCurrentConsentLevel, type ConsentLevel } from '@/type-definitions/analytics-types';
import { AnalyticsErrorCode } from '@/type-definitions/error-codes';

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
        const stored = await loadAnalyticsQueue(STORAGE_KEYS.ANALYTICS_CONSENT);
        const cacheMeta = await loadAnalyticsQueueJSON<{ timestamp: number }>(
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
            setCurrentConsentLevel(sourceOfTruth);
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
        const { isDatabaseConfigured } = await import('@/lib/database');

        if (isDatabaseConfigured()) {
          // Attempt to fetch user settings from database
          const settings = await userSettingsDB.fetchCurrentUserSettings({ forceRefresh: true });
          if (settings && settings.analytics_consent_level && this.isValidConsentLevel(settings.analytics_consent_level)) {
            sourceOfTruth = settings.analytics_consent_level as ConsentLevel;
            logger.category('analytics').analytics('consent_initialized', 'Loaded from database', {
              level: sourceOfTruth,
            });

            // Cache the database result back to SecureStorage for next time
            try {
              await persistAnalyticsQueue(STORAGE_KEYS.ANALYTICS_CONSENT, sourceOfTruth);
              await persistAnalyticsQueueJSON(STORAGE_KEYS.ANALYTICS_CONSENT_META, {
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
            setCurrentConsentLevel(sourceOfTruth);
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
      const stored = await loadAnalyticsQueue(STORAGE_KEYS.ANALYTICS_CONSENT);
      if (stored && this.isValidConsentLevel(stored)) {
        sourceOfTruth = stored as ConsentLevel;
        logger.category('analytics').analytics('consent_initialized', 'Using stale SecureStorage cache as fallback', {
          level: sourceOfTruth,
        });
        this.consentLevel = sourceOfTruth;
        this.isInitialized = true;
        setCurrentConsentLevel(sourceOfTruth);
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
    setCurrentConsentLevel(sourceOfTruth);
    return sourceOfTruth;
  }

  /**
   * Set the consent level and persist to SecureStorage.
   * - 'none': No analytics tracking
   * - 'basic': Only essential events (errors, auth)
   * - 'full': All analytics events including usage/performance
   * 
   * Retries persistence up to 3 times on transient failures.
   * Throws AnalyticsError if level is invalid or persist exhausts retries (critical).
   * Non-blocking side effects (purge, sync) are best-effort.
   *
   * @returns `{ downgraded }` — true if this call lowered the consent level (e.g. full -> basic).
   *   Callers (analytics-manager) use this to decide whether to clear pending analytics jobs.
   */
  async setLevel(level: ConsentLevel): Promise<{ downgraded: boolean }> {
    if (!this.isValidConsentLevel(level)) {
      throw new AnalyticsError(AnalyticsErrorCode.CONSENT_INVALID, { attempted_level: level });
    }

    const previousLevel = this.consentLevel;
    this.consentLevel = level;

    // Persist with retry logic (max 3 attempts with exponential backoff)
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await persistAnalyticsQueue(STORAGE_KEYS.ANALYTICS_CONSENT, level);
        // Update meta timestamp so next app start treats cache as fresh
        await persistAnalyticsQueueJSON(STORAGE_KEYS.ANALYTICS_CONSENT_META, {
          timestamp: Date.now(),
          source: 'user',
        });
        // Success — clear error and break
        lastError = undefined;
        logger.category('analytics').analytics('consent', 'Consent level persisted', { level });
        break;
      } catch (err) {
        lastError = err;
        // Transient failure — log and retry if attempts remain
        if (attempt < maxRetries) {
          const backoffMs = Math.pow(2, attempt - 1) * 100; // 100ms, 200ms, 400ms
          logger.category('analytics').warn('consent', `Persist failed (attempt ${attempt}/${maxRetries}), retrying in ${backoffMs}ms`, {
            level,
            error: err instanceof Error ? err.message : String(err),
          });
          // Exponential backoff before retry
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }

    // After all retries exhausted, check if last attempt failed
    if (lastError) {
      logger.category('analytics').error('consent', 'Failed to persist consent level after all retries', { level, error: lastError });
      throw new AnalyticsError(AnalyticsErrorCode.CONSENT_PERSIST_FAILED, {
        level,
        attempted_change: `${previousLevel} → ${level}`,
        cause: lastError instanceof Error ? lastError.message : String(lastError),
        retries: maxRetries,
      });
    }

    // Persist succeeded — update the shared hot-path so direct callers see fresh state
    setCurrentConsentLevel(level);

    // If consent was downgraded, purge all pending breadcrumbs
    const CONSENT_ORDER: Record<ConsentLevel, number> = { none: 0, basic: 1, full: 2 };
    // eslint-disable-next-line security/detect-object-injection
    const downgraded = CONSENT_ORDER[level] < CONSENT_ORDER[previousLevel];
    if (downgraded) {
      logger.category('analytics').analytics('consent', 'Consent downgraded — purging breadcrumbs', { previousLevel, level });
      try {
        const { breadcrumbQueue } = await import('../exporters/breadcrumb-queue');
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

    return { downgraded };
  }

  /**
   * Get current consent level (in-memory)
   */
  getLevel(): ConsentLevel {
    return this.consentLevel;
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
   * Validate consent level
   */
  private isValidConsentLevel(level: any): level is ConsentLevel {
    return ['none', 'basic', 'full'].includes(level);
  }
}

export const AnalyticsConsent = new AnalyticsConsentManager();
