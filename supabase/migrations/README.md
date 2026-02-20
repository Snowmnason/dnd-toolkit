# supabase/migrations

Database schema migrations for the dnd-toolkit application.

## Overview

Migrations are organized chronologically and must be run in order:

1. **001_public_schema.sql** — Core public schema (users, authentication)
2. **002_worlds_schema.sql** — Worlds and access control
3. **003_feature_flags_schema.sql** — Feature flags, entitlements, rollouts
4. **004_audit_schema.sql** — Audit logging and change tracking
5. **005_add_cohorts.sql** — Cohort management and user cohort memberships

## Public Schema (001)

### Tables

| Table | Purpose | Key Columns | Indexes | Constraints |
|-------|---------|-------------|---------|-------------|
| `public.users` | Core identity; bridges auth.users to app | `id` (uuid PK), `auth_id` (uuid FK), `username`, `is_admin`, `created_at`, `updated_at`, `deleted_at` (soft delete) | `auth_id` (unique), `created_at DESC`, `deleted_at IS NULL` (partial) | FK to `auth.users(id)`, username not empty |
| `public.user_settings` | Per-user preferences & consent | `user_id` (uuid PK FK), `theme`, `language`, `timezone`, `preferences` (jsonb), `analytics_consent_level` ('none' \| 'basic' \| 'full', default 'basic'), `updated_at` | `user_id` (PK) | FK to `public.users(id)`, `theme` IN valid values, `analytics_consent_level` IN ('none', 'basic', 'full') |

### Semantics

**`analytics_consent_level` column:**
- **'none'**: No analytics tracking (strict privacy)
- **'basic'**: Essential tracking only (errors, auth events, GDPR minimum)
- **'full'**: All tracking enabled (usage, performance, diagnostics)
- **Default**: 'basic' (GDPR-safe, privacy-first)
- **Synced from**: `SecureStorage` at app runtime; optional server sync for cross-device agreement
- **Auto-initialized**: ON signup via `handle_new_user()` trigger to default 'basic'
- **Updated by**: Users via settings UI, synced to SecureStorage + queued for database update

## Feature Flags Schema (003/004/005)

### Tables

| Table | Purpose | Rows | Key Indexes |
|-------|---------|------|-------------|
| `feature_flags.feature_flags` | Master list of flags | 1-100 | `flag_name` (PK), `updated_at`, GIN `depends_on`, GIN `condition_logic`, GIN `metadata` |
| `feature_flags.entitlements` | User premium features | 1K-10K | `id` (PK), btree `user_id`, btree `key`, unique `(user_id, key)`, partial `user_id IS NULL` |
| `feature_flags.feature_flag_overrides` | Admin per-user flag toggles | 10-1K | `id` (PK), unique `(user_id, flag_name)`, `updated_at`, `user_id` |
| `feature_flags.entitlements_overrides` | Admin per-user entitlement toggles | 10-1K | `id` (PK), unique `(user_id, entitlement_key)`, `updated_at`, `user_id` |
| `feature_flags.feature_flag_rollouts` | Percentage-based rollout configs | 1-100 | `flag_name` (unique), btree `percentage` |
| `feature_flags.cohorts` | Named cohort definitions | 5-50 | `id` (PK), `slug` (unique), partial `is_active=true` |
| `feature_flags.cohort_flag_assignments` | Flag → cohort requirements | 10-500 | `flag_name`, btree `flag_name`, `cohort_id` |
| `feature_flags.user_cohort_memberships` | User → cohort assignments | 1K-10K | `user_id`, `cohort_id`, partial `is_active=true` |
| `audit.audit_events` | Unified audit log | Unbounded | btree `table_schema`, `table_name`, `record_id`, `initiated_by`, `created_at DESC`, composite `(table_schema, table_name, created_at DESC)` |

### Row-Level Security (RLS) Policies

**`feature_flags.feature_flags`** (Global flags)
- Public SELECT `enabled = true` (all users see enabled flags)
- Service role: all access

**`feature_flags.entitlements`** (User entitlements)
- Authenticated users: SELECT own entitlements (WHERE `user_id = current_user_id`)
- Service role: all access

**`feature_flags.feature_flag_overrides`** (Per-user flag overrides)
- Admin only: SELECT/INSERT/UPDATE/DELETE (checked via `public.is_admin()`)

**`feature_flags.entitlements_overrides`** (Per-user entitlement overrides)
- Admin only: SELECT/INSERT/UPDATE/DELETE

**`feature_flags.cohorts`** (Cohort definitions)
- Public SELECT: active cohorts only (`is_active = true`)
- Admin: all access

**`feature_flags.user_cohort_memberships`** (User cohort membership)
- Authenticated users: SELECT own memberships (WHERE `user_id = current_user_id` AND non-expired)
- Admin: all access

**`audit.audit_events`** (Audit logs)
- Authenticated admins: SELECT all records (via `public.is_admin()`)
- Authenticated users: SELECT own records (WHERE `initiated_by = current_user_id`)

### Indexes & Performance

**Why these indexes exist:**

| Index | Table | Rationale |
|-------|-------|-----------|
| GIN `depends_on` | `feature_flags.feature_flags` | Fast `@>` (contains) queries for dependency resolution |
| GIN `condition_logic`, `metadata` | `feature_flags.feature_flags` | JSONB path searches for complex conditions |
| Unique `(user_id, key)` | `feature_flags.entitlements` | Prevent duplicate entitlements per user |
| Unique `(user_id, flag_name)` | `feature_flags.feature_flag_overrides` | Prevent duplicate overrides per user |
| Partial `user_id IS NULL` | `feature_flags.entitlements` | Fast lookup of org-wide entitlements (no user) |
| Partial `is_active=true` | `feature_flags.cohorts`, `user_cohort_memberships` | Query only active records (most common case) |
| `created_at DESC` | `audit.audit_events` | Recent events first (admin dashboard) |
| Composite `(schema, table, time)` | `audit.audit_events` | Ad-hoc queries for "recent changes to X table" |

**Expected query performance:**

- `SELECT * FROM feature_flags WHERE enabled=true` — **<10ms** (PK scan)
- `SELECT * FROM entitlements WHERE user_id=X AND is_active=true` — **<5ms** (btree + filter)
- `SELECT * FROM feature_flag_overrides WHERE user_id=X` — **<5ms** (unique index)
- Rollout bucketing (in-memory hash, no DB) — **<1ms**
- Audit query `WHERE table_name='entitlements' AND created_at DESC` — **<50ms** (composite index)

### Triggers

**Audit triggers** (created in 004_audit_schema.sql)
- Generic trigger function: `audit.log_change()` ← captures INSERT/UPDATE/DELETE as JSONB snapshots
- Attached to: `feature_flags`, `entitlements`, `feature_flag_overrides`, `entitlements_overrides`, `cohorts`, `cohort_flag_assignments`, `user_cohort_memberships`
- Writes to: `audit.audit_events`
- **Overhead:** ~1-2ms per write (async; doesn't block transaction)

**Timestamp triggers** (created in 003/005)
- Function `public.update_timestamp()` ← auto-updates `updated_at` on every change
- Attached to: all feature flag tables
- **Overhead:** <1ms

**Cohort membership triggers** (created in 005)
- Function `feature_flags.user_cohort_memberships_set_is_active()` ← maintains `is_active` based on `expires_at`
- Ensures partial indexes stay accurate
- **Overhead:** <1ms

### Known Limitations & Future Improvements

1. **Audit completeness:** Audit schema captures DML (INSERT/UPDATE/DELETE) but not DCL (GRANT/REVOKE)
   - **Mitigation:** Document privilege changes manually in PR reviews
   - **Future:** Add Postgres role audit triggers (Phase 2+)

2. **Large-scale entitlements:** If >100K active entitlements, consider:
   - Partitioning by `user_id` (time-based or range)
   - Archive and purge old audit records (audit.audit_events)
   - **Current scale:** Safe for <1M rows per table

3. **Realtime subscriptions:** Each client subscribes to 7 channels (flags, entitlements, overrides, rollouts, cohorts, etc.)
   - **Overhead:** <100KB memory per connection; scales to ~1000 concurrent users per Supabase plan
   - **Future:** Consider channel consolidation or subscription filtering

## Running Migrations

### Development

```bash
# (Migrations run automatically via Supabase CLI during `supabase start`)
supabase db push
```

### Production

```bash
# Via Supabase Dashboard:
# 1. Navigate to SQL Editor
# 2. Run migrations in order (001 → 005)
# 3. Verify triggers and indexes are created
# 4. Test RLS policies with a test user account

# Or via CLI (if available):
supabase db push --linked  # Pushes to linked production DB
```

## Maintenance

### Regular Checks

**Weekly:**
- Monitor `audit.audit_events` table size (should grow ~10-100K rows/week depending on activity)
- Check slow query log for any audit trigger slowdowns

**Monthly:**
- Review RLS policies to ensure no unintended access
- Check index bloat via `pg_stat_user_indexes` (should be <20% bloat)

**Quarterly:**
- Archive audit events older than 6 months (optional retention policy)
- Validate indexes still exist and are in use

### Troubleshooting

**"Permission denied" on entitlements:**
- Check RLS policies: `SELECT * FROM pg_policies WHERE schemaname='feature_flags'`
- Verify user is authenticated: `SELECT current_user`
- Admin checks: `SELECT public.is_admin()` should return true

**Slow flag fetches:**
- Check if indexes exist: `SELECT * FROM pg_indexes WHERE tablename LIKE 'feature_flags%'`
- Run `ANALYZE feature_flags.feature_flags` to update statistics
- Check query plan: `EXPLAIN SELECT * FROM feature_flags WHERE enabled=true`

**Audit trigger failures:**
- Check if trigger is attached: `SELECT * FROM pg_triggers WHERE tablename='feature_flags'`
- Test trigger manually: `INSERT INTO feature_flags VALUES (...) RETURNING *`
- Review audit function: `\df audit.log_change()`

## See Also

- [lib/feature-flags/README.md](../../lib/feature-flags/README.md) — Client-side flag system
- [lib/database/README.md](../../lib/database/README.md) — Database query helpers
- [docs/issues/MileStone 2/Tier 3/](../../docs/issues/MileStone%202/Tier%203/) — Feature flag implementation details
