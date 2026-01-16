/**
 * Lazy-loading wrapper for the Supabase database module.
 * Use this in UI/route/auth layers to avoid statically importing the Supabase client
 * in environments that may not have env vars configured (e.g., GH Pages demo).
 *
 * The /lib/database modules themselves (e.g., users.ts, common.ts) can and should
 * use static imports of supabase.ts since they are the authoritative data layer.
 *
 * Usage:
 *   const { getSupabaseClient, isSupabaseConfigured } = await getSupabaseModule();
 *   if (!isSupabaseConfigured()) { /* handle gracefully }
 *   const client = getSupabaseClient();
 **/

export async function getSupabaseModule() {
  return await import('./supabase');
}

export async function getSupabaseClientLazy() {
  const mod = await getSupabaseModule();
  return mod.getSupabaseClient();
}

export async function isSupabaseConfiguredLazy() {
  const mod = await getSupabaseModule();
  return mod.isSupabaseConfigured();
}
