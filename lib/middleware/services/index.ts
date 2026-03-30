/**
 * Services Barrel — lib/middleware/services
 *
 * Middleware layer between lib modules and System/Services adapters.
 * Each *-service file is the ONLY entry point to its corresponding adapter.
 *
 * Import from here (or from individual service files) instead of @/system/Services.
 *
 * Architecture:
 *   lib modules → lib/middleware/services/*-service → system/Services/adapters → providers
 *
 * Note: initializeServices is bootstrap-only; import directly from @/system/Services in kernel phase files.
 */

// ─── Error Service ─────────────────────────────────────────────────
export {
    addErrorBreadcrumb,
    flushErrors,
    getErrorTrackerInstance,
    isErrorTrackingEnabled,
    reportError,
    reportMessage,
    setErrorUser
} from './error-service';

// ─── Auth Service ──────────────────────────────────────────────────
export {
    authGetSession,
    authGetUser,
    authOnStateChange,
    authResendConfirmation, authResetPassword, authRestoreSession, authSignIn,
    authSignInWithIdToken,
    authSignInWithOAuth,
    authSignOut,
    authSignUp,
    authUpdatePassword,
    getAuth,
    getAuthProvider, getAuthProviderSync, getAuthSync,
    getDatabaseProviderRawClient,
    initializeAuthStrategies,
    isAuthConfigured,
    isDatabaseProviderConfigured,
    type Session
} from './auth-service';

// ─── Database Service ──────────────────────────────────────────────
export {
    getDatabase,
    getDatabaseWithAuth,
    invokeEdgeFunction,
    isDatabaseConfigured,
    runEdgeFunction
} from './database-service';

// ─── Analytics Service ─────────────────────────────────────────────
export {
    getBreadcrumbProvider,
    listBreadcrumbProviders,
    sendBreadcrumbs
} from './analytics-service';

