# 🔒 Row Level Security (RLS) Policies — DnD Toolkit

This document defines all Row Level Security (RLS) policies for the D&D Toolkit database. Use these as the canonical reference when creating or debugging policies in Supabase/Postgres.

---

## Policy Summary by Table

| Table                      | Policy Name                             | Command | Role(s)               | Purpose                                                  |
| -------------------------- | --------------------------------------- | ------- | --------------------- | -------------------------------------------------------- |
| **users**                  | `users_select_own`                      | SELECT  | authenticated         | Users can read their own profile                         |
| **users**                  | `users_insert_own`                      | INSERT  | authenticated         | Users can create their own profile                       |
| **users**                  | `users_update_own`                      | UPDATE  | authenticated         | Users can update their own profile                       |
| **users**                  | `users_delete_own`                      | DELETE  | authenticated         | Users can delete their own profile                       |
| **users**                  | `users_admin_full_access`               | ALL     | authenticated (admin) | Admins have full access to all user records              |
| **worlds**                 | `worlds_owner_all`                      | ALL     | authenticated         | World owners have full access to their worlds            |
| **worlds**                 | `worlds_collaborator_select`            | SELECT  | authenticated         | Collaborators can view worlds they have access to        |
| **worlds**                 | `worlds_collaborator_update`            | UPDATE  | authenticated         | Collaborators can update worlds (without changing owner) |
| **world_access**           | `world_owner_any_ops_on_world_access`   | ALL     | authenticated         | World owners manage all access grants for their worlds   |
| **world_access**           | `member_self_manage_access`             | ALL     | authenticated         | Members can manage their own access records              |
| **invite_links**           | `invite_links_public_read`              | SELECT  | public                | Public can view any active invite links                  |
| **invite_links**           | `invite_links_owner_select`             | SELECT  | authenticated         | World owners can view their own invite links             |
| **invite_links**           | `invite_links_insert_owner`             | INSERT  | authenticated         | World owners/DMs can create invite links                 |
| **feature_flag**           | `feature_flag_select_authenticated`     | SELECT  | public                | Feature flags publicly readable (for client checks)      |
| **feature_flag_overrides** | `feature_flag_overrides`                | SELECT  | public                | Overrides publicly readable                              |
| **entitlements**           | `entitlements_select_authenticated`     | SELECT  | authenticated         | Users can read their own entitlements                    |
| **rollouts**               | `Authenticated users can read rollouts` | SELECT  | authenticated         | Users can read rollout configurations                    |
| **rollouts**               | `Service role can manage rollouts`      | ALL     | service_role          | Service role (Edge Functions) can manage rollouts        |
| **member**                 | `member_self_manage_access`             | ALL     | authenticated         | Members can manage their own access records              |

---

## SQL Definitions (Canonical)

### Enable RLS on All Tables

```sql
ALTER TABLE IF EXISTS public."entitlements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."worlds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."world_access" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."feature_flag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."invite_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."rollouts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."member" ENABLE ROW LEVEL SECURITY;
```

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

### FEATURE_FLAG Policies

```sql
-- feature_flag_select_authenticated: Public can read feature flags
CREATE POLICY "feature_flag_select_authenticated" ON public."feature_flag"
  FOR SELECT TO public
  USING (true);
```

### FEATURE_FLAG_OVERRIDES Policies

```sql
-- feature_flag_overrides: Public can read overrides
CREATE POLICY "feature_flag_overrides" ON public."feature_flag_overrides"
  FOR SELECT TO public
  USING (true);
```

### ENTITLEMENTS Policies

```sql
-- entitlements_select_authenticated: Users can read authentic entitlements
CREATE POLICY "entitlements_select_authenticated" ON public."entitlements"
  FOR SELECT TO authenticated
  USING (true);
```

### ROLLOUTS Policies

```sql
-- Authenticated users can read rollouts
CREATE POLICY "Authenticated users can read rollouts" ON public."rollouts"
  FOR SELECT TO authenticated
  USING (true);

-- Service role can manage rollouts (Edge Functions)
CREATE POLICY "Service role can manage rollouts" ON public."rollouts"
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
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
