# 🧩 Database Index Reference — DnD Toolkit

Complete PostgreSQL index documentation, organized by schema. These indexes are created by migrations 001-004 and **already exist in production**—do not run manually.

---

## PUBLIC Schema Indexes

### PUBLIC.USERS

| Index               | Columns      | Type   | Purpose                                 |
| ------------------- | ------------ | ------ | --------------------------------------- |
| (primary key)       | `id`         | btree  | Primary key lookup                      |
| `idx_users_auth_id` | `auth_id`    | btree  | Fast lookup by Supabase auth ID; unique |

---

### PUBLIC.USER_SETTINGS

| Index               | Columns   | Type  | Purpose                    |
| ------------------- | --------- | ----- | -------------------------- |
| (primary key)       | `id`      | btree | Primary key lookup         |
| (foreign key index) | `user_id` | btree | Lookup settings by user ID |

---

### PUBLIC.INVITE_LINKS

| Index                      | Columns      | Type  | Purpose                                         |
| -------------------------- | ------------ | ----- | ----------------------------------------------- |
| (primary key)              | `id`         | btree | Primary key lookup                              |
| `idx_invite_links_expires_at` | `expires_at` | btree | Identify expired invites for cleanup; validity checks |
| (unique)                   | `token`      | btree | Fast lookup by shareable token; prevent duplicates |

---

## WORLDS Schema Indexes

### WORLDS.WORLDS

| Index                    | Columns    | Type | Purpose                                       |
| ------------------------ | ---------- | ---- | --------------------------------------------- |
| (primary key)            | `world_id` | btree | Primary key lookup                            |
| `idx_worlds_owner_id`    | `owner_id` | btree | Quickly fetch all worlds owned by a user      |
| `idx_worlds_created_at`  | `created_at DESC` | btree | Sort newly created worlds (admin dashboard) |

---

### WORLDS.WORLD_ACCESS

| Index                                | Columns                      | Type        | Purpose                              |
| ------------------------------------ | ---------------------------- | ----------- | ------------------------------------ |
| (primary key)                        | `id`                         | btree       | Primary key lookup                   |
| `idx_world_access_world_id`          | `world_id`                   | btree       | Find all members in a world          |
| `idx_world_access_user_id`           | `user_id`                    | btree       | Find all worlds a user belongs to    |
| `idx_world_access_world_user`        | `(world_id, user_id)`        | btree UNIQUE | Prevent duplicate memberships; fast "is_member?" check |
| `idx_world_access_user_created`      | `(user_id, created_at DESC)` | btree       | Recent members in world; sorted newest first |

---

## FEATURE_FLAGS Schema Indexes

### FEATURE_FLAGS.FEATURE_FLAGS

| Index                          | Columns               | Type  | Purpose                              |
| ------------------------------ | --------------------- | ----- | ------------------------------------ |
| (primary key)                  | `flag_name`           | btree | Primary key lookup                   |
| `idx_feature_flags_updated_at` | `updated_at DESC`     | btree | Fetch recently updated flags (admin) |

---

### FEATURE_FLAGS.ENTITLEMENTS

| Index                                | Columns           | Type        | Purpose                                    |
| ------------------------------------ | ----------------- | ----------- | ------------------------------------------ |
| (primary key)                        | `id`              | btree       | Primary key lookup                         |
| `idx_entitlements_user_id`           | `user_id`         | btree       | Find all entitlements for a user           |
| `idx_entitlements_key`               | `key`             | btree       | Fast lookup by entitlement key (flag name)  |
| `idx_entitlements_expires_at`        | `expires_at`      | btree       | Identify expired entitlements for cleanup   |
| `idx_entitlements_user_key`          | `(user_id, key)`  | btree UNIQUE | Prevent duplicate entitlements per user     |
| (partial unique)                     | `(key) WHERE user_id IS NULL` | btree UNIQUE | Org-wide entitlements unique constraint |
| `idx_entitlements_is_active`         | `is_active` WHERE `is_active = true` | btree PARTIAL | Find active entitlements (soft-delete) |
| `idx_entitlements_not_active`        | `is_active` WHERE `is_active = false` | btree PARTIAL | Find revoked/expired entitlements (cleanup) |

---

### FEATURE_FLAGS.ENTITLEMENTS_OVERRIDES

| Index                                    | Columns                    | Type  | Purpose                                    |
| ---------------------------------------- | -------------------------- | ----- | ------------------------------------------ |
| (primary key)                            | `id`                       | btree | Primary key lookup                         |
| `idx_entitlements_overrides_user_id`     | `user_id`                  | btree | Find all overrides for a user              |
| `idx_entitlements_overrides_target`      | `(user_id, target_name)`   | btree | Fast lookup of override for specific entitlement |
| `idx_entitlements_overrides_expires_at`  | `expires_at`               | btree | Identify expired overrides                 |
| `idx_entitlements_overrides_not_revoked` | `revoked` WHERE `revoked = false` | btree PARTIAL | Find active overrides (soft-delete) |

---

### FEATURE_FLAGS.FEATURE_FLAG_OVERRIDES

| Index                                  | Columns                   | Type        | Purpose                                    |
| -------------------------------------- | ------------------------- | ----------- | ------------------------------------------ |
| (primary key)                          | `id`                      | btree       | Primary key lookup                         |
| `idx_feature_flag_overrides_user_id`   | `user_id`                 | btree       | Find all overrides for a user              |
| `idx_feature_flag_overrides_target`    | `(user_id, target_name)`  | btree UNIQUE | Prevent duplicate overrides; fast lookup   |
| `idx_feature_flag_overrides_expires_at` | `expires_at`             | btree       | Identify expired overrides                 |
| `idx_feature_flag_overrides_not_revoked` | `revoked` WHERE `revoked = false` | btree PARTIAL | Find active overrides (soft-delete) |

---

### FEATURE_FLAGS.FEATURE_FLAG_ROLLOUTS

| Index                                        | Columns                  | Type        | Purpose                                                       |
| -------------------------------------------- | ------------------------ | ----------- | ------------------------------------------------------------- |
| (primary key)                                | `id`                     | btree       | Primary key lookup                                            |
| `idx_feature_flag_rollouts_flag_name`        | `flag_name`              | btree       | Fast lookup of rollout config by flag name                    |
| `idx_feature_flag_rollouts_is_active`        | `is_active` WHERE `is_active = true` | btree PARTIAL | Filter only active rollouts during Edge Function fetch |
| `idx_feature_flag_rollouts_flag_name_active` | `(flag_name, is_active)` | btree       | Efficient lookup when filtering active rollouts by flag name  |

---

## AUDIT Schema Indexes

### AUDIT.EVENTS

| Index                            | Columns                                     | Type  | Purpose                                           |
| -------------------------------- | ------------------------------------------- | ----- | ------------------------------------------------- |
| (primary key)                    | `id`                                        | btree | Primary key lookup; unique audit event ID        |
| `idx_audit_events_table`         | `(table_schema, table_name)`                | btree | Find all events for a specific table             |
| `idx_audit_events_record`        | `record_id`                                 | btree | Find all events for a specific record            |
| `idx_audit_events_initiated_by`  | `initiated_by`                              | btree | Find all events by a specific user; audit trail |
| `idx_audit_events_created_at`    | `created_at DESC`                           | btree | Most recent events; admin dashboard sorted newest first |
| `idx_audit_events_table_time`    | `(table_schema, table_name, created_at DESC)` | btree | Recent events per table (common admin query)    |

---

## Index Design Notes

### Partial Indexes (Efficient Soft-Delete)

Several indexes use `WHERE` clauses for efficiency:
- **`is_active = true`**: Find only active entitlements (skip revoked/expired)
- **`revoked = false`**: Find only active overrides (skip revoked)

These **stable predicates** (not volatile `now()`) keep indexes small and queryable.

### Composite Indexes

- **`(user_id, key)`**: Prevents duplicate entitlements; enables fast "does user have entitlement X?" queries
- **`(table_schema, table_name, created_at DESC)`**: Admin dashboard queries for "recent changes per table"

### Unique Indexes

- Enforce data integrity (e.g., one entitlement per user+key combo)
- Automatically prevent duplicates; much faster than application-layer checks

---

## Performance Implications

### Lookups Optimized:

```sql
-- Fast: single table lookup
SELECT * FROM feature_flags.entitlements WHERE user_id = ? AND key = ?;

-- Fast: recent audits
SELECT * FROM audit.events WHERE table_schema = ? AND table_name = ? ORDER BY created_at DESC LIMIT 10;

-- Fast: all user's active overrides
SELECT * FROM feature_flags.feature_flag_overrides WHERE user_id = ? AND revoked = false;
```

### Bulk Operations:

Mark expired entitlements as inactive (background job):
```sql
UPDATE feature_flags.entitlements
SET is_active = false
WHERE is_active = true AND expires_at <= now();
```
This scan uses `idx_entitlements_is_active` partial index (small set) instead of full table scan.

---

## Testing Index Usage

**Verify index is used in query plan:**
```sql
EXPLAIN ANALYZE
SELECT * FROM feature_flags.entitlements
WHERE user_id = 'uuid-here' AND is_active = true;
-- Output should show: Index Scan using idx_entitlements_user_id ...
```

**Check index size:**
```sql
SELECT schemaname, tablename, indexname, pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname IN ('public', 'worlds', 'feature_flags', 'audit');
```

---

_Last Updated: Feb 8, 2026 (Post-Migration 001-004)_
