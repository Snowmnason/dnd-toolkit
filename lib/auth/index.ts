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
    verifyCredentials
} from "./auth-manager";

export { deleteUserAccount, type DeleteAccountResult } from "./account/deleteAccount";
export {
    performSignOut,
    registerSignOutHook,
    type ISignOutHook,
    type SignOutPhase,
    type SignOutResult,
    type SignOutSource
} from "./account/sign-out-system";
export { updateUsername, type UpdateUsernameResult } from "./account/updateUsername";
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

