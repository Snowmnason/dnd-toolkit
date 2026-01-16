# Supabase Import Migration — Pattern & Checklist

## Summary
- Goal: Stop proxy logging spam and make imports explicit and scalable.
- Approach: Keep direct `supabase` usage inside `lib/database/` (DB abstraction layer). Everywhere else use `getSupabaseClient()` + `isSupabaseConfigured()` guards.

## Why this pattern
- The database layer is the canonical place for direct DB access; it can safely import `supabase` directly.
- Higher-level modules (auth, settings, UI handlers) should explicitly check configuration and obtain a client to avoid accidental proxy invocation and noisy warnings when Supabase is not configured (e.g., GH Pages or local dev without env).

## Recommended code patterns

- Database layer (example: `lib/database/*.ts`)
```ts
  import { supabase } from './supabase';

  // use supabase.* directly inside functions
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', authId)
    .single();
```
- Consumer layer (example: `lib/auth/*`, `lib/settings/*`)
```ts
  import { getSupabaseClient, isSupabaseConfigured } from '@/lib/database/supabase';

  if (!isSupabaseConfigured()) {
    // handle offline/unconfigured case (log, return user-friendly error)
    return { success: false, error: 'Unable to connect to servers.' };
  }
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
```
## Checklist for migrating a file
 - Ensure non-database files import only `getSupabaseClient` and `isSupabaseConfigured`.
 - Add a guard at function entry before any `supabase` usage.
 - Use `getSupabaseClient()` to obtain the client after the guard.
 - Keep direct `supabase` imports only in `lib/database/` modules.
 - Run `npm run typecheck` after edits.

## Files migrated in this change
- Non-database (now use guards + getter):
  - lib/settings/deleteAccount.ts
  - lib/settings/signOut.ts
  - lib/auth/authService.ts
  - lib/auth/useResetPasswordConfirm.ts
  - lib/auth/sessionService.ts

- Database layer (keep direct import):
  - lib/database/common.ts
  - lib/database/invites.ts
  - lib/database/users.ts
  - lib/database/worlds.ts

### Notes
- Use friendly error returns when appropriate; prefer throwing only where callers expect exceptions.
- Prefer non-blocking behavior for optional flows (e.g., signing out during a local cleanup) and fail-open when safe.

If you want, I can also add small code examples to existing developer docs (`docs/implem guide.md`) linking to this file.
