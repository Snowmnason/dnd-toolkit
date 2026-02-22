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
 */

import { AnalyticsExporter, exporterRegistry } from '@/lib/analytics/exporters';
import { performanceBaselineService } from '@/lib/analytics/performance/performance-baseline';
import { getAppConfig } from '@/lib/config/loader';
import { logger } from '@/lib/utils/logger';
import { createValidatedAuthProvider, registerAuthProvider, type AuthProvider } from './auth-provider';
import { SentryExporter } from './sentry/sentry-analytics-exporter';
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
    // Initialize auth provider (Supabase by default)
    await initializeAuthProvider();

    // Initialize performance baseline service (loads baselines from SecureStorage)
    await performanceBaselineService.initialize();

    // Register Sentry analytics exporter
    await initializeSentryExporter();

    logger.info('bootstrap', 'All services initialized successfully');
  } catch (error) {
    logger.error('bootstrap', `Failed to initialize services: ${error}`);
    throw error;
  }
}

/**
 * Initialize and register the auth provider
 * Selected from config (auth.provider), defaults to 'supabase'
 * This makes the provider available to AuthStateManager and the entire app
 * Can be swapped with different providers during testing or via configuration
 */
async function initializeAuthProvider(): Promise<void> {
  try {
    // Read provider selection from config
    const config = getAppConfig();
    const providerName = config.auth?.provider || 'supabase';
    logger.debug('bootstrap', `Initializing auth provider: ${providerName}`);

    // Create provider instance based on config
    let provider: AuthProvider | null = null;

    switch (providerName.toLowerCase()) {
      case 'supabase': {
        try {
          const { getSupabaseClient, isSupabaseConfigured } = await import('@/lib/database/supabase');
          if (isSupabaseConfigured()) {
            const supabaseClient = getSupabaseClient();
            const supabaseProvider = new SupabaseAuthProvider(supabaseClient);
            logger.debug('bootstrap', 'Supabase auth provider instantiated');
            provider = supabaseProvider;
          } else {
            // Supabase not configured (no env vars) — skip provider registration
            // AppKernel will detect missing provider via getAuthProviderSync() and skip auth wiring
            logger.warn('bootstrap', 'Supabase not configured; auth provider will not be set');
            return;
          }
        } catch (error) {
          logger.error('bootstrap', `Failed to load Supabase for auth provider: ${error}`);
          throw error;
        }
        break;
      }

      default: {
        logger.warn('bootstrap', `Unknown auth provider: ${providerName}. Defaulting to supabase.`);
        // Fall through to supabase as fallback
        try {
          const { getSupabaseClient, isSupabaseConfigured } = await import('@/lib/database/supabase');
          if (isSupabaseConfigured()) {
            const supabaseClient = getSupabaseClient();
            const supabaseProvider = new SupabaseAuthProvider(supabaseClient);
            logger.debug('bootstrap', 'Supabase auth provider instantiated (fallback)');
            provider = supabaseProvider;
          } else {
            // Supabase not configured (no env vars) — skip provider registration
            // AppKernel will detect missing provider via getAuthProviderSync() and skip auth wiring
            logger.warn('bootstrap', 'Fallback Supabase not configured; auth provider will not be set');
            return;
          }
        } catch (error) {
          logger.error('bootstrap', `Failed to initialize fallback Supabase provider: ${error}`);
          throw error;
        }
        break;
      }
    }

    if (!provider) {
      logger.error('bootstrap', 'Auth provider instantiation failed');
      throw new Error('Auth provider failed to instantiate');
    }

    // Wrap with validation layer for defense-in-depth
    const validatedProvider = createValidatedAuthProvider(provider);

    // Register globally so AuthStateManager and other code can access it
    await registerAuthProvider(validatedProvider);
    logger.info('bootstrap', `Auth provider '${providerName}' registered successfully`);
  } catch (error) {
    logger.error('bootstrap', `Failed to initialize auth provider: ${error}`);
    throw error; // Auth is critical, don't continue if provider fails
  }
}

/**
 * Initialize and register Sentry analytics exporter
 * Only registers if Sentry is enabled and configured
 */
async function initializeSentryExporter(): Promise<void> {
  try {
    const sentryExporter: AnalyticsExporter = new SentryExporter();

    // Check if enabled via config before registering
    // Note: isEnabled is optional on AnalyticsExporter interface.
    // Only skip registration if isEnabled explicitly returns false.
    // If isEnabled is undefined (method doesn't exist), default to enabled.
    if (sentryExporter.isEnabled?.() !== false) {
      // Initialize exporter if it has an initialize lifecycle hook
      if (sentryExporter.initialize) {
        await sentryExporter.initialize();
      }

      // Register to global registry
      exporterRegistry.register(sentryExporter);
      logger.debug('bootstrap', 'Sentry exporter initialized and registered');
    } else {
      logger.debug('bootstrap', 'Sentry exporter is disabled in config, skipping registration');
    }
  } catch (error) {
    logger.warn(
      'bootstrap',
      `Failed to initialize Sentry exporter: ${error}. Continuing without it.`
    );
    // Don't throw - if Sentry exporter fails, other services should still work
  }
}

/**
 * Export registry for direct use if needed
 */
export { exporterRegistry } from '@/lib/analytics/exporters/exporter-registry';
export type { AnalyticsEvent, AnalyticsExporter, ExportContext } from '@/lib/analytics/exporters/exporter-registry';

