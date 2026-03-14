/**
 * Delete Account System
 *
 * Centralizes account deletion orchestration with two-phase confirmation.
 *
 * Flow:
 * 1. PHASE 1 (Before Confirmation): Server verification
 *    - User clicks "Delete Account" button (greyed out)
 *    - performDeletePhase1_VerifyDeletion() makes server call
 *    - If server says "OK to delete" → show password modal
 *
 * 2. Password Verification (in modal):
 *    - Auth-manager validates password strength
 *    - If weak → return error (probably wrong password)
 *    - If strong → call verifyCredentials() to auth provider
 *    - If auth fails → show error, user stays logged in
 *    - If auth passes → proceed to Phase 2
 *
 * 3. PHASE 2 (After Confirmation): Actual deletion
 *    - Call DELETE API to remove account
 *    - If deletion fails → show error, user stays logged in
 *    - If deletion succeeds → call performSignOutPhase2_ClearAndSignOut()
 *      to clean storage and sign out
 *
 * Key: On any failure, user remains authenticated and can retry or cancel.
 *
 * Usage:
 *   // Phase 1: Verify deletion is allowed
 *   const verifyResult = await performDeletePhase1_VerifyDeletion();
 *   if (verifyResult.success) {
 *     // Show password modal
 *   } else {
 *     // Show error: "Account cannot be deleted at this time"
 *   }
 *
 *   // User enters password, auth-manager validates + verifies credentials
 *
 *   // Phase 2: Call after password confirmed
 *   const deleteResult = await performDeletePhase2_DeleteAndSignOut(password);
 *   if (deleteResult.success) {
 *     // Navigate to login
 *   } else {
 *     // Show error, user stays logged in
 *   }
 */

import { usersDB } from '@/lib/database';
import { logger } from '@/lib/utils/logger';
import { performSignOutPhase2_ClearAndSignOut } from './sign-out-system';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Source of delete account trigger.
 */
export type DeleteAccountSource = 'user-initiated';

/**
 * Error during delete account operation.
 */
export interface DeleteAccountError {
  phase: 'verification' | 'password-validation' | 'auth' | 'deletion' | 'cleanup';
  message: string;
  error?: Error;
}

/**
 * Result of Phase 1: Server verification (before confirmation).
 * Returned to auth-manager for password modal.
 */
export interface DeletePhase1Result {
  success: boolean;
  message?: string;
  errors: DeleteAccountError[];
}

/**
 * Result of Phase 2: Actual deletion and sign-out (after confirmation).
 */
export interface DeletePhase2Result {
  success: boolean;
  redirect?: string; // Where to navigate after deletion
  errors: DeleteAccountError[];
}

// ============================================================================
// DELETE ACCOUNT SYSTEM SINGLETON
// ============================================================================

/**
 * Manages account deletion orchestration.
 */
class DeleteAccountSystemImpl {
  /**
   * PHASE 2: Delete account and sign out (AFTER confirmation)
   *
   * Called after password has been verified by auth-manager.
   * Makes DELETE API call to remove account.
   * On success, clears storage and signs out via performSignOutPhase2_ClearAndSignOut.
   *
   * On failure: user stays logged in (can retry or sign out manually).
   *
   * @param password - User's password (pre-verified by auth-manager)
   * @param source - The source of the delete trigger
   * @returns Result with success status, redirect, and any errors
   */
  async performDeletePhase2_DeleteAndSignOut(
    password: string,
    source: DeleteAccountSource = 'user-initiated'
  ): Promise<DeletePhase2Result> {
    const result: DeletePhase2Result = {
      success: true,
      errors: [],
    };

    logger.category('security').info(`[${source}] Delete Account Phase 2: Deletion started`);

    try {
      // =====================================================================
      // PHASE 2: CALL DELETE API (guards + credential verify ran in auth-manager)
      // =====================================================================
      logger.category('security').debug('Delete Account Phase 2: Calling DELETE API');

      const deleteResult = await usersDB.deleteCurrentUser();

      if (!deleteResult) {
        throw new Error('Account deletion failed. Please try again later.');
      }

      logger.category('security').info(`[${source}] Phase 2b: Account deleted successfully`);

      // =====================================================================
      // PHASE 2c: CLEAR STORAGE AND SIGN OUT
      // =====================================================================
      // Now that deletion succeeded, clean up and sign out
      logger.category('security').debug('Delete Account Phase 2: Clearing storage and signing out');

      const signOutResult = await performSignOutPhase2_ClearAndSignOut('user-initiated');

      if (!signOutResult.success && signOutResult.errors?.length) {
        // Collect sign-out errors but don't fail overall
        for (const err of signOutResult.errors) {
          result.errors.push({
            phase: 'cleanup',
            message: err.message,
            error: err.error,
          });
        }
        logger.category('security').warn(
          `[${source}] Phase 2c: Sign-out had ${signOutResult.errors.length} error(s)`
        );
      }

      result.redirect = signOutResult.redirect || '/login';

      logger.category('security').info(`[${source}] Delete Account Phase 2: Deletion and sign-out complete`);

      return result;
    } catch (error) {
      result.success = false;
      result.errors.push({
        phase: 'deletion',
        message: error instanceof Error ? error.message : 'Deletion failed. Please try again.',
        error: error instanceof Error ? error : undefined,
      });

      logger.category('security').warn(`[${source}] Phase 2: Deletion failed`, error);
      logger.category('security').info(`[${source}] User remains logged in after deletion error`);

      return result;
    }
  }
}

// ============================================================================
// SINGLETON EXPORT & PUBLIC API
// ============================================================================

const deleteAccountSystem = new DeleteAccountSystemImpl();

/**
 * PHASE 2: Delete account and sign out (AFTER confirmation).
 *
 * Called after password has been verified by auth-manager.
 * Makes DELETE API call to remove account and clears storage.
 *
 * On failure: user stays logged in (can retry or sign out manually).
 *
 * @param password - User's password (pre-verified by auth-manager)
 * @param source - The source of the delete trigger (default: 'user-initiated')
 * @returns Promise<DeletePhase2Result>
 */
export async function performDeletePhase2_DeleteAndSignOut(
  password: string,
  source: DeleteAccountSource = 'user-initiated'
): Promise<DeletePhase2Result> {
  return deleteAccountSystem.performDeletePhase2_DeleteAndSignOut(password, source);
}
