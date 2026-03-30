/**
 * Sign-Out System
 *
 * Centralized orchestration of complete user logout with ordered cleanup.
 *
 * Flow:
 * 1. Data Sync + Queue Drain (BEFORE confirmation): Ensure pending changes are uploaded. Returns to auth-manager.
 * 2. User Confirmation: Auth-manager shows modal. User confirms/cancels.
 * 3. If confirmed → Phase 2-4:
 *    - All cleanup delegated to sign-out job (lib/jobs/core/sign-out-job.ts)
 *
 * Usage:
 *   // Phase 1: Check if pending changes can sync
 *   const syncResult = await performSignOutPhase1_DBSync('user-initiated');
 *   if (!syncResult.success) {
 *     // Show error to user: "Failed to sync data. Continue anyway?"
 *   }
 *
 *   // User clicks "OK" in confirmation modal
 *
 *   // Phase 2-4: Clear storage and sign out (delegated to sign-out job)
 *   const result = await performSignOutPhase2_ClearAndSignOut('user-initiated');
 *   if (result.success) {
 *     // Navigate to login
 *   }
 */

import { JobsManager } from '@/lib/jobs';
import type {
  SignOutError,
  SignOutPhase2Result,
  SignOutSource,
} from '@/lib/jobs/core/sign-out-job';
import { logger } from '@/lib/utils/logger';

// ============================================================================
// TYPES — LOCAL TO THIS SYSTEM
// ============================================================================

// SignOutSource, SignOutError, and SignOutPhase2Result are imported from sign-out-job.ts

/**
 * Phase 1 error (DB sync only).
 */
export interface SignOutPhase1Error {
  phase: 'db-sync';
  message: string;
  error?: Error;
}

/**
 * Result of Phase 1: DB Sync (before confirmation).
 * Returned to auth-manager for user confirmation.
 */
export interface SignOutPhase1Result {
  success: boolean;
  syncQueueSize: number;
  errors: SignOutPhase1Error[];
}

// Re-export job types for convenience (backwards compatibility)
export type { SignOutError, SignOutPhase2Result, SignOutSource };

// ============================================================================
// SIGN-OUT PHASE 1: Sync before confirmation
// ============================================================================

/**
 * PHASE 1: Attempt to upload pending changes BEFORE showing confirmation modal.
 *
 * Returns to auth-manager for user confirmation.
 * If sync fails, user is asked: "Continue sign-out anyway?"
 */
export async function performSignOutPhase1_DBSync(source: SignOutSource): Promise<SignOutPhase1Result> {
  const result: SignOutPhase1Result = {
    success: true,
    syncQueueSize: 0,
    errors: [],
  };

  logger.category('security').info(`[${source}] Sign-out Phase 1: Syncing before confirmation`);

  try {
    const syncResult = await JobsManager.performSync({ mode: 'automatic', direction: 'upload' });
    result.syncQueueSize = syncResult.queue?.totalQueued ?? 0;
    // If operation completes without throwing, it succeeded
    result.success = true;
  } catch (error) {
    result.success = false;
    result.errors.push({
      phase: 'db-sync',
      message: error instanceof Error ? error.message : 'Data sync failed',
      error: error instanceof Error ? error : undefined,
    });
  }

  return result;
}

// ============================================================================
// SIGN-OUT PHASE 2-4: Clear storage and sign out (after confirmation)
// ============================================================================

/**
 * PHASE 2-4: Clear storage and sign out from provider (AFTER confirmation).
 *
 * Called after user confirms sign-out in modal.
 * Delegates to sign-out job for complete cleanup orchestration.
 */
export async function performSignOutPhase2_ClearAndSignOut(source: SignOutSource): Promise<SignOutPhase2Result> {
  const { performSignOutPhase2_ClearAndSignOut: performSignOut } = await import(
    '@/lib/jobs/core/sign-out-job'
  );
  return performSignOut(source);
}
