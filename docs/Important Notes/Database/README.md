# Database Documentation

Reference for the complete database schema across all 4 migrations (001–004).

## Contents

- **[SCHEMA.md](SCHEMA.md)** — Tables, columns, constraints, enums, and helper functions
- **[RLS.md](RLS.md)** — Row Level Security policies per table
- **[INDEXES.md](INDEXES.md)** — Index reference for performance and query optimization
- **[TRIGGERS.md](TRIGGERS.md)** — Database triggers for timestamps, enforcement, and audit
- **[EDGE_FUNCTIONS.md](EDGE_FUNCTIONS.md)** — Supabase Edge Functions (serverless RPC endpoints)

## Architecture

The database is organized into **4 schemas**:

| Schema           | Purpose                                | Migration | Tables                                                                                            |
| ---------------- | -------------------------------------- | --------- | ------------------------------------------------------------------------------------------------- |
| **public**       | Core identity & auth integration       | 001       | `users`, `user_settings`                                                                          |
| **worlds**       | Campaign worlds & access control       | 002       | `worlds`, `world_access`, `invite_links` (+ `world_access_role` ENUM)                            |
| **feature_flag** | Feature control & entitlements         | 003       | `feature_flags`, `entitlements`, `entitlements_overrides`, `feature_flag_overrides`, `feature_flag_rollouts` |
| **audit**        | Immutable audit log                    | 004       | `audit_events`                                                                                    |

## Exposed Schemas (Supabase Dashboard)

After running migrations, expose these schemas in **Supabase Dashboard → Settings → API → Exposed Schemas**:
- `worlds`
- `feature_flag`
- `audit` *(optional — only if admin API access to audit logs is needed)*

## Key Conventions

- **Soft-delete**: `users` and `worlds` use `deleted_at` column; `NULL` = active
- **Timestamps**: All tables have `created_at`; most have `updated_at` managed by `public.update_timestamp()` trigger
- **Auth bridge**: `public.users.auth_id` links to `auth.users.id`; `public.get_current_user_id()` resolves the internal user ID for RLS
- **Admin check**: `public.is_admin()` checks `users.is_admin` in DB (not JWT claims)
- **Server-side writes**: Most tables block client INSERT/DELETE via RLS; use RPC functions or Edge Functions instead

## For Developers

1. Read [SCHEMA.md](SCHEMA.md) to understand the data model
2. Read [RLS.md](RLS.md) to understand access control
3. Check [TRIGGERS.md](TRIGGERS.md) for automatic behaviors (timestamps, owner access, audit)
4. Use [EDGE_FUNCTIONS.md](EDGE_FUNCTIONS.md) for server-side operations

_Last Updated: Feb 11, 2026 (Post-Audit)_
