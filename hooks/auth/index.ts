// Barrel export for auth hooks
export { useAuthActions } from "./use-auth-actions";
export { useBootstrapAuth } from "./use-bootstrap-auth";
export type { BootstrapAuthState } from "./use-bootstrap-auth";
export type { ResendResult, ResetPasswordResult, Session } from "@/lib/auth";
export {
  AuthStateManager,
  getCurrentSession,
  isEmailConfirmed,
  restoreSession,
} from "./use-current-session";
export { useCurrentSession } from "./use-current-session";
export type { CurrentSessionState } from "./use-current-session";
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
export {
  pendingInviteStorage,
  processInviteForUser,
  preloadWorlds,
} from "./use-pending-invite";
export type { InviteProcessResult } from "./use-pending-invite";

