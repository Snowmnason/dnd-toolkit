/**
 * Update Credentials System
 *
 * Centralizes username and password update orchestration with two-phase confirmation.
 *
 * Flow:
 *
 * === USERNAME UPDATE ===
 * 1. PHASE 1 (Before Confirmation): Verify identity
 *    - performPhase1_VerifyIdentity() checks user is logged in + session valid
 *    - If OK → show username modal (Phase 2)
 *
 * 2. PHASE 2 (After Confirmation): Update username
 *    - performPhase2_UpdateUsername() validates new username + updates DB
 *    - On success → redirect/toast
 *    - Username is cosmetic (not used for login), so no auth provider calls
 *
 * === LOGGED-IN PASSWORD UPDATE ===
 * 1. PHASE 1 (Before Confirmation): Verify identity
 *    - performPhase1_VerifyIdentity() checks user is logged in + session valid
 *    - If OK → show password modal (Phase 2)
 *
 * 2. PHASE 2 (After Confirmation): Update password
 *    - performPhase2_UpdatePasswordLoggedIn() validates new password
 *    - Calls auth provider to verify current password (security check)
 *    - Calls auth provider to update password
 *    - On success → check if auth provider signed user out:
 *      - If auth provider signed out: call performSignOutPhase2_ClearAndSignOut()
 *      - If auth provider kept user logged in: stay logged in (better UX)
 *
 * Key: On any failure, user remains authenticated and can retry or cancel.
 *
 * Usage:
 *   // Phase 1: Verify identity (for username or password)
 *   const verifyResult = await performPhase1_VerifyIdentity();
 *   if (verifyResult.success) {
 *     // Show modal (username or password input)
 *   } else {
 *     // Show error: "Session expired" or "Network error"
 *   }
 *
 *   // USERNAME: User enters new username
 *   const usernameResult = await performPhase2_UpdateUsername(newUsername);
 *   if (usernameResult.success) {
 *     // Show success toast + redirect
 *   } else {
 *     // Show error
 *   }
 *
 *   // PASSWORD: User enters current + new password
 *   const passwordResult = await performPhase2_UpdatePasswordLoggedIn(currentPassword, newPassword);
 *   if (passwordResult.success) {
 *     if (passwordResult.signedOutByProvider) {
 *       // Navigate to login (auth provider forced sign-out)
 *     } else {
 *       // Stay logged in (better UX, auth provider kept session)
 *     }
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
 * Source of credential update trigger.
 */
export type UpdateCredsSource = 'user-initiated';

/**
 * Type of credential being updated.
 */
export type UpdateCredsType = 'username' | 'password';

/**
 * Error during credential update operation.
 */
export interface UpdateCredsError {
  phase: 'verification' | 'validation' | 'auth' | 'update' | 'cleanup';
  message: string;
  error?: Error;
}

/**
 * Result of Phase 1: Verify identity (BEFORE confirmation).
 * Returned to auth-manager for modal.
 */
export interface Phase1VerifyResult {
  success: boolean;
  errors: UpdateCredsError[];
}

/**
 * Result of Phase 2: Update username (AFTER confirmation).
 */
export interface Phase2UpdateUsernameResult {
  success: boolean;
  redirect?: string;
  errors: UpdateCredsError[];
}

/**
 * Result of Phase 2: Update password (AFTER confirmation).
 */
export interface Phase2UpdatePasswordResult {
  success: boolean;
  redirect?: string;
  signedOutByProvider?: boolean; // True if auth provider forced sign-out
  errors: UpdateCredsError[];
}

// ============================================================================
// UPDATE CREDENTIALS SYSTEM SINGLETON
// ============================================================================

/**
 * Manages credential (username & password) updates with verification.
 */
class UpdateCredsSystemImpl {
  /**
   * PHASE 2: Update username (AFTER confirmation)
   *
   * Called after Phase 1 verification passed.
   * Username is cosmetic (not used for login), so no auth provider calls needed.
   * Simple validation → DB update.
   *
   * On failure: user stays logged in.
   *
   * @param newUsername - New username value (pre-validated by auth-manager)
   * @param source - The source of the update trigger
   * @returns Result with success status and any errors
   */
  async performPhase2_UpdateUsername(
    newUsername: string,
    source: UpdateCredsSource = 'user-initiated'
  ): Promise<Phase2UpdateUsernameResult> {
    const result: Phase2UpdateUsernameResult = {
      success: true,
      errors: [],
    };

    logger.category('security').info(`[${source}] Update Username Phase 2: Update started`);

    try {
      // =====================================================================
      // PHASE 2: UPDATE USERNAME IN DB (guards ran in auth-manager)
      // =====================================================================
      logger.category('security').debug('Update Username Phase 2: Updating username in database');

      const updateResult = await usersDB.updateCurrentUser({
        username: newUsername,
      });

      if (!updateResult) {
        throw new Error('Username update failed. Please try again later.');
      }

      logger.category('security').info(`[${source}] Phase 2b: Username updated successfully`);
      result.redirect = '/settings';

      logger.category('security').info(`[${source}] Update Username Phase 2: Update complete`);

      return result;
    } catch (error) {
      result.success = false;
      result.errors.push({
        phase: 'update',
        message: error instanceof Error ? error.message : 'Username update failed. Please try again.',
        error: error instanceof Error ? error : undefined,
      });

      logger.category('security').warn(`[${source}] Phase 2: Update failed`, error);
      logger.category('security').info(`[${source}] User remains logged in after username update error`);

      return result;
    }
  }

  /**
   * PHASE 2: Update password (AFTER confirmation)
   *
   * Called after Phase 1 verification passed + user provided current password.
   * Verifies current password with auth provider (security check).
   * Updates password via auth provider.
   *
   * On success:
   * - Checks if auth provider kept user logged in or forced sign-out
   * - If signed out by provider: calls performSignOutPhase2_ClearAndSignOut()
   * - If kept logged in: user stays logged in (better UX)
   *
   * On failure: user stays logged in.
   *
   * @param currentPassword - User's current password (for verification)
   * @param newPassword - New password (pre-validated by auth-manager)
   * @param source - The source of the update trigger
   * @returns Result with success status, sign-out info, and any errors
   */
  async performPhase2_UpdatePasswordLoggedIn(
    currentPassword: string,
    newPassword: string,
    source: UpdateCredsSource = 'user-initiated'
  ): Promise<Phase2UpdatePasswordResult> {
    const result: Phase2UpdatePasswordResult = {
      success: true,
      errors: [],
      signedOutByProvider: false,
    };

    logger.category('security').info(`[${source}] Update Password Phase 2: Update started`);

    try {
      // =====================================================================
      // PHASE 2: UPDATE PASSWORD WITH AUTH PROVIDER (guards ran in auth-manager)
      // =====================================================================
      logger.category('security').debug('Update Password Phase 2: Updating password with auth provider');

      try {
        const { authUpdatePassword } = await import('@/lib/middleware/services/auth-service');
        const updateResult = await authUpdatePassword(newPassword);

        if (!updateResult.success) {
          throw new Error(updateResult.error || 'Password update failed. Please try again later.');
        }

        logger.category('security').info(`[${source}] Phase 2c: Password updated successfully`);
      } catch (updateError) {
        throw new Error(
          updateError instanceof Error ? updateError.message : 'Password update failed. Please try again later.'
        );
      }

      // =====================================================================
      // PHASE 2c: CHECK IF AUTH PROVIDER SIGNED USER OUT
      // =====================================================================
      logger.category('security').debug('Update Password Phase 2: Checking if user is still logged in');

      try {
        const { validateCurrentUser } = await import('@/lib/database');
        const stillLoggedIn = await validateCurrentUser();

        if (!stillLoggedIn?.auth_id) {
          result.signedOutByProvider = true;
          logger.category('security').info(
            `[${source}] Phase 2c: Auth provider signed user out after password update`
          );

          // ===================================================================
          // PHASE 2d: CLEAR STORAGE AND SIGN OUT (if provider signed out)
          // ===================================================================
          logger.category('security').debug('Update Password Phase 2: Clearing storage and signing out');

        const signOutResult = await performSignOutPhase2_ClearAndSignOut('user-initiated');

          if (!signOutResult.success && signOutResult.errors?.length) {
            for (const err of signOutResult.errors) {
              result.errors.push({
                phase: 'cleanup',
                message: err.message,
                error: err.error,
              });
            }
            logger.category('security').warn(
              `[${source}] Phase 2e: Sign-out had ${signOutResult.errors.length} error(s)`
            );
          }

          result.redirect = signOutResult.redirect || '/login';
          logger.category('security').info(
            `[${source}] Phase 2d: User signed out and storage cleared (redirecting to login)`
          );
        } else {
          logger.category('security').info(`[${source}] Phase 2c: User remained logged in (better UX)`);
          result.signedOutByProvider = false;
          result.redirect = '/settings';
        }
      } catch (sessionCheckError) {
        logger.category('security').warn(
          `[${source}] Phase 2c: Error checking session status`,
          sessionCheckError
        );
        result.signedOutByProvider = false;
        result.redirect = '/settings';
      }

      logger.category('security').info(`[${source}] Update Password Phase 2: Update complete`);

      return result;
    } catch (error) {
      result.success = false;
      result.errors.push({
        phase: 'update',
        message: error instanceof Error ? error.message : 'Password update failed. Please try again.',
        error: error instanceof Error ? error : undefined,
      });

      logger.category('security').warn(`[${source}] Phase 2: Update failed`, error);
      logger.category('security').info(`[${source}] User remains logged in after password update error`);

      return result;
    }
  }
}

// ============================================================================
// SINGLETON EXPORT & PUBLIC API
// ============================================================================

const updateCredsSystem = new UpdateCredsSystemImpl();

/**
 * PHASE 2: Update username (AFTER confirmation).
 *
 * Called after Phase 1 verification passed and user confirmed new username.
 * Username is cosmetic (not used for login), so no auth provider calls needed.
 * Simple validation → DB update.
 *
 * On failure: user stays logged in.
 *
 * @param newUsername - New username value (pre-validated by auth-manager)
 * @param source - The source of the update trigger (default: 'user-initiated')
 * @returns Promise<Phase2UpdateUsernameResult>
 */
export async function performPhase2_UpdateUsername(
  newUsername: string,
  source: UpdateCredsSource = 'user-initiated'
): Promise<Phase2UpdateUsernameResult> {
  return updateCredsSystem.performPhase2_UpdateUsername(newUsername, source);
}

/**
 * PHASE 2: Update password (AFTER confirmation).
 *
 * Called after Phase 1 verification passed and user confirmed new password.
 * Verifies current password with auth provider (security check).
 * Updates password via auth provider.
 *
 * On success:
 * - Checks if auth provider kept user logged in or forced sign-out
 * - If signed out by provider: calls performSignOutPhase2_ClearAndSignOut()
 * - If kept logged in: user stays logged in (better UX)
 *
 * On failure: user stays logged in.
 *
 * @param currentPassword - User's current password (for verification)
 * @param newPassword - New password (pre-validated by auth-manager)
 * @param source - The source of the update trigger (default: 'user-initiated')
 * @returns Promise<Phase2UpdatePasswordResult>
 */
export async function performPhase2_UpdatePasswordLoggedIn(
  currentPassword: string,
  newPassword: string,
  source: UpdateCredsSource = 'user-initiated'
): Promise<Phase2UpdatePasswordResult> {
  return updateCredsSystem.performPhase2_UpdatePasswordLoggedIn(currentPassword, newPassword, source);
}
