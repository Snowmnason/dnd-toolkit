# Database Schema — DnD Toolkit

Comprehensive documentation of the D&D Toolkit PostgreSQL schema, organized by 4 logical schemas.

---

## Architecture Overview

The database is organized into **4 schemas** for separation of concerns:

| Schema            | Purpose                                | Tables                                                                                             |
| ----------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **public**        | Core app identity & session management | users, user_settings, invite_links                                                                 |
| **worlds**        | Campaign worlds & access control       | worlds, world_access (+ world_access_role ENUM)                                                    |
| **feature_flags** | Feature control system                 | feature_flags, entitlements, entitlements_overrides, feature_flag_overrides, feature_flag_rollouts |
| **audit**         | Immutable audit log for compliance     | events                                                                                             |

---

# PUBLIC Schema

Core identity and session management.

## Tables

### public.users

**Purpose:** Internal user representation linked to Supabase Auth. One row per authenticated user; created on signup via Auth trigger.

**Key Design Points:**

- Separate from Supabase `auth.users` to allow custom user data
- `auth_id` enforces 1:1 relationship; CASCADE DELETE removes user on account deletion
- `isAdmin` flag for admin panel access (future)
- `username` defaults to 'changeling'; not unique; customizable in settings

**Fields:**

| Field        | Type      | Nullable | Default             | Purpose                                        |
| ------------ | --------- | -------- | ------------------- | ---------------------------------------------- |
| `id`         | uuid      | No       | `gen_random_uuid()` | Primary key; stable user identifier            |
| `auth_id`    | uuid      | No       | —                   | Foreign key to `auth.users.id`; 1:1 link       |
| `username`   | text      | No       | 'changeling'        | Display name; not unique; customizable         |
| `created_at` | timestamp | No       | current UTC         | Audit timestamp; account creation time         |
| `isAdmin`    | boolean   | No       | false               | Admin flag; reserved for future admin features |

**Constraints:**

- `users_pkey`: Primary key
- `users_auth_id_fkey`: Foreign key to auth.users.id (CASCADE DELETE)

_See [INDEXES.md](INDEXES.md) for index definitions._

---

### public.user_settings

**Purpose:** User preferences and account settings (theme, notifications, etc.).

**Key Design Points:**

- Optional extended user data without bloating main `users` table
- Future expansion: notifications, theme preferences, privacy settings
- Linked to users.id; deleted when user deleted (CASCADE)

**Fields:**

| Field        | Type      | Nullable | Default             | Purpose                                     |
| ------------ | --------- | -------- | ------------------- | ------------------------------------------- |
| `id`         | uuid      | No       | `gen_random_uuid()` | Primary key                                 |
| `user_id`    | uuid      | No       | —                   | Foreign key to `users.id` (CASCADE)         |
| `theme`      | text      | Yes      | 'dark'              | UI theme preference (dark, light, auto)     |
| `updated_at` | timestamp | No       | now()               | Audit timestamp; when settings last changed |

**Constraints:**

- `user_settings_pkey`: Primary key
- `user_settings_user_id_fkey`: Foreign key to users.id (CASCADE DELETE)

---

### public.invite_links

**Purpose:** Time-limited shareable invite tokens for joining worlds (24-hour expiry).

**Key Design Points:**

- Public table: unauthenticated users can query by token
- Token is UUID (strongly random); brute-force proof
- Expiration (24h) auto-expires stale invites
- `world_id` nullable for future org-level invites
- `created_by` for audit trails

**Fields:**

| Field        | Type      | Nullable | Default             | Purpose                                 |
| ------------ | --------- | -------- | ------------------- | --------------------------------------- |
| `id`         | uuid      | No       | `gen_random_uuid()` | Primary key                             |
| `world_id`   | uuid      | Yes      | null                | Foreign key to `worlds.worlds.world_id` |
| `created_by` | uuid      | Yes      | null                | Foreign key to `users.id`; audit trail  |
| `token`      | uuid      | No       | `gen_random_uuid()` | Unique shareable token                  |
| `expires_at` | timestamp | No       | now() + 24h         | Expiration time; queries filter by this |
| `created_at` | timestamp | Yes      | now()               | Audit timestamp; when generated         |

**Constraints:**

- `invite_links_pkey`: Primary key
- `invite_links_token_key`: Unique constraint on token
- `invite_links_created_by_fkey`: Foreign key (no CASCADE; invites persist)
- `invite_links_world_id_fkey`: Foreign key (CASCADE DELETE; deleting world removes invites)

_See [INDEXES.md](INDEXES.md) for index definitions._

---

# WORLDS Schema

Campaign worlds and access control.

## Enums

### worlds.world_access_role

**Purpose:** Defines the role types for world access grants.

**Values:**

- `'dm'` — Dungeon Master; owns the world; full control
- `'gm'` — Game Master; co-DM (future multi-DM support)
- `'player'` — Player character; normal participant
- `'spectator'` — Observer; can view but not participate (future)
- `'observer'` — Background observer; minimal permissions (future)

**SQL:**

```sql
CREATE TYPE worlds.world_access_role AS ENUM ('dm', 'gm', 'player', 'spectator', 'observer');
```

---

## Tables

### worlds.worlds

**Purpose:** Represents a D&D campaign world. Each world has one owner (DM) and multiple participants via `world_access`.

**Key Design Points:**

- One owner per world; future support for multi-DM via role transitions
- `system` stores game system ID (D&D 5e, Pathfinder 2e, etc.)
- `is_dm` reserved for future multi-DM; currently always true
- No soft delete; deletion cascades to `world_access` and related tables
- `map_image_url` optional for visual campaigns

**Fields:**

| Field           | Type      | Nullable | Default             | Purpose                                           |
| --------------- | --------- | -------- | ------------------- | ------------------------------------------------- |
| `world_id`      | uuid      | No       | `gen_random_uuid()` | Primary key; stable world reference               |
| `owner_id`      | uuid      | No       | —                   | Foreign key to `users.id`; world owner (DM)       |
| `name`          | text      | No       | 'World'             | Campaign name; displayed in UI                    |
| `description`   | text      | Yes      | ''                  | Campaign notes/lore; optional metadata            |
| `system`        | text      | Yes      | 'D&D 5e'            | Game system ID; determines rules/character sheets |
| `created_at`    | timestamp | Yes      | now()               | Audit timestamp                                   |
| `updated_at`    | timestamp | Yes      | now()               | Audit timestamp; cache invalidation trigger       |
| `map_image_url` | text      | Yes      | null                | Optional world map image URL                      |
| `is_dm`         | boolean   | No       | true                | Reserved for multi-DM support                     |

**Constraints:**

- `worlds_pkey`: Primary key
- `worlds_owner_id_fkey`: Foreign key to users.id (CASCADE DELETE)

_See [INDEXES.md](INDEXES.md) for index definitions._

---

### worlds.world_access

**Purpose:** Join table implementing role-based access control (RBAC). Each row grants a user specific access with a defined role.

**Key Design Points:**

- Flexible role system: `user_role` stored as `worlds.world_access_role` ENUM
- Unique constraint on `(world_id, user_id)` prevents duplicate memberships
- Optional `permissions` JSONB for future per-user capability overrides
- Cascading deletes ensure no orphaned access rows

**Fields:**

| Field         | Type                       | Nullable | Default             | Purpose                                      |
| ------------- | -------------------------- | -------- | ------------------- | -------------------------------------------- |
| `id`          | uuid                       | No       | `gen_random_uuid()` | Primary key; stable access grant ref         |
| `world_id`    | uuid                       | No       | —                   | Foreign key to `worlds.world_id`             |
| `user_id`     | uuid                       | No       | —                   | Foreign key to `users.id`                    |
| `user_role`   | `worlds.world_access_role` | No       | 'player'            | Role identifier (dm, player, spectator, etc) |
| `permissions` | jsonb                      | Yes      | null                | Future capability override structure         |
| `created_at`  | timestamp                  | No       | now()               | Audit timestamp; when user added to world    |

**Constraints:**

- `world_access_pkey`: Primary key
- `world_access_user_id_fkey`: Foreign key to users.id (CASCADE DELETE)
- `world_access_world_id_fkey`: Foreign key to worlds.world_id (CASCADE DELETE)
- `world_access_world_user_key`: Unique on `(world_id, user_id)` (prevents duplicates)

_See [INDEXES.md](INDEXES.md) and [TRIGGERS.md](TRIGGERS.md) for index and trigger definitions._

---

# FEATURE_FLAGS Schema

Feature control system with entitlements and overrides.

## Tables

### feature_flags.feature_flags

**Purpose:** Global feature flag definitions. Available to all users unless restricted by entitlements/overrides.

**Key Design Points:**

- `flag_name` is the unique identifier; used throughout app
- `kind` describes the type (boolean, percentage, string, etc.)
- All flags public by default; access control via RLS + entitlements
- `enabled` is the global default; overridden per-user via entitlements/overrides

**Fields:**

| Field         | Type      | Nullable | Default   | Purpose                                 |
| ------------- | --------- | -------- | --------- | --------------------------------------- |
| `flag_name`   | text      | No       | —         | Primary key; feature identifier         |
| `enabled`     | boolean   | No       | false     | Global default; overridable per-user    |
| `kind`        | text      | No       | 'boolean' | Type: boolean, percentage, string, etc. |
| `description` | text      | Yes      | ''        | Human-readable purpose & usage          |
| `created_at`  | timestamp | Yes      | now()     | Audit timestamp                         |
| `updated_at`  | timestamp | Yes      | now()     | Audit timestamp; cache invalidation     |

**Constraints:**

- `feature_flags_pkey`: Primary key on `flag_name`

_See [INDEXES.md](INDEXES.md) for index definitions._

---

### feature_flags.entitlements

**Purpose:** User feature entitlements with optional expiry and soft-delete support.

**Key Design Points:**

- Links `users.id` to entitlement `key` (references feature flag name)
- `is_active` soft-delete flag; marked false by background job when expired
- `remind_user` tracks whether user was reminded before expiry
- `expires_at` null = never expires; used for time-limited trials/promotions
- Unique constraint on `(user_id, key)` prevents duplicate entitlements

**Fields:**

| Field         | Type      | Nullable | Default             | Purpose                                      |
| ------------- | --------- | -------- | ------------------- | -------------------------------------------- |
| `id`          | uuid      | No       | `gen_random_uuid()` | Primary key; stable entitlement ref          |
| `user_id`     | uuid      | No       | —                   | Foreign key to `users.id`                    |
| `key`         | text      | No       | —                   | Entitlement key (feature flag name)          |
| `is_active`   | boolean   | No       | true                | Soft-delete flag; false = revoked/expired    |
| `remind_user` | boolean   | No       | false               | True = user should be reminded before expiry |
| `created_at`  | timestamp | No       | now()               | Audit timestamp; when granted                |
| `updated_at`  | timestamp | No       | now()               | Audit timestamp; when modified               |
| `expires_at`  | timestamp | Yes      | null                | Expiry time (null = never); cleanup trigger  |

**Constraints:**

- `entitlements_pkey`: Primary key
- `entitlements_user_id_fkey`: Foreign key to users.id (CASCADE DELETE)
- `entitlements_user_key_key`: Unique on `(user_id, key)` (prevents duplicates)
- `entitlements_key_key`: **Org-wide unique** on `(key)` WHERE `user_id IS NULL` (org-level entitlements)

_See [INDEXES.md](INDEXES.md) for index definitions._

---

### feature_flags.entitlements_overrides

**Purpose:** Admin-created temporary grants/revokes of entitlements, independent of base entitlements.

**Key Design Points:**

- `action: 'grant'` = admin grants; `'revoke'` = admin revokes
- `expires_at` independent from base entitlement expiry
- `revoked` soft-delete flag (admin can unrevoke or let expire)
- Allows fine-grained admin control for testing/special cases

**Fields:**

| Field         | Type      | Nullable | Default             | Purpose                                        |
| ------------- | --------- | -------- | ------------------- | ---------------------------------------------- |
| `id`          | uuid      | No       | `gen_random_uuid()` | Primary key                                    |
| `user_id`     | uuid      | No       | —                   | Foreign key to `users.id`                      |
| `target_name` | text      | No       | —                   | Entitlement key being overridden               |
| `action`      | text      | No       | —                   | 'grant' or 'revoke' (admin action)             |
| `expires_at`  | timestamp | Yes      | null                | Override expiry (independent of base)          |
| `revoked`     | boolean   | No       | false               | Soft-delete flag                               |
| `reason`      | text      | Yes      | null                | Admin reason for override                      |
| `created_by`  | uuid      | Yes      | null                | Foreign key to `users.id`; which admin created |
| `created_at`  | timestamp | No       | now()               | Audit timestamp                                |
| `updated_at`  | timestamp | No       | now()               | Audit timestamp                                |

**Constraints:**

- `entitlements_overrides_pkey`: Primary key
- `entitlements_overrides_user_id_fkey`: Foreign key to users.id (CASCADE DELETE)
- `entitlements_overrides_created_by_fkey`: Foreign key to users.id (no CASCADE; preserves admin audit)

_See [INDEXES.md](INDEXES.md) for index definitions._

---

### feature_flags.feature_flag_overrides

**Purpose:** Per-user feature flag overrides (admin testing, A/B testing, etc.).

**Key Design Points:**

- Simplified schema (003 redesign): only flags, not entitlements
- `target_name` is the feature flag name being overridden
- `enabled` true/false can override global flag default
- `revoked` soft-delete; `expires_at` for time-limited overrides
- Unique constraint on `(user_id, target_name)` prevents duplicate overrides

**Fields:**

| Field         | Type      | Nullable | Default             | Purpose                                |
| ------------- | --------- | -------- | ------------------- | -------------------------------------- |
| `id`          | uuid      | No       | `gen_random_uuid()` | Primary key                            |
| `user_id`     | uuid      | No       | —                   | Foreign key to `users.id`              |
| `target_name` | text      | No       | —                   | Feature flag name being overridden     |
| `enabled`     | boolean   | No       | —                   | Override value (true/false)            |
| `expires_at`  | timestamp | Yes      | null                | Override expiry (null = permanent)     |
| `revoked`     | boolean   | No       | false               | Soft-delete flag                       |
| `reason`      | text      | Yes      | null                | Admin reason for override              |
| `created_by`  | uuid      | Yes      | null                | Foreign key to `users.id`; which admin |
| `created_at`  | timestamp | No       | now()               | Audit timestamp                        |
| `updated_at`  | timestamp | No       | now()               | Audit timestamp                        |

**Constraints:**

- `feature_flag_overrides_pkey`: Primary key
- `feature_flag_overrides_user_id_fkey`: Foreign key to users.id (CASCADE DELETE)
- `feature_flag_overrides_created_by_fkey`: Foreign key to users.id (no CASCADE)
- `feature_flag_overrides_user_target_key`: Unique on `(user_id, target_name)` (prevents duplicates)

_See [INDEXES.md](INDEXES.md) for index definitions._

---

### feature_flags.feature_flag_rollouts

**Purpose:** A/B rollout configuration for gradual feature releases.

**Key Design Points:**

- `percentage: 0-100` controls rollout %
- `seed` optional for consistent bucketing across rebalances
- `is_active` enables/disables rollout without deleting config
- Client applies rollout logic: `userHash % 100 < percentage`

**Fields:**

| Field        | Type      | Nullable | Default             | Purpose                                   |
| ------------ | --------- | -------- | ------------------- | ----------------------------------------- |
| `id`         | uuid      | No       | `gen_random_uuid()` | Primary key                               |
| `flag_name`  | text      | No       | —                   | Feature flag name; links to feature_flags |
| `percentage` | integer   | No       | —                   | Rollout % (0-100); client bucketing rule  |
| `seed`       | text      | Yes      | null                | Optional seed for consistent bucketing    |
| `is_active`  | boolean   | No       | true                | Enable/disable rollout without deleting   |
| `created_at` | timestamp | No       | now()               | Audit timestamp                           |
| `updated_at` | timestamp | No       | now()               | Audit timestamp                           |

**Constraints:**

- `feature_flag_rollouts_pkey`: Primary key
- `feature_flag_rollouts_flag_name_fkey`: Foreign key to feature_flags.flag_name (CASCADE DELETE)

_See [INDEXES.md](INDEXES.md) for index definitions._

---

# AUDIT Schema

Immutable audit log for compliance and debugging.

## Tables

### audit.events

**Purpose:** Unified immutable audit log capturing all INSERT/UPDATE/DELETE operations across tracked tables.

**Key Design Points:**

- No foreign keys intentionally; audit records persist after source data deletion
- `table_schema` + `table_name` + `record_id` identifies the affected row
- `initiated_by` null for service_role or system operations
- `old_data`/`new_data` JSONB snapshots enable full historical reconstruction
- Only writable via SECURITY DEFINER triggers; not directly by API

**Fields:**

| Field          | Type      | Nullable | Default             | Purpose                                           |
| -------------- | --------- | -------- | ------------------- | ------------------------------------------------- |
| `id`           | uuid      | No       | `gen_random_uuid()` | Primary key; unique audit event ID                |
| `table_schema` | text      | No       | —                   | Source schema (public, worlds, feature_flags)     |
| `table_name`   | text      | No       | —                   | Source table name                                 |
| `record_id`    | text      | No       | —                   | PK of affected row (text handles uuid/text)       |
| `event_type`   | text      | No       | —                   | 'insert', 'update', or 'delete'                   |
| `initiated_by` | uuid      | Yes      | null                | User who initiated change (null for service_role) |
| `old_data`     | jsonb     | Yes      | null                | Row state before UPDATE/DELETE (null on INSERT)   |
| `new_data`     | jsonb     | Yes      | null                | Row state after INSERT/UPDATE (null on DELETE)    |
| `created_at`   | timestamp | No       | now()               | Audit timestamp; when event was logged            |

**Constraints:**

- `audit_events_pkey`: Primary key

_See [INDEXES.md](INDEXES.md) for index definitions._

---

## Tracked Tables (Audit Triggers)

Audit triggers attached to all tables in: public, worlds, feature_flags schemas.

**Public Schema:**

- public.users
- public.user_settings
- public.invite_links

**Worlds Schema:**

- worlds.worlds
- worlds.world_access

**Feature_Flags Schema:**

- feature_flags.feature_flags
- feature_flags.entitlements
- feature_flags.entitlements_overrides
- feature_flags.feature_flag_overrides
- feature_flags.feature_flag_rollouts

_See [TRIGGERS.md](TRIGGERS.md) for trigger implementation._

---

## Migration & Version Notes

These schemas represent the **Phase 1 complete** database design (migrations 001-004). Key features:

- ✅ Multi-schema architecture (separation of concerns)
- ✅ RBAC with flexible roles (future multi-DM support)
- ✅ Feature flags with entitlements & overrides
- ✅ A/B rollout support
- ✅ Immutable audit trail
- ✅ Soft-delete support for entitlements
- ✅ Admin override system for testing

_See [INDEXES.md](INDEXES.md), [RLS.md](RLS.md), [TRIGGERS.md](TRIGGERS.md), and [EDGE_FUNCTIONS.md](EDGE_FUNCTIONS.md) for supporting infrastructure._

---

_Last Updated: Feb 8, 2026 (Post-Migration 001-004)_
