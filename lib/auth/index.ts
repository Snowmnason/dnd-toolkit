export {
    checkAuthGuard,
    recordAuthFailure,
    recordAuthSuccess,
    type AuthGuardScope
} from "./auth-attempt-guard";
export {
    AuthStateManager,
    type CacheMetadata,
    type SupabaseAuthState
} from "./auth-state";
export {
    checkPendingInvites,
    generateWorldInviteLink,
    isEmailExistsError,
    sendPasswordReset,
    signInUser,
    signUpUser,
    updatePassword,
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
    type AuthGuardOptions,
    type AuthLevel,
    type AuthState
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

