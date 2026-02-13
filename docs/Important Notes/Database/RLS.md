# Row Level Security (RLS) Policies — DnD Toolkit

All policies documented here match migrations 001–004. Source of truth: `supabase/migrations/`.

**Key pattern**: Admin checks use `public.is_admin()` (queries DB), **never** `auth.jwt()->>'role'`. User identity is resolved via `public.get_current_user_id()` (maps `auth.uid()` → internal `users.id`, excludes soft-deleted users).

---

## PUBLIC Schema (001)

All tables have RLS enabled.

### public.users

| Policy | Command | Role | Condition |
| --- | --- | --- | --- |
| `users_select_own` | SELECT | authenticated | `auth_id = auth.uid() AND deleted_at IS NULL` |
| `users_update_own` | UPDATE | authenticated | Own row, not soft-deleted |
| `users_delete_own` | DELETE | authenticated | Own row (initiates soft/hard delete) |
| `users_admin_full_access` | ALL | authenticated | `public.is_admin()` |

No INSERT policy — rows are created by the `handle_new_user()` auth trigger.

### public.user_settings

| Policy | Command | Role | Condition |
| --- | --- | --- | --- |
| `user_settings_select_own` | SELECT | authenticated | `user_id = get_current_user_id()` |
| `user_settings_update_own` | UPDATE | authenticated | Own row |
| `user_settings_admin_full_access` | ALL | authenticated | `public.is_admin()` |

No INSERT policy — rows are created by the `handle_new_user()` auth trigger.

Note: The `public.user_settings` table includes a `remind_user` boolean column (default `true`) which controls whether the user receives entitlement reminders. Existing owner/update policies apply — users may read and update their own `remind_user` value via the standard `user_settings_update_own` policy.

---

## WORLDS Schema (002)

All tables have RLS enabled: `worlds.worlds`, `worlds.world_access`, `worlds.invite_links`.

### worlds.worlds

| Policy | Command | Role | Condition |
| --- | --- | --- | --- |
| `select_if_owner_or_member` | SELECT | all | `deleted_at IS NULL AND (owner = current_user OR EXISTS in world_access)` |
| `worlds_owner_write` | ALL | all | `owner_id = get_current_user_id()` (USING + WITH CHECK) |

The SELECT policy explicitly filters `deleted_at IS NULL` + checks `owner_id` or membership in `world_access`. The ALL policy covers INSERT/UPDATE/DELETE for the owner.

### worlds.world_access

| Policy | Command | Role | Condition |
| --- | --- | --- | --- |
| `world_access_roster_select` | SELECT | authenticated | `worlds.user_has_access(get_current_user_id(), world_id)` |
| `deny_updates` | UPDATE | authenticated | `USING (false)` — blocked |
| `deny_deletes` | DELETE | authenticated | `USING (false)` — blocked |

**No INSERT policy** — client-side inserts are implicitly denied. All membership changes go through SECURITY DEFINER RPC functions (`join_world_with_invite`, `change_user_role`, `leave_world`).

The previous `allow_self` policy was removed as a redundant subset of `world_access_roster_select`.

### worlds.invite_links

| Policy | Command | Role | Condition |
| --- | --- | --- | --- |
| `invite_links_owner_select` | SELECT | authenticated | Creator or world owner |
| `invite_links_delete_owner` | DELETE | authenticated | World owner |
| `invite_links_admin_all` | ALL | authenticated | `public.is_admin()` |

No public SELECT — anon access is via `worlds.resolve_invite_token()` RPC.
No INSERT policy — invites created via `worlds.create_invite_link()` RPC.

---

## FEATURE_FLAG Schema (003)

All tables have RLS enabled.

### feature_flag.feature_flags

| Policy | Command | Role | Condition |
| --- | --- | --- | --- |
| `feature_flags_public_read` | SELECT | PUBLIC | `true` (anyone can read flags) |
| `feature_flags_admin_update` | UPDATE | authenticated | `public.is_admin()` |
| `feature_flags_admin_delete` | DELETE | authenticated | `public.is_admin()` |

No INSERT policy — flags created via server-side/Edge Functions only.

### feature_flag.entitlements

| Policy | Command | Role | Condition |
| --- | --- | --- | --- |
| `entitlements_user_read_own` | SELECT | authenticated | `user_id = get_current_user_id()` |
| `entitlements_admin_full_access` | ALL | authenticated | `public.is_admin()` |

### feature_flag.entitlements_overrides

| Policy | Command | Role | Condition |
| --- | --- | --- | --- |
| `entitlements_overrides_user_read_own` | SELECT | authenticated | `user_id = get_current_user_id()` |
| `entitlements_overrides_admin_update` | UPDATE | authenticated | `public.is_admin()` |
| `entitlements_overrides_admin_delete` | DELETE | authenticated | `public.is_admin()` |

No INSERT policy — overrides created server-side only.

### feature_flag.feature_flag_overrides

| Policy | Command | Role | Condition |
| --- | --- | --- | --- |
| `overrides_user_read_own` | SELECT | authenticated | `user_id = get_current_user_id()` |
| `overrides_admin_update` | UPDATE | authenticated | `public.is_admin()` |
| `overrides_admin_delete` | DELETE | authenticated | `public.is_admin()` |

No INSERT policy — overrides created server-side only.

### feature_flag.feature_flag_rollouts

| Policy | Command | Role | Condition |
| --- | --- | --- | --- |
| `rollouts_authenticated_read` | SELECT | authenticated | `true` (needed for client-side bucketing) |
| `rollouts_admin_update` | UPDATE | authenticated | `public.is_admin()` |
| `rollouts_admin_delete` | DELETE | authenticated | `public.is_admin()` |

No INSERT policy — rollouts created server-side only.

---

## AUDIT Schema (004)

### audit.audit_events

| Policy | Command | Role | Condition |
| --- | --- | --- | --- |
| `audit_admin_select` | SELECT | authenticated | `public.is_admin()` |
| `audit_own_select` | SELECT | authenticated | `initiated_by = get_current_user_id()` |

No INSERT/UPDATE/DELETE policies — all writes go through the `audit.log_change()` SECURITY DEFINER trigger function.

---

## Design Principles

1. **No JWT role checks** — all admin checks use `public.is_admin()` which queries the DB.
2. **No recursion** — `world_access` policies call `worlds.user_has_access()` (SECURITY DEFINER), which queries `worlds` and `world_access` without re-triggering RLS.
3. **Server-side writes** — tables that don't need client-side INSERT have no INSERT policies (implicitly denied). Changes go through SECURITY DEFINER RPCs.
4. **Soft-delete awareness** — `get_current_user_id()` excludes deleted users; `select_if_owner_or_member` checks `deleted_at IS NULL`.

---

_Last Updated: Feb 11, 2026 (Post-Audit — matches migrations 001–004)_