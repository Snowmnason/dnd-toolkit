/**
 * Services Initialization Module
 * Centralizes setup for all services (Sentry, analytics exporters, auth provider, etc.)
 *
 * This file is called once during AppKernel bootstrap.
 * To remove a service: delete the initialization call from here.
 * No need to touch AppKernel multiple times.
 *
 * Services exposed:
 * - AuthProvider (Supabase by default, injectable for testing)
 * - SentryExporter (auto-registered)
 * - Future: Other service exporters
 *
 * Status tracking: each service records its readiness state via updateServiceStatus.
 * Kernel and health checks can call getServiceStatus() to understand app capability.
 */

import { AnalyticsExporter, exporterRegistry } from '@/lib/analytics/exporters';
import { performanceBaselineService } from '@/lib/analytics/performance/performance-baseline';
import { getAppConfig } from '@/lib/config/loader';
import { logger } from '@/lib/utils/logger';
import { createValidatedAuthProvider, registerAuthProvider, type AuthProvider } from './auth-provider';
import { NoOpErrorTracker, registerErrorTracker } from './error-tracker';
import { initializeSentryErrorTracker } from './sentry/sentry-service-initializer';
import {
  logValidationResult,
  validateSentryAnalyticsConfig,
  validateSentryErrorConfig,
  validateSupabaseAuthConfig,
  validateSupabaseDatabaseConfig,
} from './service-config-validation';
import {
  updateServiceStatus
} from './service-status';
import { SupabaseAuthProvider } from './supabase/supabase-auth-provider';

/**
 * Initialize all services
 * Call this once during app bootstrap (AppKernel phase) before CONFIG phase completes
 *
 * Safe to call multiple times (idempotent)
 */
export async function initializeServices(): Promise<void> {
  logger.info('bootstrap', 'Initializing services...');

  try {
    // Initialize database provider FIRST — entity files depend on getDatabaseProvider()
    // This must run before auth and any other service that may trigger entity queries
    await initializeDatabaseProvider();

    // Initialize auth provider (Supabase by default)
    await initializeAuthProvider();

    // Initialize performance baseline service (loads baselines from SecureStorage)
    await performanceBaselineService.initialize();

    // Initialize error tracker (Sentry by default)
    await initializeErrorTracker();

    // Register Sentry analytics exporter
    await initializeSentryExporter();

    logger.info('bootstrap', 'All services initialized successfully');
  } catch (error) {
    logger.error('bootstrap', `Failed to initialize services: ${error}`);
    throw error;
  }
}

/**
 * Initialize and register the database provider
 * Selected from config (services.database.provider), defaults to 'supabase'.
 * Gated by config (services.database.enabled), defaults to true.
 *
 * Switch-board function: reads config and delegates to the provider-specific initializer.
 * Adding a new database backend = add a new case + a new *-initializer file.
 * Mirrors the Sentry/error-tracker pattern in initializeErrorTracker().
 *
 * Config-driven design: the provider and enabled flag can be set per environment
 * (appsettings.json / appsettings.dev.json). For remote control during a live migration
 * (e.g., gradually routing reads to a new provider), pair this with a remote config fetch
 * early in kernel bootstrap — see lib/config/README.md for the recommended pattern.
 * Default is enabled=true since the database is load-bearing for most app functionality.
 */
async function initializeDatabaseProvider(): Promise<void> {
  try {
    const config = getAppConfig();
    const databaseService = config.services?.database;

    // GATE: respect enabled flag — default true (database is load-bearing)
    const enabled = databaseService?.enabled ?? true;
    if (!enabled) {
      logger.info(
        'bootstrap',
        '[Database] Disabled in config (services.database.enabled=false) — registering NoOpDatabaseProvider. ' +
          'Database queries will throw until re-enabled and the app restarted.'
      );
      const { NoOpDatabaseProvider, registerDatabaseProvider } = await import('./database-adapter');
      registerDatabaseProvider(new NoOpDatabaseProvider());
      updateServiceStatus('database', 'disabled', 'none', 'Disabled via config');
      return;
    }

    const providerName = databaseService?.provider || 'supabase';
    logger.debug('bootstrap', `Initializing database provider: ${providerName}`);

    switch (providerName.toLowerCase()) {
      case 'supabase': {
        // Validate configuration before attempting initialization
        const validation = validateSupabaseDatabaseConfig();
        if (!validation.valid) {
          logValidationResult('Database', validation, true);
          updateServiceStatus('database', 'failed', 'supabase', validation.errors[0]);
          const { NoOpDatabaseProvider, registerDatabaseProvider } = await import('./database-adapter');
          registerDatabaseProvider(new NoOpDatabaseProvider());
          return;
        }

        // Delegate to Supabase-specific init (env vars, client, provider registration)
        // Isolated in lib/services/supabase/supabase-initializer.ts — same pattern as Sentry
        const { initializeSupabaseDatabaseProvider } = await import('./supabase/supabase-initializer');
        const initialized = await initializeSupabaseDatabaseProvider();
        if (initialized) {
          logger.info('bootstrap', '[Database] Supabase provider initialized successfully');
          updateServiceStatus('database', 'ready', 'supabase');
        } else {
          logger.warn('bootstrap', '[Database] Supabase not configured — using NoOpDatabaseProvider');
          updateServiceStatus('database', 'degraded', 'supabase', 'Environment vars present but init incomplete');
        }
        break;
      }

      default: {
        logger.warn('bootstrap', `[Database] Unknown provider: ${providerName}. Registering NoOp fallback.`);
        const { NoOpDatabaseProvider, registerDatabaseProvider } = await import('./database-adapter');
        registerDatabaseProvider(new NoOpDatabaseProvider());
        updateServiceStatus('database', 'failed', providerName, `Unknown provider: ${providerName}`);
        break;
      }
    }
  } catch (error) {
    logger.error('bootstrap', `[Database] Runtime failure during initialization: ${error}`);
    // Always leave a registered provider so the app can start in degraded mode
    // rather than crashing with "getDatabaseProvider called before registration"
    try {
      const { NoOpDatabaseProvider, registerDatabaseProvider } = await import('./database-adapter');
      registerDatabaseProvider(new NoOpDatabaseProvider());
      updateServiceStatus('database', 'failed', 'noop', `Runtime error: ${error}`);
    } catch { /* ignore secondary failure */ }
    // Don't re-throw — database failure shouldn't prevent auth/analytics from starting
  }
}

/**
 * Initialize and register the auth provider
 * Selected from config (services.auth.provider), defaults to 'supabase'
 * This makes the provider available to AuthStateManager and the entire app
 * Can be swapped with different providers during testing or via configuration
 */
async function initializeAuthProvider(): Promise<void> {
  try {
    // Read provider selection from config
    const config = getAppConfig();
    const authService = config.services?.auth;
    const providerName = authService?.provider || 'supabase';
    logger.debug('bootstrap', `Initializing auth provider: ${providerName}`);

    // Create provider instance based on config
    let provider: AuthProvider | null = null;

    switch (providerName.toLowerCase()) {
      case 'supabase': {
        try {
          // Validate configuration before attempting initialization
          const validation = validateSupabaseAuthConfig();
          if (!validation.valid) {
            logValidationResult('Auth', validation, true);
            updateServiceStatus('auth', 'failed', 'supabase', validation.errors[0]);
            logger.warn('bootstrap', 'Supabase not configured; auth provider will not be set');
            return;
          }

          const { getSupabaseClient, isSupabaseConfigured } = await import('./supabase/supabase-client');
          if (isSupabaseConfigured()) {
            const supabaseClient = getSupabaseClient();
            const supabaseProvider = new SupabaseAuthProvider(supabaseClient);
            logger.debug('bootstrap', 'Supabase auth provider instantiated');
            provider = supabaseProvider;
          } else {
            // Supabase not configured (no env vars) — skip provider registration
            // AppKernel will detect missing provider via getAuthProviderSync() and skip auth wiring
            logger.warn('bootstrap', 'Supabase not configured; auth provider will not be set');
            updateServiceStatus('auth', 'failed', 'supabase', 'Not configured');
            return;
          }
        } catch (error) {
          logger.error('bootstrap', `Failed to load Supabase for auth provider: ${error}`);
          updateServiceStatus('auth', 'failed', 'supabase', `Runtime error: ${error}`);
          throw error;
        }
        break;
      }

      default: {
        logger.warn('bootstrap', `Unknown auth provider: ${providerName}. Defaulting to supabase.`);
        // Fall through to supabase as fallback
        try {
          const validation = validateSupabaseAuthConfig();
          if (!validation.valid) {
            logValidationResult('Auth', validation, false);
            updateServiceStatus('auth', 'degraded', 'supabase', 'Fallback also misconfigured');
            return;
          }

          const { getSupabaseClient, isSupabaseConfigured } = await import('./supabase/supabase-client');
          if (isSupabaseConfigured()) {
            const supabaseClient = getSupabaseClient();
            const supabaseProvider = new SupabaseAuthProvider(supabaseClient);
            logger.debug('bootstrap', 'Supabase auth provider instantiated (fallback)');
            provider = supabaseProvider;
          } else {
            // Supabase not configured (no env vars) — skip provider registration
            // AppKernel will detect missing provider via getAuthProviderSync() and skip auth wiring
            logger.warn('bootstrap', 'Fallback Supabase not configured; auth provider will not be set');
            updateServiceStatus('auth', 'failed', 'supabase', 'Fallback not configured');
            return;
          }
        } catch (error) {
          logger.error('bootstrap', `Failed to initialize fallback Supabase provider: ${error}`);
          updateServiceStatus('auth', 'failed', 'supabase', `Fallback runtime error: ${error}`);
          throw error;
        }
        break;
      }
    }

    if (!provider) {
      logger.error('bootstrap', 'Auth provider instantiation failed');
      updateServiceStatus('auth', 'failed', providerName, 'Provider instantiation failed');
      throw new Error('Auth provider failed to instantiate');
    }

    // Wrap with validation layer for defense-in-depth
    const validatedProvider = createValidatedAuthProvider(provider);

    // Register globally so AuthStateManager and other code can access it
    await registerAuthProvider(validatedProvider);
    logger.info('bootstrap', `Auth provider '${providerName}' registered successfully`);
    updateServiceStatus('auth', 'ready', providerName);
  } catch (error) {
    logger.error('bootstrap', `Failed to initialize auth provider: ${error}`);
    // Auth is critical, record failure and re-throw
    updateServiceStatus('auth', 'failed', 'unknown', `${error}`);
    throw error; // Auth is critical, don't continue if provider fails
  }
}

/**
 * Initialize and register the error tracker
 * Single-source-of-truth: SDK initializes if EITHER errorProvider OR analytics is enabled.
 * This allows independent toggle of error tracking and analytics without SDK redundancy.
 *
 * Two-layer gating:
 * 1. SDK Initialization: config.services.errorProvider.enabled OR config.services.analytics.enabled
 *    SDK is never imported/initialized if both are false (zero overhead, full abstraction from Sentry).
 * 2. User Identification: Even if SDK initialized, setUser() is gated by consent level.
 *    If consent === 'none', SDK operates silently (breadcrumbs/events queued) but no PII sent.
 *
 * Delegates to lib/services/sentry/sentry-service-initializer.ts if SDK should init.
 * Falls back to NoOpErrorTracker if no service needs it or on error.
 *
 * Supported providers: 'sentry' (default)
 * Future: 'datadog', 'rollbar', custom implementations
 */
async function initializeErrorTracker(): Promise<void> {
  try {
    const config = getAppConfig();
    const errorService = config.services?.errorProvider;
    const analyticsService = config.services?.analytics;

    // SWITCH #1: SDK on/off — enables if either error tracking or analytics needs it
    const errorProviderEnabled = errorService?.enabled ?? false;
    const analyticsEnabled = analyticsService?.enabled ?? false;
    const sdkNeeded = errorProviderEnabled || analyticsEnabled;

    if (!sdkNeeded) {
      logger.info(
        'bootstrap',
        `[Error Tracker] Both errorProvider and analytics disabled — using NoOpErrorTracker`
      );
      registerErrorTracker(new NoOpErrorTracker());
      updateServiceStatus('errorTracker', 'disabled', 'none', 'Disabled via config');
      return;
    }

    const providerName = errorService?.provider ?? 'sentry';

    logger.debug('bootstrap', `Initializing error tracker provider: ${providerName}`);

    // Switch on provider name to select implementation
    switch (providerName.toLowerCase()) {
      case 'sentry': {
        // Validate configuration before attempting initialization
        const validation = validateSentryErrorConfig();
        if (!validation.valid) {
          logValidationResult('Error Tracker', validation, false);
          logger.info('bootstrap', '[Error Tracker] Sentry misconfigured — using NoOpErrorTracker');
          registerErrorTracker(new NoOpErrorTracker());
          updateServiceStatus('errorTracker', 'degraded', 'sentry', validation.errors[0]);
          break;
        }

        // Delegate to Sentry-specific init (SDK + tracker registration)
        // This isolates all Sentry concerns to lib/services/sentry/
        const initialized = await initializeSentryErrorTracker();
        if (initialized) {
          logger.info('bootstrap', `[Error Tracker] Sentry provider initialized successfully`);
          updateServiceStatus('errorTracker', 'ready', 'sentry');
        } else {
          logger.info('bootstrap', `[Error Tracker] Sentry provider skipped (no DSN) — using NoOpErrorTracker`);
          registerErrorTracker(new NoOpErrorTracker());
          updateServiceStatus('errorTracker', 'degraded', 'sentry', 'DSN not configured');
        }
        break;
      }

      default: {
        logger.warn(
          'bootstrap',
          `[Error Tracker] Unknown provider: ${providerName}. Defaulting to NoOp.`
        );
        registerErrorTracker(new NoOpErrorTracker());
        updateServiceStatus('errorTracker', 'failed', providerName, `Unknown provider: ${providerName}`);
        break;
      }
    }
  } catch (error) {
    logger.warn(
      'bootstrap',
      `[Error Tracker] Runtime failure: ${error}. Falling back to NoOp.`
    );
    // Ensure we always have a tracker registered, even on error
    registerErrorTracker(new NoOpErrorTracker());
    updateServiceStatus('errorTracker', 'failed', 'unknown', `Runtime error: ${error}`);
  }
}

/**
 * Initialize and register analytics exporter
 * Reads provider selection from config.services.analytics
 * Delegates to the selected provider's exporter (e.g., SentryExporter)
 * If disabled, skips registration
 *
 * Supported providers: 'sentry' (default)
 * Future: 'datadog', 'segment', custom implementations
 */
async function initializeSentryExporter(): Promise<void> {
  try {
    const config = getAppConfig();
    const analyticsService = config.services?.analytics;
    const enabled = analyticsService?.enabled ?? true;
    const providerName = analyticsService?.provider ?? 'sentry';

    if (!enabled) {
      logger.info(
        'bootstrap',
        `[Analytics Exporter] Disabled in config (provider: ${providerName}), skipping registration`
      );
      updateServiceStatus('analytics', 'disabled', 'none', 'Disabled via config');
      return;
    }

    logger.debug('bootstrap', `Initializing analytics exporter provider: ${providerName}`);

    // Switch on provider name to select implementation
    switch (providerName.toLowerCase()) {
      case 'sentry': {
        // Validate configuration before attempting initialization
        const validation = validateSentryAnalyticsConfig();
        if (!validation.valid) {
          logValidationResult('Analytics', validation, false);
          logger.info('bootstrap', '[Analytics Exporter] Sentry misconfigured — skipping');
          updateServiceStatus('analytics', 'degraded', 'sentry', validation.errors[0]);
          break;
        }

        // Lazy-load SentryExporter to avoid require cycle
        // (sentry-analytics-exporter imports from lib/analytics, which imports services)
        const { SentryExporter } = await import('./sentry/sentry-analytics-exporter');
        const sentryExporter: AnalyticsExporter = new SentryExporter();

        // Initialize exporter if it has an initialize lifecycle hook
        if (sentryExporter.initialize) {
          await sentryExporter.initialize();
        }

        // Register to global registry
        exporterRegistry.register(sentryExporter);
        logger.info('bootstrap', `[Analytics Exporter] Sentry exporter initialized and registered`);
        updateServiceStatus('analytics', 'ready', 'sentry');
        break;
      }

      default: {
        logger.warn(
          'bootstrap',
          `[Analytics Exporter] Unknown provider: ${providerName}. Skipping registration.`
        );
        updateServiceStatus('analytics', 'failed', providerName, `Unknown provider: ${providerName}`);
        break;
      }
    }
  } catch (error) {
    logger.warn(
      'bootstrap',
      `[Analytics Exporter] Runtime failure: ${error}. Continuing without it.`
    );
    updateServiceStatus('analytics', 'failed', 'unknown', `Runtime error: ${error}`);
    // Don't throw - if analytics exporter fails, other services should still work
  }
}

/**
 * Export registry for direct use if needed
 */
export { exporterRegistry } from '@/lib/analytics/exporters/exporter-registry';
export type { AnalyticsEvent, AnalyticsExporter, ExportContext } from '@/lib/analytics/exporters/exporter-registry';

