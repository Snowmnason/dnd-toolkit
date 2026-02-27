
// Re-export auth provider types from services for convenience
export type {
    AuthProvider,
    AuthResult,
    Session
} from '@/lib/services';

export {
    AuthError, EmailAlreadyExistsError, InvalidCredentialsError,
    NetworkError,
    ProviderInitializationError,
    RateLimitError, UserNotFoundError, createValidatedAuthProvider, getAuthProvider,
    getAuthProviderSync, registerAuthProvider
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
    // Re-exported from authService
    checkPendingInvites,
    generateWorldInviteLink, getCurrentSession,
    listenToAuthStateChanges, mapAuthErrorToCode, resendConfirmationEmail,
    sendPasswordReset,
    signInUser,
    signOutSessionOnly,
    signUpUser,
    updatePassword,
    type AuthOperationResult,
    type ResendOperationResult,
    type ResetPasswordOperationResult, type ResetPasswordResult, type SignInOperationResult, type SignInResult, type SignUpOperationResult, type SignUpResult
} from "./auth-operations";

export { isSafeToRedirect } from "./redirectSafety";
export {
    checkUserSession,
    prepareAuthNavigation,
    type SessionCheckResult
} from "./sessionService";

