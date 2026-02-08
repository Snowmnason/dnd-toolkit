# 🔒 Row Level Security (RLS) Policies — DnD Toolkit

This document defines all Row Level Security (RLS) policies for the D&D Toolkit database, organized by schema. Use these as the canonical reference when creating or debugging policies in Supabase/Postgres.

---

## Policy Summary by Schema

### PUBLIC Schema

| Table            | Policy Name                           | Command | Role(s)               | Purpose                                     |
| ---------------- | ------------------------------------- | ------- | --------------------- | ------------------------------------------- |
| **users**        | `users_select_own`                    | SELECT  | authenticated         | Users can read their own profile            |
| **users**        | `users_insert_own`                    | INSERT  | authenticated         | Users can create their own profile          |
| **users**        | `users_update_own`                    | UPDATE  | authenticated         | Users can update their own profile          |
| **users**        | `users_delete_own`                    | DELETE  | authenticated         | Users can delete their own profile          |
| **users**        | `users_admin_full_access`             | ALL     | authenticated (admin) | Admins have full access to all user records |
| **worlds**       | `worlds_owner_all`                    | ALL     | authenticated         | World owners have full access               |
| **worlds**       | `worlds_collaborator_select`          | SELECT  | authenticated         | Collaborators can view worlds they access   |
| **worlds**       | `worlds_collaborator_update`          | UPDATE  | authenticated         | Collaborators can update worlds             |
| **world_access** | `world_owner_any_ops_on_world_access` | ALL     | authenticated         | Owners manage access grants                 |
| **world_access** | `member_self_manage_access`           | ALL     | authenticated         | Members manage their own access             |
| **invite_links** | `invite_links_public_read`            | SELECT  | public                | Public can view active invite links         |
| **invite_links** | `invite_links_owner_select`           | SELECT  | authenticated         | Owners can view their invite links          |
| **invite_links** | `invite_links_insert_owner`           | INSERT  | authenticated         | Owners/DMs can create invite links          |

### FEATURE_FLAGS Schema

| Table                      | Policy Name                      | Command                | Role(s)               | Purpose                               |
| -------------------------- | -------------------------------- | ---------------------- | --------------------- | ------------------------------------- |
| **feature_flags**          | `feature_flags_public_read`      | SELECT                 | public, authenticated | Public can read feature flags         |
| **feature_flags**          | `feature_flags_admin_write`      | INSERT, UPDATE, DELETE | authenticated (admin) | Admins can manage flags               |
| **entitlements**           | `entitlements_user_read_own`     | SELECT                 | authenticated         | Users can read their own entitlements |
| **entitlements**           | `entitlements_admin_full_access` | ALL                    | authenticated (admin) | Admins have full access               |
| **feature_flag_overrides** | `overrides_user_read_own`        | SELECT                 | authenticated         | Users can read their own overrides    |
| **feature_flag_overrides** | `overrides_admin_write`          | INSERT, UPDATE, DELETE | authenticated (admin) | Admins can manage overrides           |
| **feature_flag_rollouts**  | `rollouts_authenticated_read`    | SELECT                 | authenticated         | Authenticated users can read rollouts |
| **feature_flag_rollouts**  | `rollouts_admin_write`           | INSERT, UPDATE, DELETE | authenticated (admin) | Admins can manage rollouts            |

---

## SQL Definitions (Canonical)

### Enable RLS on All Tables

**PUBLIC Schema:**

```sql
ALTER TABLE IF EXISTS public."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."worlds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."world_access" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."invite_links" ENABLE ROW LEVEL SECURITY;
```

**FEATURE_FLAGS Schema:**

```sql
ALTER TABLE IF EXISTS feature_flags."feature_flags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS feature_flags."entitlements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS feature_flags."feature_flag_overrides" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS feature_flags."feature_flag_rollouts" ENABLE ROW LEVEL SECURITY;
```

---

## PUBLIC Schema Policies

### USERS Policies

```sql
-- users_select_own: Users can read their own profile
CREATE POLICY "users_select_own" ON public."users"
  FOR SELECT TO authenticated
  USING (((SELECT auth.uid() AS uid) = auth_id));

-- users_insert_own: Users can create their own profile
CREATE POLICY "users_insert_own" ON public."users"
  FOR INSERT TO authenticated
  WITH CHECK (((SELECT auth.uid() AS uid) = auth_id));

-- users_update_own: Users can update their own profile
CREATE POLICY "users_update_own" ON public."users"
  FOR UPDATE TO authenticated
  USING (((SELECT auth.uid() AS uid) = auth_id))
  WITH CHECK (((SELECT auth.uid() AS uid) = auth_id));

-- users_delete_own: Users can delete their own profile
CREATE POLICY "users_delete_own" ON public."users"
  FOR DELETE TO authenticated
  USING (((SELECT auth.uid() AS uid) = auth_id));

-- users_admin_full_access: Admins have full access
CREATE POLICY "users_admin_full_access" ON public."users"
  FOR ALL TO authenticated
  USING (((auth.jwt() ->> 'role'::text) = 'admin'::text));
```

### WORLDS Policies

```sql
-- worlds_owner_all: Owners have full access to their worlds
CREATE POLICY "worlds_owner_all" ON public."worlds"
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public."users" u
    WHERE (u.id = worlds.owner_id) AND (u.auth_id = auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public."users" u
    WHERE (u.id = worlds.owner_id) AND (u.auth_id = auth.uid())
  ));

-- worlds_collaborator_select: Collaborators can view worlds they have access to
CREATE POLICY "worlds_collaborator_select" ON public."worlds"
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public."world_access" wa
    JOIN public."users" u ON (u.id = wa.user_id)
    WHERE (wa.world_id = worlds.world_id) AND (u.auth_id = auth.uid())
  ));

-- worlds_collaborator_update: Collaborators can update worlds
CREATE POLICY "worlds_collaborator_update" ON public."worlds"
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public."world_access" wa
    JOIN public."users" u ON (u.id = wa.user_id)
    WHERE (wa.world_id = worlds.world_id) AND (u.auth_id = auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public."world_access" wa
    JOIN public."users" u ON (u.id = wa.user_id)
    WHERE (wa.world_id = worlds.world_id) AND (u.auth_id = auth.uid())
  ));
```

### WORLD_ACCESS Policies

```sql
-- world_owner_any_ops_on_world_access: Owners manage all access grants
CREATE POLICY "world_owner_any_ops_on_world_access" ON public."world_access"
  FOR ALL TO authenticated
  USING ((get_world_owner_auth_id(world_id) = (SELECT auth.uid() AS uid)))
  WITH CHECK ((get_world_owner_auth_id(world_id) = (SELECT auth.uid() AS uid)));

-- member_self_manage_access: Members manage their own access records
CREATE POLICY "member_self_manage_access" ON public."member"
  FOR ALL TO authenticated
  USING ((get_user_auth_id(user_id) = (SELECT auth.uid() AS uid)))
  WITH CHECK ((get_user_auth_id(user_id) = (SELECT auth.uid() AS uid)));
```

### INVITE_LINKS Policies

```sql
-- invite_links_public_read: Public can view active invite links
CREATE POLICY "invite_links_public_read" ON public."invite_links"
  FOR SELECT TO public
  USING (true);

-- invite_links_owner_select: Owners can view their invite links
CREATE POLICY "invite_links_owner_select" ON public."invite_links"
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public."worlds" w
    JOIN public."users" u ON (u.id = w.owner_id)
    WHERE (w.world_id = invite_links.world_id) AND (u.auth_id = (SELECT auth.uid() AS uid))
  ));

-- invite_links_insert_owner: Owners/DMs can create invite links
CREATE POLICY "invite_links_insert_owner" ON public."invite_links"
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      (created_by IS NOT NULL) AND
      (created_by = (SELECT u.id FROM public."users" u WHERE (u.auth_id = (SELECT auth.uid() AS uid)) LIMIT 1))
    ) OR (EXISTS (
      SELECT 1 FROM public."worlds" w
      JOIN public."users" owner ON (owner.id = w.owner_id)
      WHERE (w.world_id = invite_links.world_id) AND (owner.auth_id = (SELECT auth.uid() AS uid))
    )) OR (EXISTS (
      SELECT 1 FROM public."world_access" wa
      JOIN public."users" u ON (u.id = wa.user_id)
      WHERE (wa.world_id = invite_links.world_id) AND (u.auth_id = (SELECT auth.uid() AS uid)) AND (wa.user_role = 'dm'::text)
    ))
  );
```

---

## FEATURE_FLAGS Schema Policies

### FEATURE_FLAGS.FEATURE_FLAGS Policies

```sql
-- feature_flags_public_read: Public can read feature flags
CREATE POLICY "feature_flags_public_read" ON feature_flags."feature_flags"
  FOR SELECT TO public
  USING (true);

-- feature_flags_admin_write: Admins can manage feature flags
CREATE POLICY "feature_flags_admin_write" ON feature_flags."feature_flags"
  FOR INSERT, UPDATE, DELETE TO authenticated
  WITH CHECK (((auth.jwt() ->> 'role'::text) = 'admin'::text));
```

### FEATURE_FLAGS.ENTITLEMENTS Policies

```sql
-- entitlements_user_read_own: Users can read their own entitlements
CREATE POLICY "entitlements_user_read_own" ON feature_flags."entitlements"
  FOR SELECT TO authenticated
  USING ((user_id = (SELECT id FROM public."users" u WHERE (u.auth_id = auth.uid()))));

-- entitlements_admin_full_access: Admins have full access
CREATE POLICY "entitlements_admin_full_access" ON feature_flags."entitlements"
  FOR ALL TO authenticated
  USING (((auth.jwt() ->> 'role'::text) = 'admin'::text));
```

### FEATURE_FLAGS.FEATURE_FLAG_OVERRIDES Policies

```sql
-- overrides_user_read_own: Users can read their own overrides
CREATE POLICY "overrides_user_read_own" ON feature_flags."feature_flag_overrides"
  FOR SELECT TO authenticated
  USING ((user_id = (SELECT id FROM public."users" u WHERE (u.auth_id = auth.uid()))));

-- overrides_admin_write: Admins can manage overrides
CREATE POLICY "overrides_admin_write" ON feature_flags."feature_flag_overrides"
  FOR INSERT, UPDATE, DELETE TO authenticated
  WITH CHECK (((auth.jwt() ->> 'role'::text) = 'admin'::text));
```

### FEATURE_FLAGS.FEATURE_FLAG_ROLLOUTS Policies

```sql
-- rollouts_authenticated_read: Authenticated users can read rollouts
CREATE POLICY "rollouts_authenticated_read" ON feature_flags."feature_flag_rollouts"
  FOR SELECT TO authenticated
  USING (true);

-- rollouts_admin_write: Admins can manage rollouts (Edge Functions use service_role)
CREATE POLICY "rollouts_admin_write" ON feature_flags."feature_flag_rollouts"
  FOR INSERT, UPDATE, DELETE TO authenticated
  WITH CHECK (((auth.jwt() ->> 'role'::text) = 'admin'::text));
```

---

## Critical Notes

⚠️ **Helper Functions Required:**

- `get_world_owner_auth_id(world_id)` — Must return the `auth_id` of the world's owner
- `get_user_auth_id(user_id)` — Must return the `auth_id` for a given user ID

⚠️ **JWT Claims:**

- `auth.jwt()->>'role'` must be set to `'admin'` for admin users
- Verify this is configured in your Supabase custom claims or auth rules

⚠️ **Service Role:**

- The `service_role` token is used by Edge Functions for internal operations
- Protect this carefully — it bypasses all RLS policies

---

## Testing Checklist

- [ ] Admin users have `role = 'admin'` in their JWT token
- [ ] `get_world_owner_auth_id()` and `get_user_auth_id()` functions exist and return correct values
- [ ] Test queries as `public` (anon), `authenticated` (logged-in), and `service_role`
- [ ] Test as owner, collaborator, and non-member to verify access boundaries
- [ ] Monitor query performance on policies with JOINs (worlds, world_access)

---

_Last Updated: Feb 7, 2026_
