-- ============================================================
-- 002: WORLDS SCHEMA
-- Tables: worlds, world_access
-- Also: helper functions, invite_links FK + policies, triggers
-- ============================================================
-- EXECUTION ORDER: Run AFTER 001_public_schema.sql
-- PREREQUISITES: public.users table must exist
-- AFTER THIS: Run 003_feature_flags_schema.sql
-- ============================================================
-- IMPORTANT: After running this file, add 'worlds' to:
--   Supabase Dashboard → Settings → API → Exposed Schemas
-- ============================================================

BEGIN;

-- ========================
-- SCHEMA
-- ========================

CREATE SCHEMA IF NOT EXISTS worlds;

GRANT USAGE ON SCHEMA worlds TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA worlds TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA worlds TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA worlds TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA worlds
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA worlds
  GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA worlds
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- ========================
-- ENUMS
-- ========================

-- World access roles with strict hierarchy and permissions.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'world_access_role'
      AND n.nspname = 'worlds'
  ) THEN
    CREATE TYPE worlds.world_access_role AS ENUM (
      'dm',         -- Owner: full authority, can delete/modify worlds, see everything
      'gm',         -- Co-owner: same dm visibility, cannot delete worlds, can see full player data (future boolean)
      'player',     -- Limited visibility, can edit own character data, cannot see dm-only content
      'spectator',  -- Read-only with dm view (for sharing modules/campaigns to other dms)
      'observer'    -- Read-only with player view (for sharing character stuff without dm content)
    );
  END IF;
END$$;

-- ========================
-- TABLES
-- ========================

-- WORLDS: Represents a D&D campaign world.
-- Each world has exactly one owner (the creating DM).
-- Additional members are managed via worlds.world_access.
CREATE TABLE worlds.worlds (
  world_id      uuid        NOT NULL DEFAULT gen_random_uuid(),
  owner_id      uuid        NOT NULL,
  name          text        NOT NULL DEFAULT 'World',
  description   text        NULL     DEFAULT '',
  system        text        NULL     DEFAULT 'D&D 5e',
  is_dm         boolean     NOT NULL DEFAULT true,       -- Future multi-DM support
  map_image_url text        NULL,
  settings      jsonb       NOT NULL DEFAULT '{}',       -- Extensible: homebrew rules, preferences
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz NULL,                        -- Soft delete

  CONSTRAINT worlds_pkey PRIMARY KEY (world_id),
  CONSTRAINT worlds_owner_id_fkey FOREIGN KEY (owner_id)
    REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT ck_world_name_not_empty CHECK (length(trim(name)) > 0)
);

-- Ensure owner_id FK exists and is idempotent for re-runs of this migration.
-- Use DROP CONSTRAINT IF EXISTS then ADD to guarantee presence without error.
ALTER TABLE worlds.worlds
  DROP CONSTRAINT IF EXISTS worlds_owner_id_fkey;

ALTER TABLE worlds.worlds
  ADD CONSTRAINT worlds_owner_id_fkey FOREIGN KEY (owner_id)
    REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- WORLD_ACCESS: RBAC join table granting users access to worlds with roles.
-- One row per (world, user) pair. Owner also gets a row with role 'dm'.
CREATE TABLE worlds.world_access (
  id          uuid                  NOT NULL DEFAULT gen_random_uuid(),
  world_id    uuid                  NOT NULL,
  user_id     uuid                  NOT NULL,
  user_role   worlds.world_access_role NOT NULL DEFAULT 'player',
  permissions jsonb                 NULL,                        -- Future: per-user capability overrides
  created_at  timestamptz           NOT NULL DEFAULT now(),
  updated_at  timestamptz           NOT NULL DEFAULT now(),

  CONSTRAINT world_access_pkey PRIMARY KEY (id),
  CONSTRAINT world_access_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT world_access_world_id_fkey FOREIGN KEY (world_id)
    REFERENCES worlds.worlds(world_id) ON DELETE CASCADE
);

-- Unique constraint: one membership per user per world (also acts as fast lookup index)
CREATE UNIQUE INDEX idx_world_access_world_user
  ON worlds.world_access USING btree (world_id, user_id);

-- ========================
-- INVITE_LINKS: World-scoped invite tokens
-- ========================

-- Invite links live in `worlds` schema (keeps world-scoped data co-located).
-- RLS is designed to avoid recursion: invite_links policies may reference worlds.worlds,
-- but worlds/world_access policies do not reference invite_links.

CREATE TABLE worlds.invite_links (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  world_id    uuid        NOT NULL,
  created_by  uuid        NULL,
  token       uuid        NOT NULL DEFAULT gen_random_uuid(),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT invite_links_pkey PRIMARY KEY (id),
  CONSTRAINT invite_links_token_key UNIQUE (token),
  CONSTRAINT invite_links_world_id_fkey FOREIGN KEY (world_id)
    REFERENCES worlds.worlds(world_id) ON DELETE CASCADE,
  CONSTRAINT invite_links_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_invite_links_expires_at ON worlds.invite_links USING btree (expires_at);
CREATE INDEX idx_invite_links_world_id ON worlds.invite_links USING btree (world_id);
CREATE INDEX idx_invite_links_created_by ON worlds.invite_links USING btree (created_by);

-- RPC: Resolve an invite token to a world (for anon "join by invite" flows).
-- This avoids exposing a public SELECT policy that would allow listing all active invite tokens.
CREATE OR REPLACE FUNCTION worlds.resolve_invite_token(p_token uuid)
RETURNS TABLE (world_id uuid, expires_at timestamptz)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = worlds, public
AS $$
  SELECT il.world_id, il.expires_at
  FROM worlds.invite_links il
  JOIN worlds.worlds w ON w.world_id = il.world_id
  WHERE il.token = p_token
    AND il.expires_at > now()
    AND w.deleted_at IS NULL
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION worlds.resolve_invite_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION worlds.resolve_invite_token(uuid) TO anon, authenticated, service_role;

-- RPC: Create an invite link (authenticated only).
-- Avoids needing any table-level INSERT policy on worlds.invite_links.
CREATE OR REPLACE FUNCTION worlds.create_invite_link(
  p_world_id uuid,
  p_hours_valid integer DEFAULT 24
)
RETURNS TABLE (token uuid, expires_at timestamptz, created_at timestamptz)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = worlds, public
AS $$
DECLARE
  v_user_id uuid := public.get_current_user_id();
  v_expires_at timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_hours_valid IS NULL OR p_hours_valid < 1 OR p_hours_valid > 168 THEN
    RAISE EXCEPTION 'Invalid hours_valid (1-168)';
  END IF;

  -- Only the world owner (or admin) can create invites.
  IF NOT (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM worlds.worlds w
      WHERE w.world_id = p_world_id
        AND w.owner_id = v_user_id
        AND w.deleted_at IS NULL
    )
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  v_expires_at := now() + make_interval(hours => p_hours_valid);

  RETURN QUERY
  INSERT INTO worlds.invite_links (world_id, created_by, expires_at)
  VALUES (p_world_id, v_user_id, v_expires_at)
  RETURNING invite_links.token, invite_links.expires_at, invite_links.created_at;
END;
$$;

REVOKE ALL ON FUNCTION worlds.create_invite_link(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION worlds.create_invite_link(uuid, integer) TO authenticated, service_role;

-- RPC: Delete an invite link by token (authenticated only).
-- Matches the intent of the old delete policy (world owner or admin).
CREATE OR REPLACE FUNCTION worlds.delete_invite_link(p_token uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = worlds, public
AS $$
DECLARE
  v_user_id uuid := public.get_current_user_id();
  v_world_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT il.world_id INTO v_world_id
  FROM worlds.invite_links il
  WHERE il.token = p_token
  LIMIT 1;

  IF v_world_id IS NULL THEN
    -- Intentionally no-op: do not leak token existence
    RETURN;
  END IF;

  IF NOT (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM worlds.worlds w
      WHERE w.world_id = v_world_id
        AND w.owner_id = v_user_id
        AND w.deleted_at IS NULL
    )
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  DELETE FROM worlds.invite_links
  WHERE token = p_token;
END;
$$;

REVOKE ALL ON FUNCTION worlds.delete_invite_link(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION worlds.delete_invite_link(uuid) TO authenticated, service_role;

-- ========================
-- HELPER FUNCTIONS
-- ========================

-- Get the auth_id of a world's owner.
-- Used in RLS policies for world_access management.
CREATE OR REPLACE FUNCTION worlds.get_world_owner_auth_id(p_world_id uuid)
RETURNS uuid
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = worlds, public
AS $$
  SELECT u.auth_id
  FROM worlds.worlds w
  JOIN public.users u ON u.id = w.owner_id
  WHERE w.world_id = p_world_id
  LIMIT 1;
$$;

-- Check if a user owns a specific world.
CREATE OR REPLACE FUNCTION worlds.user_owns_world(p_user_id uuid, p_world_id uuid)
RETURNS boolean
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = worlds, public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM worlds.worlds
    WHERE world_id = p_world_id
      AND owner_id = p_user_id
      AND deleted_at IS NULL
  );
$$;

-- Check if a user has any access to a world (owner OR member).
-- Both checks verify the world is not soft-deleted.
CREATE OR REPLACE FUNCTION worlds.user_has_access(p_user_id uuid, p_world_id uuid)
RETURNS boolean
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = worlds, public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM worlds.worlds
    WHERE world_id = p_world_id AND owner_id = p_user_id AND deleted_at IS NULL
  )
  OR EXISTS(
    SELECT 1 FROM worlds.world_access wa
    JOIN worlds.worlds w ON w.world_id = wa.world_id
    WHERE wa.world_id = p_world_id AND wa.user_id = p_user_id AND w.deleted_at IS NULL
  );
$$;

-- Change a user's role in a world (with validation and permission checks).
-- Only world owner or GMs can change roles. Cannot demote self or promote above own role.
-- Raises exception on permission denial, invalid role, or invalid state.
CREATE OR REPLACE FUNCTION worlds.change_user_role(
  p_world_id uuid,
  p_target_user_id uuid,
  p_new_role worlds.world_access_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = worlds, public
AS $$
DECLARE
  v_caller_id uuid := public.get_current_user_id();
  v_caller_role worlds.world_access_role;
  v_target_role worlds.world_access_role;
BEGIN
  -- Fetch caller's current role
  SELECT user_role INTO v_caller_role
  FROM worlds.world_access
  WHERE world_id = p_world_id AND user_id = v_caller_id
  LIMIT 1;

  -- Caller must be owner or GM (DM-level permissions)
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('dm', 'gm') THEN
    RAISE EXCEPTION 'Permission denied: only owners and GMs can change user roles';
  END IF;

  -- Cannot change roles for non-existent memberships
  SELECT user_role INTO v_target_role
  FROM worlds.world_access
  WHERE world_id = p_world_id AND user_id = p_target_user_id
  LIMIT 1;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Target user is not a member of this world';
  END IF;

  -- Cannot demote self
  IF p_target_user_id = v_caller_id THEN
    RAISE EXCEPTION 'Cannot change your own role';
  END IF;

  -- Non-owner GMs cannot promote others above GM or change other GMs
  IF v_caller_role = 'gm' AND (p_new_role IN ('dm', 'gm') OR v_target_role = 'gm') THEN
    RAISE EXCEPTION 'GMs can only change player/spectator/observer roles';
  END IF;

  -- Perform role change
  UPDATE worlds.world_access
  SET user_role = p_new_role
  WHERE world_id = p_world_id AND user_id = p_target_user_id;

END;
$$;

REVOKE ALL ON FUNCTION worlds.change_user_role(uuid, uuid, worlds.world_access_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION worlds.change_user_role(uuid, uuid, worlds.world_access_role) TO authenticated, service_role;

-- Join a world using an invite token.
-- Authenticated only; membership is always for the current user.
CREATE OR REPLACE FUNCTION worlds.join_world_with_invite(
  p_world_id uuid,
  p_token uuid,
  p_user_role worlds.world_access_role DEFAULT 'player'
)
RETURNS TABLE (
  id uuid,
  world_id uuid,
  user_id uuid,
  user_role worlds.world_access_role,
  permissions jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = worlds, public
AS $$
DECLARE
  v_user_id uuid := public.get_current_user_id();
  v_world_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Join-by-invite is intentionally restricted to non-privileged roles.
  IF p_user_role NOT IN ('player', 'spectator', 'observer') THEN
    RAISE EXCEPTION 'Invalid role for invite join';
  END IF;

  SELECT il.world_id INTO v_world_id
  FROM worlds.invite_links il
  JOIN worlds.worlds w ON w.world_id = il.world_id
  WHERE il.token = p_token
    AND il.world_id = p_world_id
    AND il.expires_at > now()
    AND w.deleted_at IS NULL
  LIMIT 1;

  IF v_world_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invite token';
  END IF;

  RETURN QUERY
  INSERT INTO worlds.world_access (world_id, user_id, user_role)
  VALUES (v_world_id, v_user_id, p_user_role)
  RETURNING world_access.id,
            world_access.world_id,
            world_access.user_id,
            world_access.user_role,
            world_access.permissions,
            world_access.created_at;
END;
$$;

REVOKE ALL ON FUNCTION worlds.join_world_with_invite(uuid, uuid, worlds.world_access_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION worlds.join_world_with_invite(uuid, uuid, worlds.world_access_role) TO authenticated, service_role;

-- Leave a world (removes the current user's membership).
CREATE OR REPLACE FUNCTION worlds.leave_world(p_world_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = worlds, public
AS $$
DECLARE
  v_user_id uuid := public.get_current_user_id();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Owners cannot leave their own worlds (they must delete or transfer ownership).
  IF EXISTS (
    SELECT 1
    FROM worlds.worlds w
    WHERE w.world_id = p_world_id
      AND w.owner_id = v_user_id
      AND w.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Owner cannot leave their own world';
  END IF;

  DELETE FROM worlds.world_access wa
  WHERE wa.world_id = p_world_id
    AND wa.user_id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION worlds.leave_world(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION worlds.leave_world(uuid) TO authenticated, service_role;

-- ========================
-- INDEXES
-- ========================

-- Fast lookup: all worlds owned by a user
CREATE INDEX idx_worlds_owner_id
  ON worlds.worlds USING btree (owner_id);

-- Sort worlds by creation date (newest first)
CREATE INDEX idx_worlds_created_at
  ON worlds.worlds USING btree (created_at DESC);

-- Fast lookup: all worlds a user belongs to
CREATE INDEX idx_world_access_user_id
  ON worlds.world_access USING btree (user_id);

-- Fast lookup: all members in a world
CREATE INDEX idx_world_access_world_id
  ON worlds.world_access USING btree (world_id);

-- Optimizes "recent worlds for user" queries (sorted newest-first)
CREATE INDEX idx_world_access_user_created
  ON worlds.world_access USING btree (user_id, created_at DESC);

-- Partial indexes: optimize queries filtering by soft-delete status
-- Speeds up "list active worlds" and "list active memberships" queries
CREATE INDEX idx_worlds_not_deleted
  ON worlds.worlds (created_at DESC) WHERE deleted_at IS NULL;

-- ========================
-- TRIGGERS
-- ========================

-- Auto-update updated_at on worlds
CREATE TRIGGER trg_worlds_updated_at
  BEFORE UPDATE ON worlds.worlds
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- Auto-update updated_at on world_access
CREATE TRIGGER trg_world_access_updated_at
  BEFORE UPDATE ON worlds.world_access
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- Prevent changing owner_id via UPDATE.
-- Ownership transfer should be done via a dedicated function (future).
CREATE OR REPLACE FUNCTION worlds.prevent_owner_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
    RAISE EXCEPTION 'Cannot change world owner via UPDATE. Use ownership transfer function.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_owner_change
  BEFORE UPDATE ON worlds.worlds
  FOR EACH ROW EXECUTE FUNCTION worlds.prevent_owner_change();

-- Auto-create owner membership in world_access when world is created.
-- Ensures owner always has a row in world_access with role 'dm'.
CREATE OR REPLACE FUNCTION worlds.create_owner_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = worlds, public
AS $$
BEGIN
  INSERT INTO worlds.world_access (world_id, user_id, user_role)
  VALUES (NEW.world_id, NEW.owner_id, 'dm'::worlds.world_access_role)
  ON CONFLICT (world_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_owner_access
  AFTER INSERT ON worlds.worlds
  FOR EACH ROW EXECUTE FUNCTION worlds.create_owner_access();

-- ========================
-- ROW LEVEL SECURITY
-- ========================

ALTER TABLE worlds.worlds ENABLE ROW LEVEL SECURITY;
ALTER TABLE worlds.world_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE worlds.invite_links ENABLE ROW LEVEL SECURITY;
-- Simplified RLS policies to avoid recursion between `worlds` and `world_access`.
-- Pattern: `worlds` may consult `world_access` for membership checks, but
-- `world_access` policies must not consult `worlds` (avoids circular RLS evaluation).

-- Members (and owners) can view the roster of worlds they have access to.
-- Uses a SECURITY DEFINER helper to avoid recursion in world_access policies.
-- NOTE: Previous 'allow_self' policy removed — it was a redundant subset of this policy.
DROP POLICY IF EXISTS allow_self ON worlds.world_access;
DROP POLICY IF EXISTS world_access_roster_select ON worlds.world_access;
CREATE POLICY world_access_roster_select ON worlds.world_access
  FOR SELECT
  TO authenticated
  USING (worlds.user_has_access(public.get_current_user_id(), world_id));

-- NOTE: INSERT policy removed - use server-side functions to manage world_access
-- Client INSERT/UPDATE/DELETE are blocked by RLS logic, not explicit policies

DROP POLICY IF EXISTS deny_updates ON worlds.world_access;
CREATE POLICY deny_updates ON worlds.world_access
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS deny_deletes ON worlds.world_access;
CREATE POLICY deny_deletes ON worlds.world_access
  FOR DELETE
  TO authenticated
  USING (false);

-- `worlds`: allow owner OR member to SELECT (membership checked via world_access)
DROP POLICY IF EXISTS select_if_owner_or_member ON worlds.worlds;
CREATE POLICY select_if_owner_or_member ON worlds.worlds
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      owner_id = public.get_current_user_id()
      OR EXISTS (
        SELECT 1 FROM worlds.world_access wa
        WHERE wa.world_id = worlds.worlds.world_id
          AND wa.user_id = public.get_current_user_id()
      )
    )
  );

-- Owner-only semantics for writes to worlds (keeps existing behavior simplified)
DROP POLICY IF EXISTS worlds_owner_write ON worlds.worlds;
CREATE POLICY worlds_owner_write ON worlds.worlds
  FOR ALL
  USING (owner_id = public.get_current_user_id())
  WITH CHECK (owner_id = public.get_current_user_id());

-- ---- INVITE_LINKS POLICIES (deferred from 001) ----

-- Public/anon access is provided via worlds.resolve_invite_token(uuid) RPC.
-- (No table-level public SELECT policy on invite_links.)
DROP POLICY IF EXISTS invite_links_public_read ON worlds.invite_links;

-- World owners can view ALL their invite links (including expired, for management)
DROP POLICY IF EXISTS invite_links_owner_select ON worlds.invite_links;
CREATE POLICY invite_links_owner_select ON worlds.invite_links
  FOR SELECT TO authenticated
  USING (
    created_by = public.get_current_user_id()
    OR EXISTS (
      SELECT 1 FROM worlds.worlds w
      WHERE w.world_id = invite_links.world_id
        AND w.owner_id = public.get_current_user_id()
    )
  );

-- NOTE: INSERT policy removed - use server-side functions for invite link creation
-- RLS prevents unauthorized access via SELECT policies on world membership

-- Owners can delete invite links for their worlds
DROP POLICY IF EXISTS invite_links_delete_owner ON worlds.invite_links;
CREATE POLICY invite_links_delete_owner ON worlds.invite_links
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM worlds.worlds w
      WHERE w.world_id = invite_links.world_id
        AND w.owner_id = public.get_current_user_id()
    )
  );

-- Admins can manage all invite links
DROP POLICY IF EXISTS invite_links_admin_all ON worlds.invite_links;
CREATE POLICY invite_links_admin_all ON worlds.invite_links
  FOR ALL TO authenticated
  USING (public.is_admin());

-- ========================
-- COMMENTS (Documentation)
-- ========================

COMMENT ON TABLE worlds.worlds IS
  'D&D campaign worlds. Each world has exactly one owner (the DM). Soft-deleted via deleted_at.';

COMMENT ON COLUMN worlds.worlds.owner_id IS
  'User ID of the world owner (DM). Cannot be changed after creation.';

COMMENT ON COLUMN worlds.worlds.deleted_at IS
  'Soft-delete timestamp. NULL = active. Used in RLS policies to filter out deleted worlds.';

COMMENT ON TABLE worlds.world_access IS
  'RBAC join: users to worlds with roles (dm, gm, player, spectator, observer). One row per (world, user) pair.';

COMMENT ON COLUMN worlds.world_access.user_role IS
  'Role enum (worlds.world_access_role): dm=owner/full authority, gm=co-owner/see all, player=limited, spectator=read-only dm view, observer=read-only player view.';

COMMENT ON FUNCTION worlds.user_has_access(uuid, uuid) IS
  'Returns TRUE if user_id is owner of world OR has a world_access row (member). Both checks verify world not soft-deleted.';

COMMENT ON FUNCTION worlds.create_owner_access() IS
  'Trigger: auto-inserts owner into world_access with role=dm after world creation. Ensures owner membership row always exists.';

COMMENT ON FUNCTION worlds.change_user_role(uuid, uuid, worlds.world_access_role) IS
  'Change a users role in a world (owner/gm only). Validates permissions, prevents self-demotion, prevents promotion above caller rank. Changes are captured by audit triggers.';

COMMIT;
