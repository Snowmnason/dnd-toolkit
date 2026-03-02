/**
 * Services Barrel — lib/services
 *
 * Middleware layer between lib modules and System/Services adapters.
 * Each *-service file is the ONLY entry point to its corresponding adapter.
 *
 * Import from here (or from individual service files) instead of @/system/Services.
 *
 * Architecture:
 *   lib modules → lib/services/*-service → system/Services/adapters → providers
 */

// ─── Bootstrap ─────────────────────────────────────────────────────
// initializeServices is a bootstrap-only function; only kernel should call it.
export { initializeServices } from '@/system/Services';

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
    getSupabaseClientLazy,
    isAuthConfigured,
    isSupabaseConfiguredLazy,
    type Session
} from './auth-service';

// ─── Database Service ──────────────────────────────────────────────
export {
    getDatabase,
    getDatabaseWithAuth,
    isDatabaseConfigured,
    runEdgeFunction
} from './database-service';

// ─── Analytics Service ─────────────────────────────────────────────
export {
    getBreadcrumbProvider,
    listBreadcrumbProviders,
    sendBreadcrumbs
} from './analytics-service';

