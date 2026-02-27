/**
 * Entitlements Reminders Job
 *
 * Background job handler for sending reminders about expiring entitlements.
 * This is a placeholder for the full notification system (deferred).
 *
 * Future implementation will:
 * - Find entitlements expiring within a configured window (e.g., 7 days)
 * - Check per-user and per-entitlement reminder preferences
 * - Enqueue/send reminders (in-app, push, email)
 * - Track reminder delivery and user actions (renewal, dismiss, etc.)
 */

import { getAppConfig } from '../../../config';
import { logger } from '../../utils/logger';

export interface EntitlementsRemindersPayload {
  daysBeforeExpiry?: number; // Window to look ahead (default: from app config)
  dryRun?: boolean; // If true, log what would be notified but don't send
}

/**
 * Job handler: sends reminders about expiring entitlements
 *
 * Deferred implementation — currently a no-op stub.
 * Acceptance criteria:
 * - Query entitlements expiring in N days
 * - Filter by user remind_user preference and per-entitlement reminder flags
 * - Enqueue in-app notifications
 * - Log to audit.events if audit is enabled
 * - Track analytics events (entitlement_expiry_warning_shown, etc.)
 */
export async function handleEntitlementsReminders(
  payload: EntitlementsRemindersPayload = {},
  ctx?: { retryCount: number },
) {
  const appConfig = getAppConfig();
  const entitlementsConfig = appConfig.entitlements || {};

  const daysBeforeExpiry = payload.daysBeforeExpiry ?? entitlementsConfig.reminderWindowDays ?? 7;
  const dryRun = payload.dryRun ?? entitlementsConfig.dryRunMode ?? false;
  const retryAttempt = ctx?.retryCount ?? 0;

  logger.category('jobs').info(
    `Starting entitlements reminder check (attempt ${retryAttempt + 1}, dryRun=${dryRun}, window=${daysBeforeExpiry} days)`,
  );

  // STUB: Deferred implementation
  logger.category('jobs').warn(
    'Entitlements reminder job is not yet implemented (placeholder stage)',
  );

  return {
    reminded: 0,
    dryRun,
    status: 'deferred',
  };
}
