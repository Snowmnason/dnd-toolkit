/**
 * Lazy-loading wrapper for the Supabase database module.
 * Use this in UI/route/auth layers to avoid statically importing the Supabase client
 * in environments that may not have env vars configured (e.g., GH Pages demo).
 *
 * The /lib/database modules themselves (e.g., users.ts, common.ts) can and should
 * use static imports of supabase.ts since they are the authoritative data layer.
 *
 * Usage:
 *   if (!await isSupabaseConfiguredLazy()) { return handleOfflineMode(); }
 *   const supabase = await getSupabaseClientLazy();
 *   const { data } = await supabase.from('table').select('*');
 */

export async function getSupabaseModule() {
  return await import('./supabase');
}

export async function isSupabaseConfiguredLazy() {
  const mod = await getSupabaseModule();
  return mod.isSupabaseConfigured();
}

export async function getSupabaseClientLazy() {
  const configured = await isSupabaseConfiguredLazy();
  if (!configured) {
    throw new Error(
      'Supabase is not configured. Cannot initialize client without EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY environment variables.'
    );
  }
  const mod = await getSupabaseModule();
  return mod.getSupabaseClient();
}
