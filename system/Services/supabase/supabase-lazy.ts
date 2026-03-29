/**
 * Lazy-loading wrapper for the Supabase client module.
 * Use this in UI/route/auth layers to avoid statically importing the Supabase client
 * in environments that may not have env vars configured (e.g., GH Pages demo).
 *
 * The entity files (e.g., users.ts, common.ts) use getDatabaseProvider() instead
 * and do not need this lazy loader.
 *
 * Usage:
 *   if (!await isDatabaseProviderConfigured()) { return handleOfflineMode(); }
 *   const supabase = await getDatabaseProviderRawClient();
 *   const { data } = await supabase.from('table').select('*');
 */

export async function getSupabaseModule() {
  return await import('./supabase-client');
}

export async function isDatabaseProviderConfigured() {
  const mod = await getSupabaseModule();
  return mod.isSupabaseConfigured();
}

export async function getDatabaseProviderRawClient() {
  const configured = await isDatabaseProviderConfigured();
  if (!configured) {
    throw new Error(
      'Supabase is not configured. Cannot initialize client without EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY environment variables.'
    );
  }
  const mod = await getSupabaseModule();
  return mod.getSupabaseClient();
}
