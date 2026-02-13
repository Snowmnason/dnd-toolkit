/**
 * Entitlements Cleanup Job
 *
 * Background job handler for marking expired entitlements as inactive.
 * Implements a grace period before deactivation (configured via appsettings.*.json).
 *
 * Configuration is read from app config at runtime.
 * This is a foundation-level implementation; reminder notifications are deferred.
 */

import { getAppConfig } from '../config';
import {
  deactivateEntitlements,
  fetchExpiredEntitlements,
} from '../database/entitlements';
import { supabase } from '../database/supabase';
import { logger } from '../utils/logger';

export interface EntitlementsCleanupPayload {
  gracePeriodDays?: number; // Days to wait after expiry before marking inactive (default: from app config)
  dryRun?: boolean; // If true, log what would be updated but don't commit
}

/**
 * Job handler: marks expired entitlements as inactive after grace period
 */
export async function handleEntitlementsCleanup(
  payload: EntitlementsCleanupPayload = {},
  ctx?: { retryCount: number },
) {
  const appConfig = getAppConfig();
  const entitlementsConfig = appConfig.entitlements || {};

  const gracePeriodDays = payload.gracePeriodDays ?? entitlementsConfig.gracePeriodDays ?? 7;
  const dryRun = payload.dryRun ?? entitlementsConfig.dryRunMode ?? false;
  const retryAttempt = ctx?.retryCount ?? 0;

  logger.category('jobs').info(
    `Starting entitlements cleanup (attempt ${retryAttempt + 1}, dryRun=${dryRun}, grace=${gracePeriodDays} days)`,
  );

  try {
    // Fetch expired entitlements past grace period using DB helper
    const cleanupList = await fetchExpiredEntitlements(supabase, gracePeriodDays);

    logger.category('jobs').info(
      `Found ${cleanupList.length} expired entitlements to deactivate`,
    );

    if (cleanupList.length === 0) {
      logger.category('jobs').info('No expired entitlements to process');
      return {
        cleaned: 0,
        dryRun,
      };
    }

    if (dryRun) {
      logger.category('jobs').info('DRY RUN: Would deactivate entitlements:', {
        count: cleanupList.length,
        ids: cleanupList.map((e) => e.id),
      });
      return {
        cleaned: cleanupList.length,
        dryRun: true,
      };
    }

    // Batch deactivate all expired entitlements using DB helper
    const expiredIds = cleanupList.map((e) => e.id);
    const cleaned = await deactivateEntitlements(supabase, expiredIds);

    logger.category('jobs').info(
      `Successfully marked ${cleaned} entitlements as inactive`,
    );

    return {
      cleaned,
      dryRun: false,
    };
  } catch (error) {
    logger.category('jobs').error(
      'Entitlements cleanup job failed:',
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}
