// Barrel export for auth hooks
export type { ResendResult, ResetPasswordResult, Session } from "@/lib/auth";
export { pendingInviteStorage, processInviteForUser } from "@/lib/auth/account/invite-system";
export type { InviteProcessResult } from "@/lib/auth/account/invite-system";
export { useAuthActions } from "./use-auth-actions";
export { useAuthLinkObserver } from "./use-auth-link-observer";
export { useCurrentSession } from "./use-current-session";
export type { UseCurrentSessionResult } from "./use-current-session";
export {
  useAuthFlow,
  type AuthFlowAppleHandlers,
  type AuthFlowForm,
  type AuthFlowGoogleHandlers,
  type AuthFlowPhase,
  type AuthFlowState
} from "./useAuthFlow";
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

