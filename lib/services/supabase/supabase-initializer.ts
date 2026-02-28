/**
 * Supabase Database Initialization
 *
 * Single-responsibility module for all Supabase-specific database setup:
 * - Env var injection from app.json extras (for Expo builds without pre-populated process.env)
 * - Supabase client eager initialization (enables session restoration to begin immediately)
 * - SupabaseDatabaseProvider registration (makes getDatabaseProvider() return Supabase)
 *
 * Called by:
 * - lib/kernel/app-kernel.ts (CONFIG phase) — early boot, before AUTH phase
 * - lib/services/service-initializer.ts (initializeDatabaseProvider) — normal service init path
 *
 * Design mirrors lib/services/sentry/sentry-service-initializer.ts:
 * service-initializer.ts is the switch-board ("which provider?");
 * this file owns "how to initialize Supabase specifically."
 * Swapping to PostgreSQL, Firebase, etc. means adding a new *-initializer and
 * changing one line in service-initializer.ts.
 *
 * Idempotent: safe to call multiple times — initialization only runs once per process.
 */

import { logger } from '@/lib/utils';
import { NoOpDatabaseProvider, registerDatabaseProvider } from '../database-adapter';
import { SupabaseDatabaseProvider } from './supabase-database-provider';
import { createSupabaseRpcAdapter } from './supabase-rpc-adapter';

// Lazy import to break circular dependency with lib/database/index.ts
let cachedRegisterEdgeFunction: any = null;
function getRegisterEdgeFunction() {
  if (!cachedRegisterEdgeFunction) {
    cachedRegisterEdgeFunction = require('@/lib/database').registerEdgeFunction;
  }
  return cachedRegisterEdgeFunction;
}

/** Module-scope guard — prevents double initialization */
let _initialized = false;

/**
 * Initialize the Supabase client and register it as the active DatabaseProvider.
 *
 * Steps:
 * 1. Inject Supabase env vars from app.json extras into process.env (if not already set).
 *    Needed for Expo builds where Constants.expoConfig.extra carries the keys.
 * 2. Check if Supabase is configured (env vars present). If not, register NoOpDatabaseProvider
 *    so getDatabaseProvider() returns a descriptive error rather than crashing, and return false.
 * 3. Eagerly create the Supabase client — this starts the session restoration flow early,
 *    so the auth adapter can restore tokens before the AUTH phase begins.
 * 4. Create and register SupabaseDatabaseProvider — entity files can now query immediately.
 *
 * @returns true if Supabase was initialized and SupabaseDatabaseProvider registered;
 *          false if Supabase is not configured (NoOpDatabaseProvider registered instead)
 */
export async function initializeSupabaseDatabaseProvider(): Promise<boolean> {
  if (_initialized) {
    const { getDatabaseProvider } = await import('../database-adapter');
    return getDatabaseProvider().isConfigured();
  }

  _initialized = true;

  // ── Step 1: Inject env vars from Constants (Expo build support) ───────────
  // Standard CRA/Next builds pre-populate process.env at build time.
  // Expo managed workflow may carry keys in Constants.expoConfig.extra instead.
  try {
    const Constants = await import('expo-constants');
    const expoExtra = Constants.default.expoConfig?.extra || {};

    if (!process.env.EXPO_PUBLIC_SUPABASE_URL && expoExtra.supabaseUrl) {
      (process.env as any).EXPO_PUBLIC_SUPABASE_URL = expoExtra.supabaseUrl;
    }
    if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY && expoExtra.supabaseAnonKey) {
      (process.env as any).EXPO_PUBLIC_SUPABASE_ANON_KEY = expoExtra.supabaseAnonKey;
    }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    // expo-constants unavailable (non-Expo environments) — env vars must be in process.env already
    logger.category('bootstrap').debug('[Supabase Initializer] expo-constants unavailable; relying on process.env');
  }

  // ── Step 2: Check configuration ───────────────────────────────────────────
  const { getSupabaseClient, isSupabaseConfigured } = await import('./supabase-client');

  if (!isSupabaseConfigured()) {
    logger.category('bootstrap').warn(
      '[Supabase Initializer] Not configured (missing env vars) — registering NoOpDatabaseProvider. ' +
        'Database queries will throw until a provider is registered.'
    );
    registerDatabaseProvider(new NoOpDatabaseProvider());
    return false;
  }

  // ── Step 3: Eager client initialization ───────────────────────────────────
  // Forces the Supabase singleton to initialize now so the session restoration
  // timer starts immediately. Without this, the first getSession() call would
  // trigger initialization lazily, potentially after key auth windows close.
  const client = getSupabaseClient();
  logger.category('bootstrap').info('[Supabase Initializer] Client initialized — session restoration in progress');

  // ── Step 4: Register DatabaseProvider ─────────────────────────────────────
  registerDatabaseProvider(new SupabaseDatabaseProvider(client));
  logger.category('bootstrap').debug('[Supabase Initializer] SupabaseDatabaseProvider registered');

  // ── Step 5: Register RPC adapters with edge-function registry ──────────────
  // Maps semantic edge function names to Supabase RPC implementations.
  // This allows repositories to call executeEdgeFunction() without knowing the backend.
  const rpcFunctionNames = [
    'leaveWorld',
    'joinWorldWithInvite',
    'createInviteLink',
    'resolveInviteToken',
    'deleteInviteLink',
    'removeWorldAccess',
  ];

  rpcFunctionNames.forEach((functionName) => {
    const adapter = createSupabaseRpcAdapter(functionName);
    getRegisterEdgeFunction()(functionName, adapter);
  });

  logger.category('bootstrap').debug(`[Supabase Initializer] Registered ${rpcFunctionNames.length} RPC edge functions`);

  return true;
}

/**
 * Reset initialization state — for testing only.
 * Allows tests to re-initialize with a fresh Supabase client/config.
 * @internal
 */
export function resetSupabaseInitializer(): void {
  _initialized = false;
}
