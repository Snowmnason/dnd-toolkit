# ⏱️ Triggers — DnD Toolkit

This document describes all database triggers used in the D&D Toolkit schema. Triggers are automatic actions that run on INSERT, UPDATE, or DELETE events.

---

## Overview

**Trigger Organization:**

- **schema-based:** Triggers defined in their respective schema (public, feature_flags, audit)
- **purpose-based:** Maintenance (timestamps), enforcement (constraints), audit logging

---

## Public Schema Triggers

### 1. `trg_updated_at` (Multiple Tables)

**Tables:** `users`, `worlds`, `world_access`, `invite_links`

**Event:** BEFORE UPDATE

**Purpose:** Automatically update the `updated_at` timestamp whenever a row is modified.

**PostgreSQL:**

```sql
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
```

**Behavior:**

- Fires on: UPDATE to any row
- Action: Sets `NEW.updated_at := now()`
- Effect: Maintains accurate cache invalidation & audit timestamps

---

### 2. `trg_handle_new_user` (New User Creation)

**Table:** `public.users`

**Event:** After INSERT via Supabase Auth signup

**Purpose:** Create a new `public.users` row whenever `auth.users` is created.

**Trigger Location:** Supabase Auth → Trigger to public.users on auth.uid change

**Expected Behavior:**

- When user signs up: `auth.users` row created
- Trigger fires: inserts row into `public.users` with `auth_id = new_auth_user.id`
- New user ready for world creation, entitlements, etc.

**Current Status:** ⚠️ **Not yet implemented** — See backend setup guide

---

## Worlds Schema Triggers

### 1. `trg_create_owner_access`

**Table:** `worlds.world_access`

**Event:** AFTER INSERT

**Purpose:** Automatically create a `world_access` row giving the world owner access with role `'dm'`.

**PostgreSQL:**

```sql
CREATE OR REPLACE FUNCTION worlds.create_owner_access()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO worlds.world_access (world_id, user_id, user_role)
  VALUES (NEW.world_id, NEW.owner_id, 'dm')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_owner_access AFTER INSERT ON worlds.worlds
  FOR EACH ROW EXECUTE FUNCTION worlds.create_owner_access();
```

**Behavior:**

- Fires on: INSERT to `worlds` table (creating a new campaign)
- Action: Inserts row into `world_access(world_id, user_id, user_role)`
- Effect: Ensures owner automatically has `'dm'` access; no manual grant needed

---

### 2. `trg_updated_at` (Worlds Tables)

**Tables:** `worlds.worlds`, `worlds.world_access`

**Event:** BEFORE UPDATE

**Purpose:** Update `updated_at` timestamp on modification.

**PostgreSQL:**

```sql
CREATE TRIGGER trg_updated_at BEFORE UPDATE ON worlds.worlds
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER trg_updated_at BEFORE UPDATE ON worlds.world_access
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
```

---

### 3. `trg_prevent_owner_change`

**Table:** `worlds.world_access`

**Event:** BEFORE UPDATE

**Purpose:** Prevent removal or modification of the owner's `'dm'` access grant.

**PostgreSQL:**

```sql
CREATE OR REPLACE FUNCTION worlds.prevent_owner_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (NEW.user_role != OLD.user_role OR NEW.user_id != OLD.user_id)
    AND EXISTS (
      SELECT 1 FROM worlds.worlds w
      WHERE w.world_id = NEW.world_id AND w.owner_id = OLD.user_id
    )
  THEN
    RAISE EXCEPTION 'Cannot modify owner access grant';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_owner_change BEFORE UPDATE ON worlds.world_access
  FOR EACH ROW EXECUTE FUNCTION worlds.prevent_owner_change();
```

**Behavior:**

- Fires on: UPDATE to `world_access`
- Checks: Is this row the owner's access grant?
- Action: RAISE EXCEPTION if attempting to change owner role
- Effect: Prevents accidental owner lock-out

---

## Feature Flags Schema Triggers

### 1. `trg_updated_at` (Feature Flag Tables)

**Tables:** `feature_flags.feature_flags`, `feature_flags.entitlements`, `feature_flags.feature_flag_overrides`, `feature_flags.entitlements_overrides`, `feature_flags.feature_flag_rollouts`

**Event:** BEFORE UPDATE

**Purpose:** Automatically maintain `updated_at` timestamps.

**PostgreSQL:**

```sql
CREATE TRIGGER trg_updated_at BEFORE UPDATE ON feature_flags.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
```

---

## Audit Schema Triggers

### 1. `trg_audit` (All Tables)

**Tables:**

- `public.users`, `public.user_settings`, `public.invite_links`
- `worlds.worlds`, `worlds.world_access`
- `feature_flags.feature_flags`, `feature_flags.entitlements`, `feature_flags.entitlements_overrides`, `feature_flags.feature_flag_overrides`, `feature_flags.feature_flag_rollouts`

**Event:** AFTER INSERT, UPDATE, or DELETE

**Purpose:** Log all data changes to the unified `audit.events` table for compliance and audit trails.

**PostgreSQL:**

```sql
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();

CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON feature_flags.entitlements
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();
-- ... etc for all tracked tables
```

**Trigger Function (`audit.log_change`):**

- Auto-detects schema, table, and primary key
- Captures `initiatedby` user (NULL for service_role ops)
- Stores `old_data` (on UPDATE/DELETE) and `new_data` (on INSERT/UPDATE) as JSONB
- Writes immutable record to `audit.events`

**Behavior:**

- Fires on: Any INSERT, UPDATE, DELETE across all tracked tables
- Action: Calls `audit.log_change()` with trigger context
- Effect: Produces comprehensive audit trail; all changes queryable later

**Audit Record Example:**

```json
{
  "id": "uuid...",
  "table_schema": "feature_flags",
  "table_name": "entitlements",
  "record_id": "uuid...",
  "event_type": "update",
  "initiated_by": "uuid...",
  "old_data": { "is_active": true, "expires_at": null },
  "new_data": { "is_active": false, "expires_at": "2026-03-01T00:00:00Z" },
  "created_at": "2026-02-08T15:30:00Z"
}
```

---

## Maintenance Triggers

### Background Job: `mark_expired_entitlements_inactive()`

**Table:** `feature_flags.entitlements`

**Event:** Periodic (scheduled), not a database trigger

**Purpose:** Mark expired entitlements as `is_active = false` for cleanup and soft-delete.

**PostgreSQL:**

```sql
CREATE OR REPLACE FUNCTION feature_flags.mark_expired_entitlements_inactive()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = feature_flags
AS $$
  UPDATE entitlements
  SET is_active = false
  WHERE is_active = true
    AND expires_at IS NOT NULL
    AND expires_at <= now();
$$;
```

**Execution:**

- Called via background job system (see `lib/jobs/`)
- Typically runs every hour or on-demand
- Updates expired entitlements WITHOUT deleting them (maintains audit trail)

---

## Trigger Best Practices

✅ **DO:**

- Use BEFORE triggers for validation/transformation
- Use AFTER triggers for logging/cascading actions
- Keep trigger logic simple and fast (defer heavy computation to app layer)
- Document trigger purpose and behavior clearly
- Update audit trail when modifying critical data

❌ **DON'T:**

- Create recursive triggers (trigger fires trigger fires recursively → deadlock)
- Use triggers for complex business logic (app layer is clearer)
- Modify other tables without audit logging
- Ignore performance impact of triggers on bulk operations

---

## Testing Triggers

**Verify timestamp updates:**

```sql
SELECT created_at, updated_at FROM public.users WHERE id = 'uuid...';
-- created_at should differ from updated_at after UPDATE
```

**Verify owner access creation:**

```sql
SELECT * FROM worlds.world_access WHERE world_id = 'uuid...' AND user_role = 'dm';
-- Should exist immediately after world creation
```

**Verify audit logging:**

```sql
SELECT * FROM audit.events WHERE table_name = 'entitlements' ORDER BY created_at DESC LIMIT 5;
-- Should show recent changes to entitlements
```

**Verify prevent_owner_change:**

```sql
UPDATE worlds.world_access SET user_role = 'player'
WHERE user_id = (SELECT owner_id FROM worlds.worlds WHERE world_id = 'uuid...')
  AND world_id = 'uuid...';
-- Should return: ERROR: Cannot modify owner access grant
```

---

_Last Updated: Feb 8, 2026_
