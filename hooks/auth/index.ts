// Barrel export for auth hooks
export type { ResendResult, ResetPasswordResult, Session } from "@/lib/auth";
export { useAuthActions } from "./use-auth-actions";
export { useBootstrapAuth } from "./use-bootstrap-auth";
export type { BootstrapAuthState } from "./use-bootstrap-auth";
export { useCurrentSession } from "./use-current-session";
export type { CurrentSessionState } from "./use-current-session";
export {
  pendingInviteStorage, preloadWorlds, processInviteForUser
} from "./use-pending-invite";
export type { InviteProcessResult } from "./use-pending-invite";
export {
  useAuthFlow,
  type AuthFlowAppleHandlers,
  type AuthFlowForm,
  type AuthFlowGoogleHandlers,
  type AuthFlowPhase,
  type AuthFlowState
} from "./useAuthFlow";
export {
  useAuthGuard,
  type AuthGuardOptions,
  type AuthGuardState,
  type AuthLevel
} from "./useAuthGuard";
export { useAuthStateListener } from "./useAuthStateListener";
export {
  useChangeCredsFlow,
  type ChangeCredsHandlers,
  type ChangeCredsPhase,
  type ChangeCredsState
} from "./useChangeCredsFlow";
export {
  usePasswordResetFlow,
  type PasswordResetPhase,
  type PasswordResetState
} from "./usePasswordResetFlow";
export {
  useSignOutFlow, type SignOutFlowHandlers, type SignOutFlowMode,
  type SignOutFlowPhase,
  type SignOutFlowState,
  type SignOutModal
} from "./useSignOutFlow";
export {
  useSignUpFlow,
  type SignUpFlowMode,
  type SignUpFlowPhase, type SignUpFlowState, type SignUpModal
} from "./useSignUpFlow";

