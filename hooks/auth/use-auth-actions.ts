/**
 * useAuthActions
 *
 * Wraps imperative auth operations (password reset, resend confirmation, etc.)
 * so screens never need to import from @/lib/auth directly.
 *
 * Sign-out and delete-account have moved to useSignOutFlow, which manages
 * the full phase-based flow including modal state.
 */

import {
  isEmailConfirmed,
  resendConfirmationEmail,
  sendPasswordReset,
  updateUsernameUser,
  type Phase2UpdateUsernameResult,
  type ResendResult,
  type ResetPasswordResult,
  type Session,
} from "@/lib/auth";
import { useCallback } from "react";

export function useAuthActions() {
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
    resetPassword,
    resendConfirmation,
    checkEmailConfirmed,
    changeUsername,
  };
}
