# Database Schema — DnD Toolkit

Complete schema documentation matching migrations 001–004. Source of truth: `supabase/migrations/`.

---

## PUBLIC Schema (001_public_schema.sql)

### public.users

Core identity table bridging Supabase `auth.users` to app data. One row per authenticated user; auto-created on signup via trigger.

| Column       | Type        | Nullable | Default             | Notes                                       |
| ------------ | ----------- | -------- | ------------------- | ------------------------------------------- |
| `id`         | uuid        | No       | `gen_random_uuid()` | PK — stable internal user ID               |
| `auth_id`    | uuid        | No       | —                   | FK → `auth.users(id)` ON UPDATE/DELETE CASCADE; UNIQUE |
| `username`   | text        | No       | `'changeling'`      | Display name; CHECK: `length(trim(username)) > 0` |
| `is_admin`   | boolean     | No       | `false`             | Admin flag; checked by `public.is_admin()`  |
| `created_at` | timestamptz | No       | `now()`             | Account creation time                       |
| `updated_at` | timestamptz | No       | `now()`             | Auto-updated by trigger                     |
| `deleted_at` | timestamptz | Yes      | `NULL`              | Soft-delete; NULL = active                  |

### public.user_settings

Per-user preferences. One row per user; auto-created on signup via trigger.

| Column        | Type        | Nullable | Default  | Notes                                    |
| ------------- | ----------- | -------- | -------- | ---------------------------------------- |
| `user_id`     | uuid        | No       | —        | PK + FK → `users(id)` ON DELETE CASCADE  |
| `theme`       | text        | No       | `'auto'` | CHECK: `theme IN ('light', 'dark', 'auto')` |
| `language`    | text        | No       | `'en'`   | Language preference                       |
| `timezone`    | text        | No       | `'UTC'`  | Timezone preference                       |
| `preferences` | jsonb       | No       | `'{}'`   | Future: notifications, accessibility      |
| `updated_at`  | timestamptz | No       | `now()`  | Auto-updated by trigger                   |

### Utility Functions

| Function | Returns | Purpose |
| --- | --- | --- |
| `public.update_timestamp()` | trigger | Generic `BEFORE UPDATE` trigger; sets `updated_at = now()` only if row data actually changed |
| `public.get_current_user_id()` | uuid | Returns internal `users.id` for current auth session; excludes soft-deleted users; SECURITY DEFINER |
| `public.get_user_auth_id(p_user_id uuid)` | uuid | Maps `users.id` → `auth_id`; SECURITY DEFINER |
| `public.is_admin()` | boolean | Returns `true` if current auth user has `is_admin = true`; checks DB not JWT; SECURITY DEFINER |
| `public.handle_new_user()` | trigger | Auth signup trigger on `auth.users`; creates `users` row + `user_settings` row; idempotent via ON CONFLICT |

---

## WORLDS Schema (002_worlds_schema.sql)

### worlds.world_access_role (ENUM)

```sql
CREATE TYPE worlds.world_access_role AS ENUM ('dm', 'gm', 'player', 'spectator', 'observer');
```

| Value        | Description                                                |
| ------------ | ---------------------------------------------------------- |
| `dm`         | Owner/full authority; can delete/modify worlds             |
| `gm`         | Co-owner; same visibility as DM, cannot delete worlds      |
| `player`     | Limited visibility; can edit own character data             |
| `spectator`  | Read-only with DM view (sharing modules between DMs)       |
| `observer`   | Read-only with player view (sharing character data)        |

### worlds.worlds

Represents a D&D campaign world. One owner per world.

| Column          | Type        | Nullable | Default             | Notes                                                |
| --------------- | ----------- | -------- | ------------------- | ---------------------------------------------------- |
| `world_id`      | uuid        | No       | `gen_random_uuid()` | PK                                                   |
| `owner_id`      | uuid        | No       | —                   | FK → `public.users(id)` ON UPDATE/DELETE CASCADE     |
| `name`          | text        | No       | `'World'`           | CHECK: `length(trim(name)) > 0`                     |
| `description`   | text        | Yes      | `''`                | Campaign notes/lore                                  |
| `system`        | text        | Yes      | `'D&D 5e'`          | Game system ID                                       |
| `is_dm`         | boolean     | No       | `true`              | Reserved for future multi-DM support                 |
| `map_image_url` | text        | Yes      | `NULL`              | Optional world map image URL                         |
| `settings`      | jsonb       | No       | `'{}'`              | Extensible: homebrew rules, preferences              |
| `created_at`    | timestamptz | No       | `now()`             | —                                                    |
| `updated_at`    | timestamptz | No       | `now()`             | Auto-updated by trigger                              |
| `deleted_at`    | timestamptz | Yes      | `NULL`              | Soft-delete; NULL = active; filtered by RLS          |

**Trigger**: `trg_prevent_owner_change` — prevents changing `owner_id` via UPDATE.

### worlds.world_access

RBAC join table. One row per (world, user) pair. Owner gets auto-created row with role `'dm'`.

| Column        | Type                     | Nullable | Default             | Notes                                    |
| ------------- | ------------------------ | -------- | ------------------- | ---------------------------------------- |
| `id`          | uuid                     | No       | `gen_random_uuid()` | PK                                       |
| `world_id`    | uuid                     | No       | —                   | FK → `worlds(world_id)` ON DELETE CASCADE |
| `user_id`     | uuid                     | No       | —                   | FK → `public.users(id)` ON DELETE CASCADE |
| `user_role`   | `worlds.world_access_role` | No     | `'player'`          | Role for this membership                 |
| `permissions` | jsonb                    | Yes      | `NULL`              | Future: per-user capability overrides    |
| `created_at`  | timestamptz              | No       | `now()`             | —                                        |
| `updated_at`  | timestamptz              | No       | `now()`             | Auto-updated by trigger                  |

**Unique**: `(world_id, user_id)` — one membership per user per world.

### worlds.invite_links

Time-limited shareable invite tokens for joining worlds.

| Column       | Type        | Nullable | Default                        | Notes                                         |
| ------------ | ----------- | -------- | ------------------------------ | --------------------------------------------- |
| `id`         | uuid        | No       | `gen_random_uuid()`            | PK                                            |
| `world_id`   | uuid        | No       | —                              | FK → `worlds(world_id)` ON DELETE CASCADE     |
| `created_by` | uuid        | Yes      | `NULL`                         | FK → `public.users(id)` ON DELETE SET NULL    |
| `token`      | uuid        | No       | `gen_random_uuid()`            | UNIQUE; shareable invite token                |
| `expires_at` | timestamptz | No       | `now() + interval '24 hours'`  | Expiration time                               |
| `created_at` | timestamptz | No       | `now()`                        | —                                             |

### RPC Functions (worlds schema)

| Function | Purpose |
| --- | --- |
| `worlds.resolve_invite_token(p_token uuid)` | Resolves token → world_id (SECURITY DEFINER; available to anon) |
| `worlds.create_invite_link(p_world_id, p_hours_valid)` | Creates invite link (owner/admin only; 1–168 hours) |
| `worlds.delete_invite_link(p_token uuid)` | Deletes invite by token (owner/admin only; no-op if not found) |
| `worlds.get_world_owner_auth_id(p_world_id uuid)` | Returns auth_id of world owner |
| `worlds.user_owns_world(p_user_id, p_world_id)` | Returns true if user owns active world |
| `worlds.user_has_access(p_user_id, p_world_id)` | Returns true if user is owner OR member of active world |
| `worlds.change_user_role(p_world_id, p_target_user_id, p_new_role)` | Change member role (owner/GM only; validates permissions) |
| `worlds.join_world_with_invite(p_world_id, p_token, p_user_role)` | Join world via invite token (player/spectator/observer only) |
| `worlds.leave_world(p_world_id)` | Remove current user's membership (owners cannot leave) |

---

## FEATURE_FLAG Schema (003_feature_flags_schema.sql)

### feature_flag.feature_flags

Master list of feature flags. Resolution order: overrides > entitlements > rollouts > `enabled`.

| Column        | Type        | Nullable | Default | Notes                                   |
| ------------- | ----------- | -------- | ------- | --------------------------------------- |
| `flag_name`   | text        | No       | —       | PK — unique flag identifier             |
| `enabled`     | boolean     | No       | `false` | Global default; overridable per-user    |
| `kind`        | text        | No       | —       | Type: `'boolean'`, `'string'`, `'percentage'`, `'entitlement'` |
| `description` | text        | Yes      | `NULL`  | Human-readable purpose                  |
| `created_at`  | timestamptz | No       | `now()` | —                                       |
| `updated_at`  | timestamptz | No       | `now()` | Auto-updated by trigger                 |

### feature_flag.entitlements

User capability unlocks (premium, beta, etc.). Can be permanent or temporary.

| Column        | Type        | Nullable | Default             | Notes                                               |
| ------------- | ----------- | -------- | ------------------- | --------------------------------------------------- |
| `id`          | uuid        | No       | `gen_random_uuid()` | PK                                                  |
| `user_id`     | uuid        | Yes      | —                   | FK → `public.users(id)` ON DELETE CASCADE; NULL for org-wide |
| `key`         | text        | No       | —                   | Entitlement identifier (e.g., `'premium_subscription'`) |
| `is_active`   | boolean     | No       | `true`              | Manual revoke + auto-marked false when expired       |
| `remind_user` | boolean     | No       | `false`             | Flag to prompt user for renewal                      |
| `created_at`  | timestamptz | No       | `now()`             | —                                                    |
| `updated_at`  | timestamptz | No       | `now()`             | Auto-updated by trigger                              |
| `expires_at`  | timestamptz | Yes      | `NULL`              | NULL = permanent; CHECK: `expires_at > created_at`   |

**Constraints**: UNIQUE `(user_id, key)`; partial UNIQUE on `(key) WHERE user_id IS NULL` for org-wide.

### feature_flag.feature_flag_overrides

Admin tool to override feature flags per user.

| Column       | Type        | Nullable | Default             | Notes                                                    |
| ------------ | ----------- | -------- | ------------------- | -------------------------------------------------------- |
| `id`         | uuid        | No       | `gen_random_uuid()` | PK                                                       |
| `user_id`    | uuid        | No       | —                   | FK → `public.users(id)` ON DELETE CASCADE                |
| `flag_name`  | text        | No       | —                   | FK → `feature_flags(flag_name)` ON UPDATE/DELETE CASCADE |
| `enabled`    | boolean     | No       | —                   | true = force ON, false = force OFF                       |
| `expires_at` | timestamptz | Yes      | `NULL`              | NULL = permanent override                                |
| `reason`     | text        | Yes      | `NULL`              | Admin notes                                              |
| `created_by` | uuid        | Yes      | `NULL`              | FK → `public.users(id)` ON DELETE SET NULL               |
| `created_at` | timestamptz | No       | `now()`             | —                                                        |
| `updated_at` | timestamptz | No       | `now()`             | Auto-updated by trigger                                  |
| `revoked`    | boolean     | No       | `false`             | Soft-revoke for audit trail                              |

**Unique**: `(user_id, flag_name)` — one override per user per flag.

### feature_flag.entitlements_overrides

Admin tool to temporarily grant/revoke entitlements.

| Column            | Type        | Nullable | Default             | Notes                                      |
| ----------------- | ----------- | -------- | ------------------- | ------------------------------------------ |
| `id`              | uuid        | No       | `gen_random_uuid()` | PK                                         |
| `user_id`         | uuid        | No       | —                   | FK → `public.users(id)` ON DELETE CASCADE  |
| `entitlement_key` | text        | No       | —                   | The entitlement key being overridden       |
| `is_active`       | boolean     | No       | —                   | true = force grant, false = force revoke   |
| `expires_at`      | timestamptz | Yes      | `NULL`              | NULL = permanent override                  |
| `reason`          | text        | Yes      | `NULL`              | Admin notes                                |
| `created_by`      | uuid        | Yes      | `NULL`              | FK → `public.users(id)` ON DELETE SET NULL |
| `created_at`      | timestamptz | No       | `now()`             | —                                          |
| `updated_at`      | timestamptz | No       | `now()`             | Auto-updated by trigger                    |
| `revoked`         | boolean     | No       | `false`             | Soft-revoke for audit trail                |

**Unique**: `(user_id, entitlement_key)` — one override per user per key.

### feature_flag.feature_flag_rollouts

Percentage-based A/B rollout. Users bucketed by FNV-1a hash of (user_id + seed).

| Column        | Type        | Nullable | Default             | Notes                                                    |
| ------------- | ----------- | -------- | ------------------- | -------------------------------------------------------- |
| `id`          | uuid        | No       | `gen_random_uuid()` | PK                                                       |
| `flag_name`   | text        | No       | —                   | FK → `feature_flags(flag_name)` ON UPDATE/DELETE CASCADE; UNIQUE |
| `percentage`  | smallint    | No       | —                   | 0–100; CHECK enforced                                    |
| `seed`        | text        | Yes      | `NULL`              | Optional re-seed to re-bucket users                      |
| `created_at`  | timestamptz | No       | `now()`             | —                                                        |
| `updated_at`  | timestamptz | No       | `now()`             | Auto-updated by trigger                                  |
| `created_by`  | uuid        | Yes      | `NULL`              | FK → `public.users(id)` ON DELETE SET NULL               |
| `description` | text        | Yes      | `NULL`              | —                                                        |
| `is_active`   | boolean     | No       | `true`              | Enable/disable without deleting                          |

### Helper Functions

| Function | Purpose |
| --- | --- |
| `feature_flag.mark_expired_entitlements_inactive()` | Sets `is_active = false` for expired entitlements; call via cron/app code |

---

## AUDIT Schema (004_audit_schema.sql)

### audit.audit_events

Unified immutable audit log. No foreign keys intentionally — records persist after source data deletion.

| Column         | Type        | Nullable | Default             | Notes                                          |
| -------------- | ----------- | -------- | ------------------- | ---------------------------------------------- |
| `id`           | uuid        | No       | `gen_random_uuid()` | PK                                             |
| `table_schema` | text        | No       | —                   | Source schema: `public`, `worlds`, `feature_flag` |
| `table_name`   | text        | No       | —                   | Source table name                              |
| `record_id`    | text        | No       | —                   | PK of affected row (text to handle uuid/text)  |
| `event_type`   | text        | No       | —                   | `'insert'`, `'update'`, `'delete'`             |
| `initiated_by` | uuid        | Yes      | `NULL`              | `public.users.id`; NULL for service_role/system |
| `old_data`     | jsonb       | Yes      | `NULL`              | Row state before change (NULL on INSERT)       |
| `new_data`     | jsonb       | Yes      | `NULL`              | Row state after change (NULL on DELETE)         |
| `created_at`   | timestamptz | No       | `now()`             | When the audit event was recorded              |

### audit.log_change() (Trigger Function)

Generic SECURITY DEFINER trigger function. Auto-detects schema, table, and PK (tries `id`, `world_id`, `user_id`, `flag_name`, `key`). Attached to all tracked tables via `AFTER INSERT OR UPDATE OR DELETE` triggers.

**Tracked tables**: `public.users`, `public.user_settings`, `worlds.worlds`, `worlds.world_access`, `worlds.invite_links`, `feature_flags.feature_flags`, `feature_flags.entitlements`, `feature_flags.entitlements_overrides`, `feature_flags.feature_flag_overrides`, `feature_flags.feature_flag_rollouts`

---

_Last Updated: Feb 11, 2026 (Post-Audit — matches migrations 001–004)_