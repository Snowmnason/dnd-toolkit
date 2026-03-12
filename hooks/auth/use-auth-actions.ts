/**
 * useAuthActions
 *
 * Wraps imperative auth operations (sign out, delete account, password reset,
 * resend confirmation) so screens never need to import from @/lib/auth directly.
 */

import {
    deleteAccountUser,
    isEmailConfirmed,
    resendConfirmationEmail,
    sendPasswordReset,
    signOutUser,
    updateUsernameUser,
    type DeletePhase2Result,
    type Phase2UpdateUsernameResult,
    type ResendResult,
    type ResetPasswordResult,
    type Session,
} from "@/lib/auth";
import { useCallback } from "react";

export function useAuthActions() {
  const signOut = useCallback(() => signOutUser(), []);

  const deleteAccount = useCallback(
    (password: string): Promise<DeletePhase2Result> =>
      deleteAccountUser(password),
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
    (newUsername: string): Promise<Phase2UpdateUsernameResult> => updateUsernameUser(newUsername),
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
