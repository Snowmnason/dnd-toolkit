/**
 * Analytics Utilities
 * Shared helper functions for analytics modules
 */

import { getAppConfig } from '../config/loader';

/**
 * Get performance threshold from config with fallback
 */
export const getThreshold = (key: 'slowScreenMs' | 'slowRequestMs'): number => {
  try {
    // eslint-disable-next-line security/detect-object-injection
    return getAppConfig().thresholds?.[key] ?? 3000;
  } catch {
    return 3000;
  }
};

/**
 * Sanitize error object for analytics
 * Removes sensitive fields, keeping only structured error identifiers
 */
export const sanitizeError = (err: any): { error_name?: string; error_code?: string | number } | undefined => {
  if (!err) return undefined;
  const error_name = typeof err.name === 'string' ? err.name : undefined;
  const error_code = typeof err.code === 'string' || typeof err.code === 'number' ? err.code : undefined;
  return error_name || error_code ? { error_name, error_code } : undefined;
};
