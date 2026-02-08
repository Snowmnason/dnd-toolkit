# 🧩 Database Index Reference — DnD Toolkit

This file documents the current PostgreSQL indexes in Supabase, organized by schema.  
**Do not run these manually** — they already exist in production.  
This is for developer reference only.

---

## PUBLIC Schema Indexes

### PUBLIC.USERS

| Index               | Columns   | Purpose                          |
| ------------------- | --------- | -------------------------------- |
| `idx_users_auth_id` | `auth_id` | Fast lookup by Supabase auth ID. |

---

### PUBLIC.WORLDS

| Index                 | Columns    | Purpose                               |
| --------------------- | ---------- | ------------------------------------- |
| `idx_worlds_owner_id` | `owner_id` | Quickly fetch worlds owned by a user. |

---

### PUBLIC.WORLD_ACCESS

| Index                           | Columns                      | Purpose                            |
| ------------------------------- | ---------------------------- | ---------------------------------- |
| `idx_world_access_world_id`     | `world_id`                   | Find all members in a world.       |
| `idx_world_access_user_id`      | `user_id`                    | Find all worlds a user belongs to. |
| `idx_world_access_world_user`   | `(world_id, user_id)`        | Prevent duplicate memberships.     |
| `idx_world_access_user_created` | `(user_id, created_at DESC)` | Sort recent worlds per user.       |

---

## FEATURE_FLAGS Schema Indexes

### FEATURE_FLAGS.FEATURE_FLAGS

| Index                          | Columns           | Purpose                       |
| ------------------------------ | ----------------- | ----------------------------- |
| `idx_feature_flags_updated_at` | `updated_at DESC` | Fetch recently updated flags. |

---

### FEATURE_FLAGS.ENTITLEMENTS

| Index                         | Columns      | Purpose                                    |
| ----------------------------- | ------------ | ------------------------------------------ |
| `idx_entitlements_user_id`    | `user_id`    | Find all entitlements for a user.          |
| `idx_entitlements_key`        | `key`        | Fast lookup by entitlement key.            |
| `idx_entitlements_id`         | `id`         | Direct lookup by entitlement ID.           |
| `idx_entitlements_expires_at` | `expires_at` | Identify expired entitlements for cleanup. |

---

### FEATURE_FLAGS.FEATURE_FLAG_OVERRIDES

| Index                       | Columns                                      | Purpose                               |
| --------------------------- | -------------------------------------------- | ------------------------------------- |
| `idx_overrides_user_target` | `(user_id, target_type, target_name)` UNIQUE | Prevent duplicate overrides per user. |
| `idx_overrides_expires_at`  | `expires_at`                                 | Identify expired overrides.           |
| `idx_overrides_user_id`     | `user_id`                                    | Find all overrides for a user.        |

---

### FEATURE_FLAGS.FEATURE_FLAG_ROLLOUTS

| Index                                        | Columns                  | Purpose                                                       |
| -------------------------------------------- | ------------------------ | ------------------------------------------------------------- |
| `idx_feature_flag_rollouts_flag_name`        | `flag_name`              | Fast lookup of rollout config by flag name.                   |
| `idx_feature_flag_rollouts_flag_name_active` | `(flag_name, is_active)` | Efficient lookup when filtering active rollouts by flag name. |
| `idx_feature_flag_rollouts_is_active`        | `is_active`              | Filter only active rollouts during Edge Function.             |

---
