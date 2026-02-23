/**
 * Service Configuration Validation
 *
 * Validates that required configuration and environment variables are present
 * before attempting to initialize each service.
 *
 * This catches misconfiguration errors early with clear messages,
 * distinguishing them from runtime failures.
 */

import { logger } from '@/lib/utils/logger';

export interface ValidationResult {
  valid: boolean;
  missingFields: string[];
  errors: string[];
}

/**
 * Validate Supabase database provider configuration
 * Checks for required environment variables
 */
export function validateSupabaseDatabaseConfig(): ValidationResult {
  const missing: string[] = [];
  const errors: string[] = [];

  if (!process.env.EXPO_PUBLIC_SUPABASE_URL) {
    missing.push('EXPO_PUBLIC_SUPABASE_URL');
  }
  if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  }

  if (missing.length > 0) {
    errors.push(
      `Missing Supabase database credentials: ${missing.join(', ')}. ` +
        'Set these in your environment or app.json extras.'
    );
  }

  return {
    valid: missing.length === 0,
    missingFields: missing,
    errors,
  };
}

/**
 * Validate Supabase authentication provider configuration
 * Checks for required environment variables
 */
export function validateSupabaseAuthConfig(): ValidationResult {
  const missing: string[] = [];
  const errors: string[] = [];

  if (!process.env.EXPO_PUBLIC_SUPABASE_URL) {
    missing.push('EXPO_PUBLIC_SUPABASE_URL');
  }
  if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  }

  if (missing.length > 0) {
    errors.push(
      `Missing Supabase auth credentials: ${missing.join(', ')}. ` +
        'Set these in your environment or app.json extras.'
    );
  }

  return {
    valid: missing.length === 0,
    missingFields: missing,
    errors,
  };
}

/**
 * Validate Sentry error tracker configuration
 * Checks for required environment variables
 */
export function validateSentryErrorConfig(): ValidationResult {
  const missing: string[] = [];
  const errors: string[] = [];

  if (!process.env.EXPO_PUBLIC_SENTRY_DSN) {
    missing.push('EXPO_PUBLIC_SENTRY_DSN');
  }

  if (missing.length > 0) {
    errors.push(
      `Missing Sentry error tracking credentials: ${missing.join(', ')}. ` +
        'Set EXPO_PUBLIC_SENTRY_DSN in your environment or app.json extras.'
    );
  }

  return {
    valid: missing.length === 0,
    missingFields: missing,
    errors,
  };
}

/**
 * Validate Sentry analytics configuration
 * Same requirements as error tracking (same SDK)
 */
export function validateSentryAnalyticsConfig(): ValidationResult {
  return validateSentryErrorConfig();
}

/**
 * Log validation result with appropriate level
 * - If valid: debug
 * - If missing but optional: warn
 * - If missing and required: error
 */
export function logValidationResult(
  service: string,
  result: ValidationResult,
  isRequired: boolean = true
): void {
  if (result.valid) {
    logger.debug('bootstrap', `[${service}] Configuration valid`);
    return;
  }

  const level = isRequired ? 'error' : 'warn';
  const message = result.errors.join(' ');
  const context = isRequired
    ? 'Service will not initialize'
    : 'Service will degrade gracefully';

  logger[level]('bootstrap', `[${service}] Misconfiguration: ${message} ${context}`);
}
