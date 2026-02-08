# Database Schema

This document captures the core Postgres tables, indexes, and row level security (RLS) policies for the D&D Toolkit backend, organized by schema.

**Schema Organization:**

- **Public Schema** — Core app tables (worlds, users, world_access, invite_links)
- **Feature_Flags Schema** — Feature control tables (feature_flags, entitlements, overrides, rollouts)

---

# Public Schema

Core application tables for worlds, users, and access control.

## Tables

### worlds

**Purpose:** Represents a D&D campaign world. Each world belongs to an owner (DM) and can have multiple players with varying access levels managed through the `world_access` table.

**Key Design Points:**

- One owner per world; collaborators/players added via `world_access` join table
- `is_dm` currently defaults to true but intended for future multi-DM worlds
- `system` stores game system identifier (D&D 5e, Pathfinder 2e, etc.) for rules/data filtering
- Soft delete not implemented; deletion cascades to `world_access` and related tables

**Fields:**

| Field           | Type      | Nullable | Default             | Purpose                                                                                   |
| --------------- | --------- | -------- | ------------------- | ----------------------------------------------------------------------------------------- |
| `world_id`      | uuid      | No       | `gen_random_uuid()` | Primary key; stable reference for world across requests                                   |
| `owner_id`      | uuid      | No       | —                   | Foreign key to `users.id`; enforces exactly one owner; cascades on delete                 |
| `name`          | text      | No       | 'World'             | User-friendly campaign name; displayed in UI                                              |
| `description`   | text      | Yes      | ''                  | Campaign notes/lore; optional metadata                                                    |
| `system`        | text      | Yes      | 'D&D 5e'            | Game system identifier; used to determine rules modules & character sheets                |
| `created_at`    | timestamp | Yes      | current UTC         | Audit timestamp; useful for sorting newly created worlds                                  |
| `updated_at`    | timestamp | Yes      | current UTC         | Audit timestamp; tracks campaign edits; used for cache invalidation                       |
| `map_image_url` | text      | Yes      | null                | Optional world map image URL; fetched/cached on load; may be null for text-only campaigns |
| `is_dm`         | boolean   | No       | true                | Flag for future multi-DM support; currently enforces single owner                         |

**Constraints:**

- `worlds_pkey`: Primary key ensures `world_id` uniqueness
- `worlds_owner_id_fkey1`: Foreign key to users.id; CASCADE DELETE ensures orphaned worlds cannot exist

```sql
create table public.worlds (
  world_id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  name text not null default 'World',
  description text null default '',
  system text null default 'D&D 5e',
  created_at timestamp with time zone null default (now() AT TIME ZONE 'utc'),
  updated_at timestamp with time zone null default (now() AT TIME ZONE 'utc'),
  map_image_url text null,
  is_dm boolean not null default true,
  constraint worlds_pkey primary key (world_id),
  constraint worlds_owner_id_fkey1 foreign key (owner_id) references users (id) on update cascade on delete cascade
) tablespace pg_default;
```

Indexes:

```sql
create index if not exists idx_worlds_owner_id on public.worlds using btree (owner_id) tablespace pg_default;
```

### world_access

**Purpose:** Join table implementing role-based access control (RBAC). Each row grants a user specific access to a world with a defined role (dm, player, spectator, etc.). Prevents duplicate memberships via unique constraint.

**Key Design Points:**

- Flexible role system: store role as text string (allows adding roles without schema changes)
- Optional `permissions` JSONB for future per-user capability overrides (not currently used)
- Unique constraint on (world_id, user_id) prevents duplicate rows; simplifies access checks
- Cascading deletes ensure no orphaned access rows when user or world deleted
- Composite indexes support common queries: "worlds for user", "users in world", "recent members"

**Fields:**

| Field         | Type      | Nullable | Default             | Purpose                                                                              |
| ------------- | --------- | -------- | ------------------- | ------------------------------------------------------------------------------------ |
| `id`          | uuid      | No       | `gen_random_uuid()` | Primary key; stable ref for this access grant                                        |
| `world_id`    | uuid      | No       | —                   | Foreign key to `worlds.world_id`; which world this access applies to                 |
| `user_id`     | uuid      | No       | —                   | Foreign key to `users.id`; who this access grant is for                              |
| `user_role`   | text      | No       | 'player'            | Role identifier (dm, player, spectator, etc.); used in RLS & permission checks       |
| `permissions` | jsonb     | Yes      | null                | Optional capability override structure; reserved for future complex permission logic |
| `created_at`  | timestamp | No       | current UTC         | Audit timestamp; when user was added to world; useful for "recent members" queries   |

**Constraints:**

- `world_access_pkey`: Primary key ensures each row is identifiable
- `world_access_user_id_fkey`: Foreign key with CASCADE DELETE; removing user removes their access grants
- `world_access_world_id_fkey`: Foreign key with CASCADE DELETE; deleting world removes all access rows

**Important Indexes:**

- `idx_world_access_world_id`: Fast lookup of all users in a world (for broadcasts, roster queries)
- `idx_world_access_user_id`: Fast lookup of all worlds a user belongs to (core session queries)
- `idx_world_access_world_user`: Unique constraint; prevents duplicate membership; also fastest for "is user in world?" queries
- `idx_world_access_user_created`: Optimizes "recent members in world" queries; sorted DESC for newest first

```sql
create table public.world_access (
  id uuid not null default gen_random_uuid(),
  world_id uuid not null,
  user_id uuid not null,
  user_role text not null default 'player',
  permissions jsonb null,
  created_at timestamp with time zone not null default now(),
  constraint world_access_pkey primary key (id),
  constraint world_access_user_id_fkey foreign key (user_id) references users (id) on delete cascade,
  constraint world_access_world_id_fkey foreign key (world_id) references worlds (world_id) on delete cascade
) tablespace pg_default;
```

Indexes:

```sql
create index if not exists idx_world_access_world_id on public.world_access using btree (world_id) tablespace pg_default;
create index if not exists idx_world_access_user_id  on public.world_access using btree (user_id) tablespace pg_default;
create unique index if not exists idx_world_access_world_user on public.world_access using btree (world_id, user_id) tablespace pg_default;
create index if not exists idx_world_access_user_created on public.world_access using btree (user_id, created_at desc) tablespace pg_default;
```

### users

**Purpose:** Internal user representation; bridges Supabase Auth (auth.users) with the app's data model. One row per authenticated user; created on signup via Auth trigger.

**Key Design Points:**

- Separate from Supabase `auth.users` table to allow custom user data without modifying auth schema
- `auth_id` foreign key enforces 1:1 relationship with Supabase Auth; CASCADE DELETE removes user on account deletion
- `isAdmin` flag for admin panel access and future permission escalation (currently no admin features)
- `username` defaults to 'changeling'; can be customized by user in settings (not unique, allows same display name)
- Minimal schema emphasizes separation of concerns: auth (email, password) vs. profile (username, preferences)

**Fields:**

| Field        | Type      | Nullable | Default             | Purpose                                                                                 |
| ------------ | --------- | -------- | ------------------- | --------------------------------------------------------------------------------------- |
| `id`         | uuid      | No       | `gen_random_uuid()` | Primary key; stable user identifier used throughout app                                 |
| `auth_id`    | uuid      | No       | —                   | Foreign key to `auth.users.id`; enforces 1:1 link to Supabase Auth; cascades on delete  |
| `username`   | text      | No       | 'changeling'        | Display name for user in UI; not unique; can be changed anytime                         |
| `created_at` | timestamp | No       | current UTC         | Audit timestamp; account creation time; useful for user sorting/cohort analysis         |
| `isAdmin`    | boolean   | No       | false               | Admin flag; reserved for future admin panel access; checked before sensitive operations |

**Constraints:**

- `users_pkey`: Primary key ensures `id` uniqueness
- `users_auth_id_fkey`: Foreign key to auth.users.id; CASCADE DELETE ensures no orphaned records if account deleted

**Trigger (Expected):**

- On Supabase Auth signup, a trigger should create a new `users` row with the auth_id; not manually documented here but critical for data consistency

```sql
create table public.users (
  id uuid not null default gen_random_uuid(),
  auth_id uuid not null,
  username text not null default 'changeling',
  created_at timestamp with time zone not null default now(),
  isAdmin boolean not null default false,
  constraint users_pkey primary key (id),
  constraint users_auth_id_fkey foreign key (auth_id) references auth.users (id) on update cascade on delete cascade
) tablespace pg_default;
```

Indexes:

```sql
create index if not exists idx_users_auth_id on public.users using btree (auth_id) tablespace pg_default;
```

### invite_links

**Purpose:** Time-limited shareable invite tokens for joining worlds. Each token is single-use; exchanges token → world for unauthenticated signup flow. Tokens expire after 24 hours.

**Key Design Points:**

- Public table: unauthenticated users can query by token to display "Invite to World X" during signup
- Token is UUID (strongly random); makes brute-force guessing practically impossible
- Expiration (24 hours) keeps table clean; stale invites auto-expire; separate job can cleanup expired rows
- `world_id` nullable to support future "join organization" invites (not yet implemented)
- `created_by` nullable for future audit trails; allows identifying who generated the invite

**Fields:**

| Field        | Type      | Nullable | Default             | Purpose                                                                                                          |
| ------------ | --------- | -------- | ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `id`         | uuid      | No       | `gen_random_uuid()` | Primary key; internal identifier for this invite                                                                 |
| `world_id`   | uuid      | Yes      | null                | Foreign key to `worlds.world_id`; which world the invite grants access to; nullable for future org-level invites |
| `created_by` | uuid      | Yes      | null                | Foreign key to `users.id`; audit trail; who created this invite; nullable in Phase 1                             |
| `token`      | uuid      | No       | `gen_random_uuid()` | Unique shareable token; what the invitee clicks/enters; strongly random to prevent guessing                      |
| `expires_at` | timestamp | No       | current UTC + 24h   | Expiration time; queries filter `WHERE expires_at > NOW()` to check validity                                     |
| `created_at` | timestamp | Yes      | current UTC         | Audit timestamp; when the invite was generated                                                                   |

**Constraints:**

- `invite_links_pkey`: Primary key ensures `id` uniqueness
- `invite_links_token_key`: Unique constraint on `token`; prevents duplicate tokens; enables fast lookup by token
- `invite_links_created_by_fkey`: Foreign key with CASCADE DELETE; if user deleted, their invites remain (not deleted)
- `invite_links_world_id_fkey`: Foreign key with CASCADE DELETE; deleting world also deletes related invites

**Indexes:**

- `idx_invite_links_expires_at`: Optimizes expiration cleanup queries & validity checks; allows fast filtering of active invites

**Future Cleanup:**

- Implement periodic job to delete expired invites (rows where `expires_at < NOW()`)
- Archive deleted invites to audit log table (optional, for compliance)

```sql
create table public.invite_links (
  id uuid not null default gen_random_uuid(),
  world_id uuid null,
  created_by uuid null,
  token uuid not null default gen_random_uuid(),
  expires_at timestamp with time zone not null default (now() + interval '24 hours'),
  created_at timestamp with time zone null default now(),
  constraint invite_links_pkey primary key (id),
  constraint invite_links_token_key unique (token),
  constraint invite_links_created_by_fkey foreign key (created_by) references users (id) on delete cascade,
  constraint invite_links_world_id_fkey foreign key (world_id) references worlds (world_id) on delete cascade
) tablespace pg_default;
```

Indexes:

```sql
create index if not exists idx_invite_links_expires_at on public.invite_links using btree (expires_at) tablespace pg_default;
```

---

# Feature_Flags Schema

Feature control tables: flags, entitlements, user overrides, and percentage-based rollouts.

## Tables

### feature_flags

**Purpose:** Master list of all feature flags. Defines flag metadata, whether it's enabled globally, and the kind of flag (boolean, string, percentage-rollout, etc.). Controls runtime behavior across all users unless overridden.

**Key Design Points:**

- Simple master table: one row per flag; no complex inheritance or versioning yet
- `flag_name` is text (not UUID) for readability in logs and code; used as foreign key in other tables
- `kind` field distinguishes flag types (boolean flag, percentage rollout, entitlement, etc.) for feature gate logic
- `enabled` defaults to false; new flags are "off" until explicitly enabled to prevent unintended rollout
- `description` optional; documents purpose and relevant issue tickets (e.g., "#58 - A/B Testing for character sheets")
- Timestamps (`created_at`, `updated_at`) enable audit trail; `updated_at` DESC index supports "recently modified flags" lists

**Fields:**

| Field         | Type      | Nullable | Default     | Purpose                                                                                            |
| ------------- | --------- | -------- | ----------- | -------------------------------------------------------------------------------------------------- |
| `flag_name`   | text      | No       | —           | Primary key; human-readable identifier (e.g., 'feature_flag_a_b_testing'); matches code references |
| `enabled`     | boolean   | No       | false       | Is this flag globally enabled? Overridable per-user via entitlements/overrides                     |
| `kind`        | text      | No       | —           | Flag type: 'boolean' (on/off), 'string' (variant), 'percentage', 'entitlement', etc.               |
| `description` | text      | Yes      | null        | Purpose/documentation; issue ticket reference; guidance for admins                                 |
| `created_at`  | timestamp | No       | current UTC | Audit; when flag was defined                                                                       |
| `updated_at`  | timestamp | Yes      | current UTC | Audit; when flag was last modified (e.g., enabled/disabled, kind changed)                          |

**Constraints:**

- `feature_flags_pkey`: Primary key on `flag_name`; ensures one definition per flag

**Indexes:**

- `idx_feature_flags_updated_at`: DESC order; optimizes "recently modified flags" admin queries; useful for monitoring

**Usage Example:**

```text
flag_name: 'feature_a_b_test_character_sheet_v2'
enabled: true
kind: 'percentage'
description: '#58 - A/B Testing for character sheet redesign; 50% rollout to users'
```

```sql
create table feature_flags.feature_flags (
  flag_name text not null,
  enabled boolean not null default false,
  kind text not null,
  description text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone null default now(),
  constraint feature_flags_pkey primary key (flag_name)
) tablespace pg_default;
```

Indexes:

```sql
create index if not exists idx_feature_flags_updated_at on feature_flags.feature_flags using btree (updated_at desc) tablespace pg_default;
```

### entitlements

**Purpose:** Grants explicit feature access to users; represents "what this user is entitled to use." Each entitlement is a capability unlock (premium feature, beta access, admin capability, etc.). Entitlements can be temporary (expiring) or permanent.

**Key Design Points:**

- One row per user per entitlement key; prevents duplicates via implicit uniqueness (enforced in app logic, consider adding DB constraint in Phase 2)
- `user_id` nullable to support future organization-wide or anonymous entitlements (not yet used)
- `key` is text identifier (e.g., 'premium_subscription', 'beta_feature_x'); linked to feature flag definitions
- `expires_at` nullable; permanent entitlements are null, temporary ones have expiration dates
- Indexed on (user_id, key, expires_at) to support efficient queries: "what features does user X have right now?"
- `updated_at` tracks entitlement lifecycle changes (granted, extended, revoked)

**Fields:**

| Field        | Type      | Nullable | Default             | Purpose                                                                                                 |
| ------------ | --------- | -------- | ------------------- | ------------------------------------------------------------------------------------------------------- |
| `id`         | uuid      | No       | `gen_random_uuid()` | Primary key; stable reference for this entitlement grant                                                |
| `user_id`    | uuid      | Yes      | null                | Foreign key to `users.id`; who this entitlement is for; nullable for future org-wide grants             |
| `key`        | text      | No       | —                   | Entitlement identifier (e.g., 'premium_subscription', 'early_access_v2'); matches app permission checks |
| `created_at` | timestamp | No       | current UTC         | Audit; when entitlement was granted                                                                     |
| `updated_at` | timestamp | No       | current UTC         | Audit; when entitlement was last modified (extended, revoked)                                           |
| `expires_at` | timestamp | Yes      | null                | Expiration time; null = permanent entitlement; used to determine current validity                       |

**Constraints:**

- `entitlements_pkey`: Primary key ensures each row is identifiable
- `entitlements_user_id_fkey`: Foreign key with RESTRICT (prevents deleting user with active entitlements); currently commented out but recommended for future

**Indexes:**

- `idx_entitlements_user_id`: Fast lookup of "all entitlements for user X"
- `idx_entitlements_key`: Fast lookup of "all users with entitlement Y"
- `idx_entitlements_id`: Direct row lookup by ID
- `idx_entitlements_expires_at`: Optimizes expiration queries; supports "cleanup expired entitlements" jobs and "what's expired?" checks

**Future Improvements:**

- Add UNIQUE constraint: `UNIQUE (user_id, key)` to enforce no duplicates at DB level
- Add CHECK constraint: `expires_at IS NULL OR expires_at > created_at` to prevent invalid expiration dates
- Implement periodic cleanup job to remove/archive expired entitlements (optional, they're soft-expired via query filters)

**Usage Example:**

```text
user_id: {uuid}
key: 'premium_subscription'
created_at: 2024-01-15
expires_at: 2025-01-15    -- Annual subscription, expires next year
```

```sql
create table feature_flags.entitlements (
  id uuid not null default gen_random_uuid(),
  user_id uuid null,
  key text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  expires_at timestamp with time zone null,
  constraint entitlements_pkey primary key (id),
  constraint entitlements_user_id_fkey foreign KEY (user_id) references public.users (id)
) TABLESPACE pg_default;
```

Indexes:

```sql
create index IF not exists idx_entitlements_user_id on feature_flags.entitlements using btree (user_id) TABLESPACE pg_default;
create index IF not exists idx_entitlements_key on feature_flags.entitlements using btree (key) TABLESPACE pg_default;
create index IF not exists idx_entitlements_id on feature_flags.entitlements using btree (id) TABLESPACE pg_default;
create index IF not exists idx_entitlements_expires_at on feature_flags.entitlements using btree (expires_at) TABLESPACE pg_default;
```

### feature_flag_overrides

**Purpose:** Admin tool to override global feature flags or entitlements for specific users. Supports temporarily enabling/disabling flags for testing, early access, or mitigation (e.g., "disable this feature for this user who's experiencing a bug").

**Key Design Points:**

- `target_type` field distinguishes override targets: 'flag' (feature_flags table) vs 'entitlement' (entitlements table)
- `target_name` contains the flag_name or entitlement key being overridden; combined with target_type it identifies what's overridden
- Unique constraint on (user_id, target_type, target_name) prevents duplicate overrides for same user + target
- `enabled` boolean; true = override turns it ON, false = override turns it OFF (useful for disabling broken features mid-rollout)
- `expires_at` nullable; temporary overrides auto-expire, permanent ones are null
- `reason` free text; documents why override was applied (e.g., "User reported UI bug, disabled pending fix")
- `revoked` boolean flag allows soft-delete without orphaning audit trail (vs. hard DELETE which loses history)
- Audit fields (`created_by`, `created_at`, `updated_at`) track who applied the override and when

**Fields:**

| Field         | Type      | Nullable | Default             | Purpose                                                                                                         |
| ------------- | --------- | -------- | ------------------- | --------------------------------------------------------------------------------------------------------------- |
| `id`          | uuid      | No       | `gen_random_uuid()` | Primary key; stable reference for this override                                                                 |
| `user_id`     | uuid      | No       | —                   | Foreign key to `users.id`; which user this override applies to                                                  |
| `target_type` | text      | No       | —                   | Override type: 'flag' (overrides feature_flags.feature_flags) or 'entitlement' (overrides entitlements)         |
| `target_name` | text      | No       | —                   | Name of flag or entitlement to override; paired with target_type to identify target                             |
| `enabled`     | boolean   | No       | —                   | Override value: true = force enabled, false = force disabled                                                    |
| `expires_at`  | timestamp | Yes      | null                | Expiration time; null = permanent override; auto-expires for temporary testing                                  |
| `reason`      | text      | Yes      | null                | Admin notes; rationale for override (e.g., "Testing variant B", "Bug mitigation")                               |
| `created_by`  | uuid      | Yes      | null                | Foreign key to `users.id`; which admin applied this override; nullable in Phase 1                               |
| `created_at`  | timestamp | No       | current UTC         | Audit; when override was applied                                                                                |
| `updated_at`  | timestamp | No       | current UTC         | Audit; when override was last modified                                                                          |
| `revoked`     | boolean   | No       | false               | Soft-delete flag; true = override is revoked but row retained for audit; queries filter `WHERE revoked = false` |

**Constraints:**

- `fk_user_id`: Foreign key to users.id; CASCADE DELETE removes user's overrides if user deleted
- `fk_created_by`: Foreign key to users.id; SET NULL on delete allows admin deletion without losing override record

**Indexes:**

- `idx_overrides_user_target`: Unique on (user_id, target_type, target_name); also speeds up "does this override exist?" queries
- `idx_overrides_expires_at`: Optimizes expiration cleanup queries; supports "find expired overrides" batch jobs
- `idx_overrides_user_id`: Fast lookup of "all overrides for user X"

**Override Hierarchy (Decision Logic):**

```
1. Check overrides (explicit admin action; highest priority)
2. Check entitlements (user-granted capabilities)
3. Check percentage rollouts (A/B test assignment)
4. Check global feature flag (default state)
```

**Usage Examples:**

```text
-- Testing scenario: give user early access to beta feature before rollout
user_id: {uuid}
target_type: 'flag'
target_name: 'feature_beta_character_sheet'
enabled: true
reason: 'Early access for QA testing'
expires_at: 2025-02-15    -- Auto-expires after testing period

-- Mitigation: disable feature for user experiencing bug
user_id: {uuid}
target_type: 'flag'
target_name: 'feature_campaign_import'
enabled: false
reason: 'Temp disable due to import parser crash; fix in #456'
expires_at: null          -- Permanent until manually revoked

-- Entitlement override: extend premium access
user_id: {uuid}
target_type: 'entitlement'
target_name: 'premium_subscription'
enabled: true
reason: 'Extending trial for customer support escalation'
expires_at: 2025-03-15
```

```sql
create table feature_flags.feature_flag_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  target_type text not null,        -- 'flag' or 'entitlement'
  target_name text not null,        -- flag_name or entitlement_key
  enabled boolean not null,
  expires_at timestamp with time zone null,
  reason text,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  revoked boolean not null default false,
  constraint fk_user_id foreign key (user_id) references public.users(id) on delete cascade,
  constraint fk_created_by foreign key (created_by) references public.users(id) on delete set null
) tablespace pg_default;
```

Indexes:

```sql
create unique index idx_overrides_user_target on feature_flags.feature_flag_overrides(user_id, target_type, target_name) tablespace pg_default;
create index idx_overrides_expires_at on feature_flags.feature_flag_overrides(expires_at) tablespace pg_default;
create index idx_overrides_user_id on feature_flags.feature_flag_overrides(user_id) tablespace pg_default;
```

### feature_flag_rollouts

**Purpose:** Implements percentage-based, deterministic feature rollouts (A/B testing). Users are bucketed into "in rollout" or "out of rollout" based on a deterministic hash, enabling controlled gradual feature launches.

**Key Design Points:**

- One row per flag; `flag_name` unique constraint ensures only one active rollout per flag
- `percentage` (0-100) controls breadth: 25% = ~1 in 4 users included; deterministic hashing ensures stable assignment
- `seed` (optional) allows reseeding the hash function for re-bucketing (advanced admin feature; rarely used)
- Deterministic bucketing (FNV-1a hash of user_id + seed) means same user always gets the same result and can't "cheat" to see feature
- `is_active` flag allows soft-disable without deleting rollout record; queries filter `WHERE is_active = true`
- `created_by` (nullable) links to admin who configured rollout; nullable in Phase 1 for seed data
- Composite indexes support common queries: "is this flag rolling out?", "what's active?", "by-flag lookups"

**Fields:**

| Field         | Type      | Nullable | Default             | Purpose                                                                                                                        |
| ------------- | --------- | -------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `id`          | uuid      | No       | `gen_random_uuid()` | Primary key; stable reference for this rollout configuration                                                                   |
| `flag_name`   | text      | No       | —                   | Foreign key to `feature_flags.feature_flags.flag_name`; which flag this rollout controls; UNIQUE enforces one rollout per flag |
| `percentage`  | smallint  | No       | —                   | Percentage of users to include (0-100); deterministic bucketing decides who's in/out                                           |
| `seed`        | text      | Yes      | null                | Optional hash seed; allows re-bucketing users (advanced); null uses default seed                                               |
| `created_at`  | timestamp | No       | current UTC         | Audit; when rollout was created                                                                                                |
| `updated_at`  | timestamp | No       | current UTC         | Audit; when rollout was modified (percentage changed, seed reset, etc.)                                                        |
| `created_by`  | uuid      | Yes      | null                | Foreign key to `auth.users.id`; which admin created this rollout; nullable in Phase 1                                          |
| `description` | text      | Yes      | null                | Admin notes; explains what's being tested (e.g., "Character sheet redesign; measuring engagement metrics")                     |
| `is_active`   | boolean   | No       | true                | Is this rollout currently active? false = paused (queries filter on true); allows non-destructive disable                      |

**Constraints:**

- `feature_flag_rollouts_pkey`: Primary key on `id`
- `feature_flag_rollouts_flag_name_key`: Unique on `flag_name`; prevents multiple rollout configs for same flag
- `feature_flag_rollouts_created_by_fkey`: Foreign key to auth.users.id; SET NULL if admin deleted (preserves rollout history)
- `feature_flag_rollouts_flag_name_fkey`: Foreign key to `feature_flags.feature_flags.flag_name`; CASCADE DELETE if flag deleted
- `feature_flag_rollouts_percentage_check`: CHECK constraint: `0 <= percentage <= 100`; prevents invalid percentages

**Indexes:**

- `idx_feature_flag_rollouts_flag_name`: Fast lookup of rollout by flag (primary query path)
- `idx_feature_flag_rollouts_flag_name_active`: Optimizes "all active rollouts" queries; composite index speeds up both conditions
- `idx_feature_flag_rollouts_is_active`: Supports "pause/unpause all" admin operations

**Deterministic Bucketing (FNV-1a Hash Example):**

```
hash = FNV_1a(user_id || seed)
user_in_rollout = (hash % 100) < percentage

Example: percentage=25, seed='default'
user_id='abc123'   -> hash=12845 -> (12845 % 100) = 45 -> 45 < 25? NO -> User OUT
user_id='xyz789'   -> hash=3421  -> (3421 % 100)  = 21 -> 21 < 25? YES -> User IN

Same user always gets same result; re-seeding remixes the hash for re-bucketing
```

**Lifecycle Example:**

```
1. Create rollout: 10% of users (early testing)
2. Monitor metrics for 1 week
3. Increase to 50% (wider test)
4. Monitor for 1 more week
5. Increase to 100% (full rollout)
6. Set is_active=false when feature stabilizes and rollout no longer needed
```

**Usage Example:**

```text
flag_name: 'feature_a_b_test_character_sheet_v2'
percentage: 50
seed: 'default'
description: 'A/B testing redesigned character sheet; measuring time-to-edit and user fidelity'
is_active: true
created_by: {admin_user_id}
```

```sql
create table feature_flags.feature_flag_rollouts (
  id uuid not null default gen_random_uuid(),
  flag_name text not null,
  percentage smallint not null,
  seed text null,
  created_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  created_by uuid null,
  description text null,
  is_active boolean not null default true,
  constraint feature_flag_rollouts_pkey primary key (id),
  constraint feature_flag_rollouts_flag_name_key unique (flag_name),
  constraint feature_flag_rollouts_created_by_fkey foreign KEY (created_by) references auth.users (id) on delete set null,
  constraint feature_flag_rollouts_flag_name_fkey foreign KEY (flag_name) references feature_flags.feature_flags (flag_name) on delete CASCADE,
  constraint feature_flag_rollouts_percentage_check check (
    (
      (percentage >= 0)
      and (percentage <= 100)
    )
  )
) TABLESPACE pg_default;
```

Indexes:

```sql
create index IF not exists idx_feature_flag_rollouts_flag_name on feature_flags.feature_flag_rollouts using btree (flag_name) TABLESPACE pg_default;

create index IF not exists idx_feature_flag_rollouts_flag_name_active on feature_flags.feature_flag_rollouts using btree (flag_name, is_active) TABLESPACE pg_default;

create index IF not exists idx_feature_flag_rollouts_is_active on feature_flags.feature_flag_rollouts using btree (is_active) TABLESPACE pg_default;
```

---

## Row Level Security (RLS) Policies

Each policy shows: Name, Command, Roles, USING predicate, and optional WITH CHECK.

### Public Schema RLS

#### users

```text
users_select_own        | SELECT | authenticated | USING: auth.uid() = auth_id
users_insert_own        | INSERT | authenticated | CHECK: auth.uid() = auth_id
users_update_own        | UPDATE | authenticated | USING: auth.uid() = auth_id | CHECK: auth.uid() = auth_id
users_delete_own        | DELETE | authenticated | USING: auth.uid() = auth_id
users_admin_full_access | ALL    | authenticated | USING: (auth.jwt()->>'role') = 'admin'
```

#### world_access

```text
world_owner_any_ops_on_world_access | ALL | authenticated | USING/CHECK: get_world_owner_auth_id(world_id) = auth.uid()
member_self_manage_access          | ALL | authenticated | USING/CHECK: get_user_auth_id(user_id) = auth.uid()
```

#### invite_links

```text
invite_links_public_read  | SELECT | public        | USING: true
invite_links_insert_owner | INSERT | authenticated | CHECK: (created_by matches auth.uid() OR owner/dm of world)
invite_links_owner_select | SELECT | authenticated | USING: requestor is world owner
```

#### worlds

```text
worlds_owner_full          | ALL    | authenticated | USING/CHECK: world owner auth_id = auth.uid()
worlds_collaborator_update | UPDATE | authenticated | USING: user has world_access row | CHECK: owner_id remains unchanged
worlds_collaborator_select | SELECT | authenticated | USING: user has world_access row
```

### Feature_Flags Schema RLS

#### feature_flags.feature_flags

```text
feature_flags_public_read | SELECT | public, authenticated | USING: true
feature_flags_admin_write | INSERT, UPDATE, DELETE | authenticated | CHECK: (auth.jwt()->>'role') = 'admin'
```

#### feature_flags.entitlements

```text
entitlements_user_read_own     | SELECT | authenticated | USING: user_id = auth.uid()
entitlements_admin_full_access | ALL    | authenticated | USING/CHECK: (auth.jwt()->>'role') = 'admin'
```

#### feature_flags.feature_flag_overrides

```text
overrides_user_read_own  | SELECT | authenticated | USING: user_id = auth.uid()
overrides_admin_write    | INSERT, UPDATE, DELETE | authenticated | CHECK: (auth.jwt()->>'role') = 'admin'
```

#### feature_flags.feature_flag_rollouts

```text
rollouts_authenticated_read | SELECT | authenticated | USING: true
rollouts_admin_write        | INSERT, UPDATE, DELETE | authenticated | CHECK: (auth.jwt()->>'role') = 'admin'
```

---

## Helper Functions Referenced

These server-side functions (not shown here) must exist:

```text
get_world_owner_auth_id(world_id uuid) -> uuid
get_user_auth_id(user_id uuid) -> uuid
```

---

## Notes

- All UUIDs default via `gen_random_uuid()`.
- Timestamps normalized to UTC via `now() AT TIME ZONE 'utc'` where needed.
- **Feature_Flags Schema** tables use schema-qualified references: `feature_flags.feature_flags`, `feature_flags.entitlements`, etc.
- Feature flag tables are isolated in a separate schema for better organization, permission control, and scalability.
- Invite links expire after 24 hours by default.
- Access control relies on mapping app auth user (auth.users) to internal `users` table via `auth_id`.
- Policies favor explicit ownership & collaborator rows for flexibility.

---

## Potential Improvements

- Add partial index for active invite links: `where expires_at > now()`.
- Consider materialized view for world membership summary.
- Add audit triggers for critical tables (worlds, world_access).

---

_End of schema reference._
