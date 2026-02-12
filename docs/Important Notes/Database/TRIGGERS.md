# Triggers — DnD Toolkit

All triggers documented here match migrations 001–004. Source of truth: `supabase/migrations/`.

---

## Trigger Summary

| Trigger | Table | Event | Function | Purpose |
| --- | --- | --- | --- | --- |
| `on_auth_user_created` | `auth.users` | AFTER INSERT | `public.handle_new_user()` | Auto-create users + user_settings on signup |
| `trg_users_updated_at` | `public.users` | BEFORE UPDATE | `public.update_timestamp()` | Auto-update `updated_at` |
| `trg_user_settings_updated_at` | `public.user_settings` | BEFORE UPDATE | `public.update_timestamp()` | Auto-update `updated_at` |
| `trg_worlds_updated_at` | `worlds.worlds` | BEFORE UPDATE | `public.update_timestamp()` | Auto-update `updated_at` |
| `trg_world_access_updated_at` | `worlds.world_access` | BEFORE UPDATE | `public.update_timestamp()` | Auto-update `updated_at` |
| `trg_prevent_owner_change` | `worlds.worlds` | BEFORE UPDATE | `worlds.prevent_owner_change()` | Block `owner_id` changes |
| `trg_create_owner_access` | `worlds.worlds` | AFTER INSERT | `worlds.create_owner_access()` | Auto-grant owner DM access |
| `trg_feature_flags_updated_at` | `feature_flag.feature_flags` | BEFORE UPDATE | `public.update_timestamp()` | Auto-update `updated_at` |
| `trg_entitlements_updated_at` | `feature_flag.entitlements` | BEFORE UPDATE | `public.update_timestamp()` | Auto-update `updated_at` |
| `trg_overrides_updated_at` | `feature_flag.feature_flag_overrides` | BEFORE UPDATE | `public.update_timestamp()` | Auto-update `updated_at` |
| `trg_entitlements_overrides_updated_at` | `feature_flag.entitlements_overrides` | BEFORE UPDATE | `public.update_timestamp()` | Auto-update `updated_at` |
| `trg_rollouts_updated_at` | `feature_flag.feature_flag_rollouts` | BEFORE UPDATE | `public.update_timestamp()` | Auto-update `updated_at` |
| `trg_audit_users` | `public.users` | AFTER INS/UPD/DEL | `audit.log_change()` | Audit log |
| `trg_audit_user_settings` | `public.user_settings` | AFTER INS/UPD/DEL | `audit.log_change()` | Audit log |
| `trg_audit_invite_links` | `worlds.invite_links` | AFTER INS/UPD/DEL | `audit.log_change()` | Audit log |
| `trg_audit_worlds` | `worlds.worlds` | AFTER INS/UPD/DEL | `audit.log_change()` | Audit log |
| `trg_audit_world_access` | `worlds.world_access` | AFTER INS/UPD/DEL | `audit.log_change()` | Audit log |
| `trg_audit_feature_flags` | `feature_flag.feature_flags` | AFTER INS/UPD/DEL | `audit.log_change()` | Audit log |
| `trg_audit_entitlements` | `feature_flag.entitlements` | AFTER INS/UPD/DEL | `audit.log_change()` | Audit log |
| `trg_audit_entitlements_overrides` | `feature_flag.entitlements_overrides` | AFTER INS/UPD/DEL | `audit.log_change()` | Audit log |
| `trg_audit_feature_flag_overrides` | `feature_flag.feature_flag_overrides` | AFTER INS/UPD/DEL | `audit.log_change()` | Audit log |
| `trg_audit_feature_flag_rollouts` | `feature_flag.feature_flag_rollouts` | AFTER INS/UPD/DEL | `audit.log_change()` | Audit log |

---

## Trigger Functions

### public.update_timestamp()

Shared `BEFORE UPDATE` trigger function used by all tables with `updated_at`.

```sql
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    IF ROW(OLD.*) IS DISTINCT FROM ROW(NEW.*) THEN
      NEW.updated_at = now();
    END IF;
  ELSE
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;
```

**Key behavior**: Only updates `updated_at` if the row actually changed (`IS DISTINCT FROM`). This prevents churn from no-op updates that would otherwise generate unnecessary audit events and cache invalidations.

---

### public.handle_new_user()

Auth signup trigger (SECURITY DEFINER). Fires `AFTER INSERT` on `auth.users`.

- Creates `public.users` row with `auth_id` linked to the new auth user
- Creates `public.user_settings` row with defaults
- Idempotent via `ON CONFLICT` — safe against duplicate trigger calls
- Extracts `username` from `raw_user_meta_data` (falls back to `'changeling'`)

**Status**: Implemented in migration 001. Trigger name: `on_auth_user_created`.

---

### worlds.prevent_owner_change()

`BEFORE UPDATE` on `worlds.worlds`. Prevents any modification to `owner_id`.

```sql
IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
  RAISE EXCEPTION 'Cannot change world owner via UPDATE. Use ownership transfer function.';
END IF;
```

**Note**: This trigger is on `worlds.worlds`, NOT `worlds.world_access`. It prevents changing world ownership — not membership roles. Role changes go through `worlds.change_user_role()` RPC.

---

### worlds.create_owner_access()

`AFTER INSERT` on `worlds.worlds` (SECURITY DEFINER). Auto-creates a `world_access` row granting the world owner the `'dm'` role.

```sql
INSERT INTO worlds.world_access (world_id, user_id, user_role)
VALUES (NEW.world_id, NEW.owner_id, 'dm'::worlds.world_access_role)
ON CONFLICT (world_id, user_id) DO NOTHING;
```

Ensures the owner always has a membership row without requiring a separate client-side insert.

---

### audit.log_change()

Generic `AFTER INSERT OR UPDATE OR DELETE` trigger (SECURITY DEFINER). Writes to `audit.audit_events`.

- Auto-detects `table_schema` and `table_name` from trigger context (`TG_TABLE_SCHEMA`, `TG_TABLE_NAME`)
- Extracts PK by trying common column names: `id` → `world_id` → `user_id` → `flag_name` → `key` → `'unknown'`
- Captures `old_data`/`new_data` as JSONB snapshots
- Resolves `initiated_by` via `public.get_current_user_id()` (NULL for service_role/system)
- Attached to **all 10 tracked tables** across all schemas

---

## Tables Without updated_at Triggers

| Table | Reason |
| --- | --- |
| `worlds.invite_links` | No `updated_at` column — invites are created then expired/deleted, never updated |
| `audit.audit_events` | Immutable — no updates allowed |

---

_Last Updated: Feb 11, 2026 (Post-Audit — matches migrations 001–004)_