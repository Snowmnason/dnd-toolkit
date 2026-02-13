# Database Index Reference — DnD Toolkit

All indexes documented here match migrations 001–004. Source of truth: `supabase/migrations/`.

---

## PUBLIC Schema (001)

### public.users

| Index | Columns | Type | Notes |
| --- | --- | --- | --- |
| `users_pkey` | `id` | PK (btree) | Primary key |
| `users_auth_id_key` | `auth_id` | UNIQUE (btree) | Auto-created by UNIQUE constraint |
| `idx_users_created_at` | `created_at DESC` | btree | Sort by signup date |
| `idx_users_not_deleted` | `deleted_at` WHERE `deleted_at IS NULL` | btree (partial) | Fast lookup of active users |

### public.user_settings

| Index | Columns | Type | Notes |
| --- | --- | --- | --- |
| `user_settings_pkey` | `user_id` | PK (btree) | Primary key (user_id, not id) |

---

## WORLDS Schema (002)

### worlds.worlds

| Index | Columns | Type | Notes |
| --- | --- | --- | --- |
| `worlds_pkey` | `world_id` | PK (btree) | Primary key |
| `idx_worlds_owner_id` | `owner_id` | btree | Fetch worlds by owner |
| `idx_worlds_created_at` | `created_at DESC` | btree | Sort newest first |
| `idx_worlds_not_deleted` | `created_at DESC` WHERE `deleted_at IS NULL` | btree (partial) | Active worlds only, sorted |

### worlds.world_access

| Index | Columns | Type | Notes |
| --- | --- | --- | --- |
| `world_access_pkey` | `id` | PK (btree) | Primary key |
| `idx_world_access_world_user` | `(world_id, user_id)` | UNIQUE btree | Prevents duplicate memberships |
| `idx_world_access_user_id` | `user_id` | btree | All worlds a user belongs to |
| `idx_world_access_world_id` | `world_id` | btree | All members in a world |
| `idx_world_access_user_created` | `(user_id, created_at DESC)` | btree | Recent memberships per user |

### worlds.invite_links

| Index | Columns | Type | Notes |
| --- | --- | --- | --- |
| `invite_links_pkey` | `id` | PK (btree) | Primary key |
| `invite_links_token_key` | `token` | UNIQUE (btree) | Auto-created by UNIQUE constraint |
| `idx_invite_links_expires_at` | `expires_at` | btree | Expiration cleanup |
| `idx_invite_links_world_id` | `world_id` | btree | Invites by world |
| `idx_invite_links_created_by` | `created_by` | btree | Invites by creator |

---

## FEATURE_FLAG Schema (003)

### feature_flag.feature_flags

| Index | Columns | Type | Notes |
| --- | --- | --- | --- |
| `feature_flags_pkey` | `flag_name` | PK (btree) | Primary key (text, not uuid) |
| `idx_feature_flags_updated_at` | `updated_at DESC` | btree | Recently modified flags |

### feature_flag.entitlements

| Index | Columns | Type | Notes |
| --- | --- | --- | --- |
| `entitlements_pkey` | `id` | PK (btree) | Primary key |
| `entitlements_user_key_unique` | `(user_id, key)` | UNIQUE (btree) | One entitlement per user+key |
| `one_org_entitlement_per_key` | `key` WHERE `user_id IS NULL` | UNIQUE partial | Org-wide uniqueness |
| `idx_entitlements_user_id` | `user_id` | btree | Entitlements by user |
| `idx_entitlements_key` | `key` | btree | Users with a specific entitlement |
| `idx_entitlements_expires_at` | `expires_at` | btree | Expiration cleanup |
| `idx_entitlements_active` | `user_id` WHERE `is_active = true` | btree (partial) | Active entitlements only |

### feature_flag.feature_flag_overrides

| Index | Columns | Type | Notes |
| --- | --- | --- | --- |
| `overrides_pkey` | `id` | PK (btree) | Primary key |
| `idx_overrides_user_flag` | `(user_id, flag_name)` | UNIQUE (btree) | One override per user+flag |
| `idx_overrides_user_id` | `user_id` | btree | Overrides by user |
| `idx_overrides_expires_at` | `expires_at` | btree | Expiration cleanup |
| `idx_overrides_active` | `user_id` WHERE `revoked = false` | btree (partial) | Active overrides only |

### feature_flag.entitlements_overrides

| Index | Columns | Type | Notes |
| --- | --- | --- | --- |
| `entitlements_overrides_pkey` | `id` | PK (btree) | Primary key |
| `entitlements_overrides_user_key_unique` | `(user_id, entitlement_key)` | UNIQUE (btree) | One override per user+key |
| `idx_entitlements_overrides_user_id` | `user_id` | btree | Overrides by user |
| `idx_entitlements_overrides_expires_at` | `expires_at` | btree | Expiration cleanup |
| `idx_entitlements_overrides_key` | `entitlement_key` | btree | Bulk ops by key |
| `idx_entitlements_overrides_active` | `user_id` WHERE `revoked = false` | btree (partial) | Active overrides only |

### feature_flag.feature_flag_rollouts

| Index | Columns | Type | Notes |
| --- | --- | --- | --- |
| `rollouts_pkey` | `id` | PK (btree) | Primary key |
| `rollouts_flag_name_key` | `flag_name` | UNIQUE (btree) | One rollout per flag |
| `idx_rollouts_flag_name` | `flag_name` | btree | Lookup by flag |
| `idx_rollouts_flag_name_active` | `(flag_name, is_active)` | btree | Filter active by flag |
| `idx_rollouts_is_active` | `is_active` | btree | All active/inactive rollouts |
| `idx_rollouts_active_time` | `flag_name` WHERE `is_active = true` | btree (partial) | Active rollouts only |

---

## AUDIT Schema (004)

### audit.audit_events

| Index | Columns | Type | Notes |
| --- | --- | --- | --- |
| `audit_events_pkey` | `id` | PK (btree) | Primary key |
| `idx_audit_events_table` | `(table_schema, table_name)` | btree | Events by table |
| `idx_audit_events_record` | `record_id` | btree | Events by record |
| `idx_audit_events_initiated_by` | `initiated_by` | btree | Events by user |
| `idx_audit_events_created_at` | `created_at DESC` | btree | Most recent events |
| `idx_audit_events_table_time` | `(table_schema, table_name, created_at DESC)` | btree | Recent events per table |

---

## Index Design Notes

### Partial Indexes

Used for efficient soft-delete and status filtering:
- `WHERE deleted_at IS NULL` — active users/worlds only (small set vs full table)
- `WHERE is_active = true` — active entitlements (skip expired/revoked)
- `WHERE revoked = false` — active overrides (skip soft-revoked)
- Predicates use **stable columns** (not `now()`), so PostgreSQL can maintain and use these indexes efficiently.

### Composite Unique Indexes

Enforce data integrity at the DB level:
- `(world_id, user_id)` on `world_access` — one membership per user per world
- `(user_id, key)` on `entitlements` — one entitlement per user per key
- `(user_id, flag_name)` on `feature_flag_overrides` — one override per user per flag
- `(user_id, entitlement_key)` on `entitlements_overrides` — one override per user per key

---

_Last Updated: Feb 11, 2026 (Post-Audit — matches migrations 001–004)_