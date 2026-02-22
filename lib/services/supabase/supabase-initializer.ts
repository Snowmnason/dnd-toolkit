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

import { logger } from '@/lib/utils/logger';
import { NoOpDatabaseProvider, registerDatabaseProvider } from '../database-adapter';
import { SupabaseDatabaseProvider } from './supabase-database-provider';

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
    logger.debug('bootstrap', '[Supabase Initializer] Already initialized — skipping');
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
      logger.debug('bootstrap', '[Supabase Initializer] EXPO_PUBLIC_SUPABASE_URL set from app.json extras');
    }
    if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY && expoExtra.supabaseAnonKey) {
      (process.env as any).EXPO_PUBLIC_SUPABASE_ANON_KEY = expoExtra.supabaseAnonKey;
      logger.debug('bootstrap', '[Supabase Initializer] EXPO_PUBLIC_SUPABASE_ANON_KEY set from app.json extras');
    }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    // expo-constants unavailable (non-Expo environments) — env vars must be in process.env already
    logger.debug('bootstrap', '[Supabase Initializer] expo-constants unavailable; relying on process.env');
  }

  // ── Step 2: Check configuration ───────────────────────────────────────────
  const { getSupabaseClient, isSupabaseConfigured } = await import('@/lib/database/supabase');

  if (!isSupabaseConfigured()) {
    logger.warn(
      'bootstrap',
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
  logger.info('bootstrap', '[Supabase Initializer] Client initialized — session restoration in progress');

  // ── Step 4: Register DatabaseProvider ─────────────────────────────────────
  registerDatabaseProvider(new SupabaseDatabaseProvider(client));
  logger.debug('bootstrap', '[Supabase Initializer] SupabaseDatabaseProvider registered');

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
