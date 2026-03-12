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
// Pure domain helpers (error mapping, types)
export {
    mapAuthErrorToCode,
    type AuthOperationResult,
    type ResendResult,
    type ResetPasswordResult,
    type Session,
    type SignInResult,
    type SignUpResult
} from "./auth-operations";
// Auth manager — single public API for all auth operations
export {
    checkPendingInvites,
    deleteAccountUser,
    ensureAuthProviderReady,
    ensureUserLoggedIn,
    generateWorldInviteLink,
    getCurrentSession,
    getUser,
    isAuthSessionReady,
    listenToAuthStateChanges,
    resendConfirmationEmail,
    restoreSession,
    sendPasswordReset,
    signInUser,
    signInWithIdToken,
    signInWithOAuth,
    signOutUser,
    signUpUser,
    updatePassword,
    updatePasswordLoggedIn,
    updateUsernameUser,
    verifyCredentials,
    verifyDeletion,
    verifyIdentityForCredentialUpdate
} from "./auth-manager";

export {
    type DeleteAccountError,
    type DeleteAccountSource,
    type DeletePhase1Result,
    type DeletePhase2Result
} from "./account/delete-account-system";
export {
    performCheckPendingInvites,
    performGenerateInviteLink
} from "./account/invite-system";
export { performReAuth, type AuthTokens, type ReAuthContext, type ReAuthError, type ReAuthResult } from "./account/re-auth-system";
export { type SignInError } from "./account/sign-in-system";
export {
    performSignOutPhase1_DBSync,
    performSignOutPhase2_ClearAndSignOut,
    type SignOutError,
    type SignOutPhase1Result,
    type SignOutPhase2Result,
    type SignOutSource
} from "./account/sign-out-system";
export { type SignUpError } from "./account/sign-up-system";
export {
    type Phase1VerifyResult, type Phase2UpdatePasswordResult, type Phase2UpdateUsernameResult, type UpdateCredsError, type UpdateCredsSource,
    type UpdateCredsType
} from "./account/update-creds-system";
export { AuthLayer, type AuthContext, type AuthStrategy } from "./auth-layer";
export {
    createInviteAuthStrategy,
    createPublicAuthStrategy,
    createUserAuthStrategy
} from "./default-strategies";
export { isSafeToRedirect } from "./guards/redirectSafety";
export {
    checkUserSession,
    prepareAuthNavigation,
    type SessionCheckResult
} from "./guards/sessionService";

