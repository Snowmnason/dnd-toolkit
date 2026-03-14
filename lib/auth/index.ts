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
    type SignUpResult
} from "./auth-operations";
// Auth manager — single public API for all auth operations
export {
    checkPendingInvites, confirmSignOut, deleteAccountUser,
    ensureAuthProviderReady,
    ensureUserLoggedIn,
    generateWorldInviteLink,
    getCurrentSession,
    getUser, initiateSignOut, isAuthSessionReady,
    listenToAuthStateChanges,
    resendConfirmationEmail,
    restoreSession,
    sendPasswordReset,
    signInUser,
    signInWithIdToken,
    signInWithOAuth, signUpUser,
    updatePassword,
    updatePasswordLoggedIn,
    updateUsernameUser,
    verifyCredentials,
    verifyDeletion,
    verifyIdentityForCredentialUpdate
} from "./auth-manager";

export {
    performDeletePhase2_DeleteAndSignOut,
    type DeleteAccountError,
    type DeleteAccountSource,
    type DeletePhase1Result,
    type DeletePhase2Result
} from "./account/delete-account-system";
export {
    performCheckPendingInvites,
    performGenerateInviteLink
} from "./account/invite-system";
export {
    performReAuth,
    performSignIn,
    performSignInWithIdToken,
    type AuthTokens,
    type ReAuthContext,
    type ReAuthError,
    type ReAuthResult,
    type SignInError
} from "./account/sign-in-system";
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
export { AuthLayer, type AuthStrategy } from "./auth-layer";
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
export {
    AuthSubscriptionManager,
    beginSignOut,
    endSignOut,
    isSigningOut,
} from "./auth-subscription-manager";

