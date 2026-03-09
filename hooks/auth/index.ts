// Barrel export for auth hooks
export type { ResendResult, ResetPasswordResult, Session } from "@/lib/auth";
export { useAppleSignIn } from "./social/useAppleSignIn";
export { useGoogleSignIn } from "./social/useGoogleSignIn";
export { useAuthActions } from "./use-auth-actions";
export { useBootstrapAuth } from "./use-bootstrap-auth";
export type { BootstrapAuthState } from "./use-bootstrap-auth";
export {
  AuthStateManager,
  getCurrentSession,
  isEmailConfirmed,
  restoreSession, useCurrentSession
} from "./use-current-session";
export type { CurrentSessionState } from "./use-current-session";
export {
  pendingInviteStorage, preloadWorlds, processInviteForUser
} from "./use-pending-invite";
export type { InviteProcessResult } from "./use-pending-invite";
export {
  useAuthGuard,
  type AuthGuardOptions,
  type AuthGuardState,
  type AuthLevel
} from "./useAuthGuard";
export { useAuthStateListener } from "./useAuthStateListener";
export { useResetPasswordConfirm } from "./useResetPasswordConfirm";
export { useSignInForm } from "./useSignInForm";
export { useSignUpForm } from "./useSignUpForm";

