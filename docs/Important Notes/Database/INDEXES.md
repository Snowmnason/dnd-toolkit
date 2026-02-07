# 🧩 Database Index Reference — DnD Toolkit

This file documents the current PostgreSQL indexes in Supabase.  
**Do not run these manually** — they already exist in production.  
This is for developer reference only.

---

## PUBLIC.USERS

| Index               | Columns   | Purpose                          |
| ------------------- | --------- | -------------------------------- |
| `idx_users_auth_id` | `auth_id` | Fast lookup by Supabase auth ID. |

---

## PUBLIC.WORLDS

| Index                 | Columns    | Purpose                               |
| --------------------- | ---------- | ------------------------------------- |
| `idx_worlds_owner_id` | `owner_id` | Quickly fetch worlds owned by a user. |

---

## PUBLIC.WORLD_ACCESS

| Index                           | Columns                      | Purpose                            |
| ------------------------------- | ---------------------------- | ---------------------------------- |
| `idx_world_access_world_id`     | `world_id`                   | Find all members in a world.       |
| `idx_world_access_user_id`      | `user_id`                    | Find all worlds a user belongs to. |
| `idx_world_access_world_user`   | `(world_id, user_id)`        | Prevent duplicate memberships.     |
| `idx_world_access_user_created` | `(user_id, created_at DESC)` | Sort recent worlds per user.       |

---

## PUBLIC.FEATURE_FLAG_ROLLOUTS

| Index                                        | Columns                  | Purpose                                                       |
| -------------------------------------------- | ------------------------ | ------------------------------------------------------------- |
| `idx_feature_flag_rollouts_flag_name`        | `flag_name`              | Fast lookup of rollout config by flag name.                   |
| `idx_feature_flag_rollouts_flag_name_active` | `(flag_name, is_active)` | Efficient lookup when filtering active rollouts by flag name. |
| `idx_feature_flag_rollouts_is_active`        | `is_active`              | Filter only active rollouts during Edge Function.             |

---
