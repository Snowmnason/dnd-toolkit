# 🔒 Row Level Security (RLS) Policies — DnD Toolkit

Complete Row Level Security documentation for all schemas. These policies enable fine-grained access control at the database level and are automatically enforced by Supabase/PostgreSQL.

---

## Policy Summary by Schema

### PUBLIC Schema

| Table            | Policy Name                           | Command    | Role(s)               | Condition                                   |
| ---------------- | ------------------------------------- | ---------- | --------------------- | ------------------------------------------- |
-- Simplified worlds policies (owner OR member can read; owner-only writes).
-- Avoids RLS recursion by directing membership checks only from `worlds` -> `world_access`.
CREATE POLICY select_if_owner_or_member ON worlds.worlds
  FOR SELECT TO authenticated
  USING (
    owner_id = public.get_current_user_id()
    OR EXISTS (
      SELECT 1 FROM worlds.world_access wa
      WHERE wa.world_id = worlds.world_id
        AND wa.user_id = public.get_current_user_id()
    )
  );

-- Owner-only semantics for writes to worlds
CREATE POLICY worlds_owner_write ON worlds.worlds
  FOR ALL TO authenticated
  USING (owner_id = public.get_current_user_id())
  WITH CHECK (owner_id = public.get_current_user_id());
| **feature_flag_rollouts**  | `rollouts_authenticated_read`    | SELECT                 | authenticated         | Authenticated users can read rollouts  |
| **feature_flag_rollouts**  | `rollouts_admin_write`           | INSERT, UPDATE, DELETE | authenticated (admin) | Admins can manage rollouts             |

### AUDIT Schema

| Table        | Policy Name                      | Command | Role(s)       | Condition                               |
| ------------ | -------------------------------- | ------- | ------------- | --------------------------------------- |
| **events**   | `audit_admin_select`             | SELECT  | authenticated | Admins can read all audit records      |
| **events**   | `audit_own_select`               | SELECT  | authenticated | Users can read audit records they initiated |

---

## SQL Definitions — All Policies

### Enable RLS on All Tables

```sql
-- PUBLIC Schema
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invite_links ENABLE ROW LEVEL SECURITY;

-- WORLDS Schema
ALTER TABLE IF EXISTS worlds.worlds ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS worlds.world_access ENABLE ROW LEVEL SECURITY;

-- FEATURE_FLAGS Schema
ALTER TABLE IF EXISTS feature_flags.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS feature_flags.entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS feature_flags.entitlements_overrides ENABLE ROW LEVEL SECURITY;
-- Simplified world_access policies: members can read their own rows; client-side writes are denied.
CREATE POLICY allow_self ON worlds.world_access
  FOR SELECT TO authenticated
  USING (user_id = public.get_current_user_id());

-- Deny client-side INSERT/UPDATE/DELETE to ensure membership changes go through
-- application logic or a SECURITY DEFINER function.
CREATE POLICY deny_inserts ON worlds.world_access
  FOR INSERT TO public
  WITH CHECK (false);

CREATE POLICY deny_updates ON worlds.world_access
  FOR UPDATE TO public
  USING (false)
  WITH CHECK (false);

CREATE POLICY deny_deletes ON worlds.world_access
  FOR DELETE TO public
  USING (false);
CREATE POLICY "invite_links_public_read" ON public.invite_links
  FOR SELECT TO public
  USING (expires_at > now());

-- invite_links_owner_select: World owners can view their invite links
CREATE POLICY "invite_links_owner_select" ON public.invite_links
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM worlds.worlds w
    JOIN public.users u ON w.owner_id = u.id
    WHERE u.auth_id = auth.uid() AND w.world_id = invite_links.world_id
  ));

-- invite_links_insert_owner: World owners/DMs can create invite links
CREATE POLICY "invite_links_insert_owner" ON public.invite_links
  FOR INSERT TO authenticated
  WITH CHECK (
    world_id IS NULL OR EXISTS (
      SELECT 1 FROM worlds.worlds w
      JOIN public.users u ON w.owner_id = u.id
      WHERE u.auth_id = auth.uid() AND w.world_id = invite_links.world_id
    )
  );
```

---

## WORLDS Schema Policies

### WORLDS Policies

```sql
-- worlds_owner_all: Owners have full access to their worlds
CREATE POLICY "worlds_owner_all" ON worlds.worlds
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = worlds.owner_id AND u.auth_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = worlds.owner_id AND u.auth_id = auth.uid()
  ));

-- worlds_member_select: Members can view worlds they have access to
CREATE POLICY "worlds_member_select" ON worlds.worlds
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM worlds.world_access wa
    JOIN public.users u ON u.id = wa.user_id
    WHERE wa.world_id = worlds.world_id AND u.auth_id = auth.uid()
  ));

-- worlds_member_update: Members can update worlds they have access to
CREATE POLICY "worlds_member_update" ON worlds.worlds
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM worlds.world_access wa
    JOIN public.users u ON u.id = wa.user_id
    WHERE wa.world_id = worlds.world_id AND u.auth_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM worlds.world_access wa
    JOIN public.users u ON u.id = wa.user_id
    WHERE wa.world_id = worlds.world_id AND u.auth_id = auth.uid()
  ));
```

### WORLD_ACCESS Policies

```sql
-- world_access_owner_all: World owners manage all access grants
CREATE POLICY "world_access_owner_all" ON worlds.world_access
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM worlds.worlds w
    WHERE w.world_id = world_access.world_id
      AND w.owner_id = public.get_current_user_id()
      AND w.deleted_at IS NULL
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM worlds.worlds w
    WHERE w.world_id = world_access.world_id
      AND w.owner_id = public.get_current_user_id()
      AND w.deleted_at IS NULL
  ));

-- world_access_member_select: Members can view all members in worlds they belong to (roster visibility)
-- Fixed: avoid infinite recursion by checking worlds table and user_id directly
-- Users can view roster if they own the world OR are a member
CREATE POLICY "world_access_member_select" ON worlds.world_access
  FOR SELECT TO authenticated
  USING (
    -- User is the owner of this world, OR
    EXISTS (
      SELECT 1 FROM worlds.worlds w
      WHERE w.world_id = world_access.world_id
        AND w.owner_id = public.get_current_user_id()
    )
    OR
    -- User is already a member (check owner in worlds table instead of recursing)
    user_id = public.get_current_user_id()
  );

-- world_access_member_delete_own: Members can remove themselves from a world (leave), but owners cannot delete their owner row
CREATE POLICY "world_access_member_delete_own" ON worlds.world_access
  FOR DELETE TO authenticated
  USING (
    user_id = public.get_current_user_id()
    AND NOT EXISTS(
      SELECT 1 FROM worlds.worlds w
      WHERE w.world_id = world_access.world_id
        AND w.owner_id = public.get_current_user_id()
    )
  );

-- world_access_admin_all: Admins have full access to all world_access records
CREATE POLICY "world_access_admin_all" ON worlds.world_access
  FOR ALL TO authenticated
  USING (public.is_admin());

-- world_access_member_self: Members manage their own access records
CREATE POLICY "world_access_member_self" ON worlds.world_access
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = world_access.user_id AND u.auth_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = world_access.user_id AND u.auth_id = auth.uid()
  ));
```

---

## FEATURE_FLAGS Schema Policies

### FEATURE_FLAGS Policies

```sql
-- feature_flags_public_read: All can read feature flags (public defaults)
CREATE POLICY "feature_flags_public_read" ON feature_flags.feature_flags
  FOR SELECT TO public
  USING (true);

-- feature_flags_admin_write: Admins can manage feature flags
CREATE POLICY "feature_flags_admin_write" ON feature_flags.feature_flags
  FOR INSERT, UPDATE, DELETE TO authenticated
  WITH CHECK (auth.jwt()->>'role' = 'admin');
```

### ENTITLEMENTS Policies

```sql
-- entitlements_user_read_own: Users can read their own entitlements
CREATE POLICY "entitlements_user_read_own" ON feature_flags.entitlements
  FOR SELECT TO authenticated
  USING (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));

-- entitlements_admin_full_access: Admins have full access
CREATE POLICY "entitlements_admin_full_access" ON feature_flags.entitlements
  FOR ALL TO authenticated
  USING (auth.jwt()->>'role' = 'admin');
```

### ENTITLEMENTS_OVERRIDES Policies

```sql
-- entitlements_overrides_user_read_own: Users can read their own overrides
CREATE POLICY "entitlements_overrides_user_read_own" ON feature_flags.entitlements_overrides
  FOR SELECT TO authenticated
  USING (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));

-- entitlements_overrides_admin_write: Admins can manage overrides
CREATE POLICY "entitlements_overrides_admin_write" ON feature_flags.entitlements_overrides
  FOR INSERT, UPDATE, DELETE TO authenticated
  WITH CHECK (auth.jwt()->>'role' = 'admin');
```

### FEATURE_FLAG_OVERRIDES Policies

```sql
-- feature_flag_overrides_user_read_own: Users can read their own overrides
CREATE POLICY "feature_flag_overrides_user_read_own" ON feature_flags.feature_flag_overrides
  FOR SELECT TO authenticated
  USING (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));

-- feature_flag_overrides_admin_write: Admins can manage overrides
CREATE POLICY "feature_flag_overrides_admin_write" ON feature_flags.feature_flag_overrides
  FOR INSERT, UPDATE, DELETE TO authenticated
  WITH CHECK (auth.jwt()->>'role' = 'admin');
```

### FEATURE_FLAG_ROLLOUTS Policies

```sql
-- rollouts_authenticated_read: Authenticated users can read rollouts
CREATE POLICY "rollouts_authenticated_read" ON feature_flags.feature_flag_rollouts
  FOR SELECT TO authenticated
  USING (true);

-- rollouts_admin_write: Admins can manage rollouts
CREATE POLICY "rollouts_admin_write" ON feature_flags.feature_flag_rollouts
  FOR INSERT, UPDATE, DELETE TO authenticated
  WITH CHECK (auth.jwt()->>'role' = 'admin');
```

---

## AUDIT Schema Policies

### EVENTS Policies

```sql
-- audit_admin_select: Admins can read all audit records
CREATE POLICY "audit_admin_select" ON audit.events
  FOR SELECT TO authenticated
  USING (auth.jwt()->>'role' = 'admin');

-- audit_own_select: Users can read audit records they initiated
CREATE POLICY "audit_own_select" ON audit.events
  FOR SELECT TO authenticated
  USING (initiated_by = (SELECT id FROM public.users WHERE auth_id = auth.uid()));

-- No INSERT/UPDATE/DELETE policies
-- All writes happen through SECURITY DEFINER triggers only
-- API callers cannot directly modify audit records
```

---

## Critical Implementation Notes

⚠️ **Helper Functions Required:**

The policies above depend on these helper functions (defined in migration 001 & 002):
- `get_current_user_id()` — Returns `id` of current user (used in app code)
- `get_user_auth_id(user_id)` — Returns `auth_id` for given user ID
- `get_world_owner_auth_id(world_id)` — Returns `auth_id` of world owner

⚠️ **JWT Custom Claims:**

Admin policies check `auth.jwt()->>'role' = 'admin'`. Ensure:
1. Supabase project has custom claims configured
2. Admin users' JWT tokens include `"role": "admin"` in custom claims
3. This is set via Supabase Dashboard → Authentication → JWT

⚠️ **Service Role Bypass:**

- `service_role` token bypasses all RLS policies (used by Edge Functions)
- Protect `SUPABASE_SERVICE_ROLE_KEY` carefully
- Never expose in client code

⚠️ **Public vs. Authenticated:**

- `public` role: unauthenticated users (no auth token)
- `authenticated` role: logged-in users (valid JWT)
- Policies can differ between these roles

---

## Testing Checklist

- [ ] Admin users have `role = 'admin'` in JWT token
- [ ] Non-admin users can only read/write own data
- [ ] Unauthenticated users can only read public data (invite links, feature flags)
- [ ] World owners can modify their worlds and manage access
- [ ] World members can view/update shared worlds
- [ ] Entitlements are user-isolated (SELECT succeeds for own, fails for others)
- [ ] Audit.events can be read only by admins and users who initiated actions
- [ ] Bulk audit queries (admin dashboard) are fast (uses idx_audit_events_table_time)
- [ ] Feature flag overrides prevent duplicate entries per user+flag

---

## Common Query Patterns

**Check current user's entitlements (RLS enforced):**
```sql
SELECT * FROM feature_flags.entitlements
WHERE user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid());
```

**Admin: View all entitlements for tracing:**
```sql
SELECT * FROM feature_flags.entitlements; -- Only works for admins
```

**Audit: Get recent changes to specific table:**
```sql
SELECT * FROM audit.events
WHERE table_schema = 'feature_flags' AND table_name = 'entitlements'
ORDER BY created_at DESC LIMIT 20;
```

---

_Last Updated: Feb 8, 2026 (Post-Migration 001-004)_
