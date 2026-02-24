// Re-export auth provider types from services for convenience
export type {
  AuthProvider,
  AuthResult,
  Session
} from '@/lib/services';

export {
  AuthError,
  createValidatedAuthProvider,
  EmailAlreadyExistsError,
  getAuthProvider,
  getAuthProviderSync,
  InvalidCredentialsError,
  NetworkError,
  ProviderInitializationError,
  RateLimitError,
  registerAuthProvider,
  UserNotFoundError
} from '@/lib/services';

export {
  checkAuthGuard,
  recordAuthFailure,
  recordAuthSuccess,
  type AuthGuardScope
} from "./auth-attempt-guard";
export {
  AuthStateManager,
  isEmailConfirmed,
  type AuthState,
  type CacheMetadata
} from "./auth-state";
// High-level semantic auth operations (primary exports)
export {
  getCurrentSession,
  listenToAuthStateChanges,
  resendConfirmationEmail,
  sendPasswordReset,
  signInUser,
  signOutSessionOnly,
  signUpUser,
  updatePassword,
  type AuthOperationResult,
  type ResendOperationResult,
  type ResetPasswordOperationResult,
  type SignInOperationResult,
  type SignUpOperationResult
} from "./auth-operations";

// Legacy authService exports for backward compatibility
export {
  checkPendingInvites,
  generateWorldInviteLink,
  isEmailExistsError,
  type ResetPasswordResult,
  type SignInResult,
  type SignUpResult
} from "./authService";
export { getEmailDomain, getEmailProvider, openEmailApp } from "./emailUtils";
export { isSafeToRedirect } from "./redirectSafety";
export {
  checkUserSession,
  prepareAuthNavigation,
  type SessionCheckResult
} from "./sessionService";
export {
  useAuthGuard,
  type AuthGuardOptions, type AuthGuardState, type AuthLevel
} from "./useAuthGuard";
export { useResetPasswordConfirm } from "./useResetPasswordConfirm";
export { useSignInForm } from "./useSignInForm";
export { useSignUpForm } from "./useSignUpForm";
export { useWelcomeScreen } from "./useWelcomeScreen";
export {
  getPasswordHintColor,
  getPasswordRequirementsText,
  isExistingUser,
  sanitizeInput,
  validateEmail,
  validatePassword,
  validateUsername,
  validateWorldName,
  type WorldNameValidationResult
} from "./validation";

