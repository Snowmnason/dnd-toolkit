/**
 * useAuthActions
 *
 * Wraps imperative auth operations (sign out, delete account, password reset,
 * resend confirmation) so screens never need to import from @/lib/auth directly.
 */

import {
    deleteUserAccount,
    isEmailConfirmed,
    resendConfirmationEmail,
    sendPasswordReset,
    signOutUser,
    updateUsername,
    type DeleteAccountResult,
    type ResendResult,
    type ResetPasswordResult,
    type Session,
    type UpdateUsernameResult,
} from "@/lib/auth";
import { useCallback } from "react";

export function useAuthActions() {
  const signOut = useCallback(() => signOutUser(), []);

  const deleteAccount = useCallback(
    (password: string): Promise<DeleteAccountResult> => deleteUserAccount(password),
    [],
  );

  const resetPassword = useCallback(
    (email: string): Promise<ResetPasswordResult> => sendPasswordReset(email),
    [],
  );

  const resendConfirmation = useCallback(
    (email: string): Promise<ResendResult> => resendConfirmationEmail(email),
    [],
  );

  const checkEmailConfirmed = useCallback(
    (session: Session | null) => isEmailConfirmed(session),
    [],
  );

  const changeUsername = useCallback(
    (newUsername: string): Promise<UpdateUsernameResult> => updateUsername(newUsername),
    [],
  );

  return {
    signOut,
    deleteAccount,
    resetPassword,
    resendConfirmation,
    checkEmailConfirmed,
    changeUsername,
  };
}
