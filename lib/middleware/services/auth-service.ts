/**
 * Auth Service — Middleware between lib modules and System/Services auth-adapter
 *
 * This is the ONLY file in lib that imports from the auth adapter.
 * All other lib modules, hooks, components, and screens call these functions instead.
 *
 * Middleware Responsibilities:
 * - Precondition: Check network connectivity (auth requires Supabase connection)
 * - Precondition: Check provider is initialized (isServiceReady)
 * - Single entry point to auth adapter operations
 *
 * Does NOT:
 * - Validate data (lib/auth modules validate email/password before calling here)
 * - Contain domain logic (that stays in lib/auth/)
 * - Manage auth state (that stays in lib/auth/auth-state.ts)
 */

import { logger } from '@/lib/utils/logger';
import { ERROR_CODES } from '@/maps/ERROR_CODES';
import { AppError } from '@/pure-algo-immutables/app-error';
import { ConnectionQuality, NetworkDetection } from '@/system/Network';
import {
    isServiceReady,
    getAuthProvider as rawGetAuthProvider,
    getAuthProviderSync as rawGetAuthProviderSync,
    getDatabaseProvider as rawGetDatabaseProvider,
    SessionAdapter,
    type AuthProvider,
    type DatabaseProvider,
    type Session,
} from '@/system/Services';
// Note: Low-level database provider access is now abstracted.
// For raw client access, use isDatabaseProviderConfigured() + getDatabaseProviderRawClient().
// These functions safely check provider readiness without triggering unnecessary initialization.

// ─── Precondition Checks ───────────────────────────────────────────

/**
 * Check if auth operations can proceed.
 * Auth operations CANNOT be queued — they must succeed or fail immediately.
 *
 * @returns true if preconditions are met
 * @throws Error if provider not ready (indicates bootstrap bug)
 */
function ensureAuthReady(): void {
    // 1. Network available?
    const networkStatus = NetworkDetection.getStatus();
    if (networkStatus.connectionQuality === ConnectionQuality.OFFLINE) {
        // Auth ops cannot be queued (must complete synchronously or fail).
        // Throw typed error with recovery guidance for callers/UI.
        throw new AppError(
            ERROR_CODES.NETWORK.OFFLINE,
            'Network offline — cannot perform auth operation. Please reconnect and try again.'
        );
    }

    // 2. Provider initialized?
    // Check both the service status AND the actual provider instance
    // to handle cases where the registry might be stale or not populated.
    // If either check says "not ready", we accept that (provider might be ready but status not updated yet).
    const providerExists = rawGetAuthProviderSync() !== null;
    const isReady = isServiceReady('auth') || providerExists;
    
    if (!isReady) {
        throw new AppError(
            ERROR_CODES.AUTH.UNKNOWN,
            'Auth provider not initialized — cannot perform auth operation. Please restart the app.'
        );
    }

}

// ─── Auth Operations ───────────────────────────────────────────────

/**
 * Check if the auth provider is configured and ready.
 * Useful for guard checks where we need to know if auth backend is available
 * (e.g. GitHub Pages deployments without env vars).
 */
export function isAuthConfigured():  boolean {
    // Accept either service registry saying "ready" OR the provider actually existing
    // This handles cases where the registry might not be fully populated yet
    return isServiceReady('auth') || rawGetAuthProviderSync() !== null;
}

/**
 * Get the registered auth provider (async, waits for registration).
 * Checks network and provider readiness before returning.
 * **Middleware wrapper:** ensures preconditions are met before accessing provider.
 *
 * @throws Error if provider not initialized or network offline
 */
export async function getAuthProvider(): Promise<AuthProvider> {
    ensureAuthReady();
    return await rawGetAuthProvider();
}

/**
 * Get the registered auth provider (async, waits for registration).
 * Checks network and provider readiness before returning.
 * 
 * @deprecated Use getAuthProvider() instead (same function, preferred name)
 */
export async function getAuth(): Promise<AuthProvider> {
    return getAuthProvider();
}

/**
 * Get the registered auth provider synchronously.
 * Returns null if not yet registered.
 * Does NOT check network (sync path for quick checks like session validation).
 */
export function getAuthSync(): AuthProvider | null {
    if (!isServiceReady('auth')) {
        logger.category('auth').debug('[auth-service] Auth provider not ready — returning null');
        return null;
    }
    return rawGetAuthProviderSync();
}

/**
 * Get the registered auth provider synchronously (raw, no safety checks).
 * Re-export of system/Services implementation for use in time-sensitive paths.
 * **Use getAuthSync() for most cases — this is for special situations.**
 *
 * @returns Auth provider or null if not registered
 */
export function getAuthProviderSync(): AuthProvider | null {
    return rawGetAuthProviderSync();
}

/**
 * Get the database provider for auth operations that need it.
 * Auth operations may need to access the database (e.g., recording auth attempts).
 * Checks database readiness before returning.
 *
 * @returns database provider (NoOp if not configured)
 */
export function getDatabaseProvider(): DatabaseProvider {
    if (!isServiceReady('database')) {
        logger.category('auth').warn('[auth-service] Database provider not initialized — returning NoOp');
    }
    return rawGetDatabaseProvider();
}

// ─── Per-Operation Semantic Functions ─────────────────────────────
// These replace direct getAuthProvider() calls in lib/auth modules.
// Each function enforces preconditions then delegates to the adapter.

export async function authSignUp(
    email: string,
    password: string,
    options?: { emailRedirectTo?: string }
): Promise<ReturnType<AuthProvider['signUp']>> {
    ensureAuthReady();
    const provider = await rawGetAuthProvider();
    return provider.signUp(email, password, options);
}

export async function authSignIn(
    email: string,
    password: string
): Promise<ReturnType<AuthProvider['signIn']>> {
    ensureAuthReady();
    const provider = await rawGetAuthProvider();
    return await provider.signIn(email, password);
}

export async function authResetPassword(
    email: string
): Promise<ReturnType<AuthProvider['resetPassword']>> {
    ensureAuthReady();
    const provider = await rawGetAuthProvider();
    return provider.resetPassword(email);
}

export async function authUpdatePassword(
    newPassword: string
): Promise<ReturnType<AuthProvider['updatePassword']>> {
    ensureAuthReady();
    const provider = await rawGetAuthProvider();
    return provider.updatePassword(newPassword);
}

export async function authResendConfirmation(
    email: string
): Promise<ReturnType<AuthProvider['resend']>> {
    ensureAuthReady();
    const provider = await rawGetAuthProvider();
    return provider.resend(email);
}

export async function authSignOut(): Promise<ReturnType<AuthProvider['signOut']>> {
    ensureAuthReady();
    const provider = await rawGetAuthProvider();
    return await provider.signOut();
}

export async function authGetSession(): Promise<Session | null> {
    ensureAuthReady();
    const provider = await rawGetAuthProvider();
    return provider.getSession();
}

/**
 * Listen to auth state changes (sync subscription, not async).
 * @returns unsubscribe function
 */
export function authOnStateChange(
    callback: (session: Session | null) => void
): () => void {
    const providerSync = rawGetAuthProviderSync();
    if (!providerSync) {
        logger.category('auth').warn('[auth-service] Auth provider not ready for state change listener');
        return () => {};
    }
    return providerSync.onAuthStateChange(callback);
}

/**
 * Restore session from tokens (used in password reset flow).
 * Delegates to provider's session restoration.
 *
 * @param tokens - { access_token, refresh_token? }
 * @returns true if restoration succeeded, false otherwise
 */
export async function authRestoreSession(
    tokens: { access_token: string; refresh_token?: string }
): Promise<boolean> {
    ensureAuthReady();
    const provider = await rawGetAuthProvider();
    const success = await provider.restoreSession(tokens);

    // If restoration failed, clear stale persisted session
    if (!success) {
        await SessionAdapter.clearSession().catch((err: unknown) => {
            logger.category('auth').warn('[auth-service] Failed to clear session after failed restore', { error: err });
        });
    }

    return success;
}

/**
 * Get current user from session.
 * Delegates to provider's getUser().
 *
 * @returns User info or null if not authenticated
 */
export async function authGetUser(): Promise<ReturnType<AuthProvider['getUser']> | null> {
    ensureAuthReady();
    const provider = await rawGetAuthProvider();
    return provider.getUser();
}

// ─── Supabase Lazy Loaders ─────────────────────────────────────────
// Middleware wrappers for lazy-loading Supabase client.
// These are used for low-level operations (token refresh, etc.) that need
// direct client access but don't go through the standard auth provider flow.

/**
 * Check if the database provider is configured and ready.
 * Provider-agnostic check (abstraction maintained, not Supabase-specific).
 */
export function isDatabaseProviderConfigured(): boolean {
    return rawGetDatabaseProvider().isConfigured();
}

/**
 * Get the raw database client through the DatabaseProvider abstraction.
 * Provider-agnostic (works with any database provider that exposes getRawClient).
 *
 * @throws Error if the provider is not configured or has no raw client
 */
export function getDatabaseProviderRawClient() {
    const client = rawGetDatabaseProvider().getRawClient?.();
    if (!client) {
        throw new Error(
            'Database provider is not configured or does not expose a raw client. ' +
            'Ensure provider credentials are set before calling getDatabaseProviderRawClient.'
        );
    }
    return client;
}

/**
 * Sign in with an OAuth provider (e.g., Google mobile redirect flow).
 * Returns a URL to open in the browser for OAuth redirect.
 *
 * @param provider - OAuth provider name (e.g., 'google')
 * @param options - Optional provider-specific options (redirectTo, queryParams, skipBrowserRedirect)
 */
export async function authSignInWithOAuth(
    provider: string,
    options?: Record<string, any>
): Promise<ReturnType<AuthProvider['signInWithOAuth']>> {
    ensureAuthReady();
    const authProvider = await rawGetAuthProvider();
    return authProvider.signInWithOAuth(provider, options);
}

/**
 * Sign in with an ID token from a native OAuth flow (Apple, Google native).
 * Returns AuthResult with success flag and session or error.
 *
 * @param provider - Provider name ('apple', 'google')
 * @param token - ID token from the native authentication library
 * @param options - Optional provider-specific options
 */
export async function authSignInWithIdToken(
    provider: string,
    token: string,
    options?: Record<string, any>
): Promise<ReturnType<AuthProvider['signInWithIdToken']>> {
    ensureAuthReady();
    const authProvider = await rawGetAuthProvider();
    return authProvider.signInWithIdToken(provider, token, options);
}

// ─── Bootstrap: Auth Strategies Registration ────────────────────────
/**
 * Register default auth strategies with AuthLayer.
 * Called once during kernel bootstrap (after auth provider is initialized).
 *
 * Strategies:
 * - 'user': Standard user session tokens
 * - 'public': No token required (public endpoints)
 * - 'invite': Invite-scoped tokens for unauthenticated access
 *
 * This is a middleware function because:
 * - It bridges lib/auth strategies with the system-level AuthLayer
 * - It's called during bootstrap by system/Services/service-initializer
 * - Keeps circular deps out of system/ layer
 */
export function initializeAuthStrategies(): void {
    const { AuthLayer, createUserAuthStrategy, createPublicAuthStrategy, createInviteAuthStrategy } = require('@/lib/auth');
    
    AuthLayer.registerAuthStrategy('user', createUserAuthStrategy());
    AuthLayer.registerAuthStrategy('public', createPublicAuthStrategy());
    AuthLayer.registerAuthStrategy('invite', createInviteAuthStrategy());
    
    logger.category('bootstrap').info('Auth strategies registered: user, public, invite');
}

// Re-export Session type for consumers that import from @/lib/services
export type { Session };

