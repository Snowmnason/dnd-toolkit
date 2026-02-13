-- ============================================================
-- 003: FEATURE_FLAGS SCHEMA
-- Tables: feature_flags, entitlements, feature_flag_overrides,
--         feature_flag_rollouts
-- ============================================================
-- EXECUTION ORDER: Run AFTER 002_worlds_schema.sql
-- PREREQUISITES: public.users table must exist
-- AFTER THIS: Run 004_audit_schema.sql
-- ============================================================

-- IMPORTANT: After running this file, add 'feature_flags' to:
--   Supabase Dashboard → Settings → API → Exposed Schemas
-- ============================================================

-- This migration creates objects in the `feature_flags` schema.
-- Expose `feature_flags` (not `public`) in Supabase Dashboard → API → Exposed Schemas.

BEGIN;

-- ========================
-- SCHEMA
-- ========================

CREATE SCHEMA IF NOT EXISTS feature_flags;

GRANT USAGE ON SCHEMA feature_flags TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA feature_flags TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA feature_flags TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA feature_flags TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA feature_flags
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA feature_flags
  GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA feature_flags
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- ========================
-- TABLES
-- ========================

-- FEATURE_FLAGS: Master list of all feature flags.
-- One row per flag. Controls runtime behavior across all users
-- unless overridden by entitlements, overrides, or rollouts.
--
-- Resolution order (highest priority first):
--   1. feature_flag_overrides (explicit admin action)
--   2. entitlements (user-granted capabilities)
--   3. feature_flag_rollouts (percentage-based A/B)
--   4. feature_flags.enabled (global default)
CREATE TABLE feature_flags.feature_flags (
  flag_name   text        NOT NULL,
  enabled     boolean     NOT NULL DEFAULT false,
  kind        text        NOT NULL,   -- 'boolean', 'string', 'percentage', 'entitlement'
  description text        NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT feature_flags_pkey PRIMARY KEY (flag_name)
);


-- ENTITLEMENTS: Grants explicit feature access to specific users.
-- Each entitlement is a capability unlock (premium, beta, admin feature, etc.).
-- Entitlements can be permanent (expires_at = NULL) or temporary.
CREATE TABLE feature_flags.entitlements (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id     uuid        NULL,       -- Nullable for future org-wide entitlements
  key         text        NOT NULL,   -- Entitlement identifier (e.g., 'premium_subscription')
  is_active   boolean     NOT NULL DEFAULT true,    -- Manual revoke + auto-marked when expired
  remind_user boolean     NOT NULL DEFAULT true,    -- Flag to remind user when expired (default: true = always remind)
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NULL,       -- NULL = permanent

  CONSTRAINT entitlements_pkey PRIMARY KEY (id),
  CONSTRAINT entitlements_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.users(id) ON DELETE CASCADE,
-- Prevent duplicate entitlements for same user + key
  CONSTRAINT entitlements_user_key_unique UNIQUE (user_id, key),
  -- Ensure org-wide entitlements are unique (one per key when user_id IS NULL)
  -- Partial unique index enforces this separately from user-specific entitlements
  CONSTRAINT ck_expires_after_created
    CHECK (expires_at IS NULL OR expires_at > created_at)
);

-- Org-wide entitlements: ensure uniqueness when user_id is NULL
CREATE UNIQUE INDEX one_org_entitlement_per_key
  ON feature_flags.entitlements (key)
  WHERE user_id IS NULL;

-- FEATURE_FLAG_OVERRIDES: Admin tool to override global feature flags per user.
-- Supports temporarily enabling/disabling features for testing, early access,
-- or bug mitigation.
CREATE TABLE feature_flags.feature_flag_overrides (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL,
  flag_name   text        NOT NULL,   -- The flag being overridden
  enabled     boolean     NOT NULL,   -- true = force ON, false = force OFF
  expires_at  timestamptz NULL,       -- NULL = permanent override
  reason      text        NULL,       -- Admin notes: why this override was applied
  created_by  uuid        NULL,       -- Which admin applied this
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  revoked     boolean     NOT NULL DEFAULT false,  -- Soft-revoke for audit trail

  CONSTRAINT overrides_pkey PRIMARY KEY (id),
  CONSTRAINT overrides_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT overrides_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT overrides_flag_name_fkey FOREIGN KEY (flag_name)
    REFERENCES feature_flags.feature_flags(flag_name) ON UPDATE CASCADE ON DELETE CASCADE
);

-- Unique: one override per user per flag
CREATE UNIQUE INDEX idx_overrides_user_flag
  ON feature_flags.feature_flag_overrides (user_id, flag_name);

-- ENTITLEMENTS_OVERRIDES: Admin tool to temporarily grant/revoke entitlements.
-- Allows admins to override entitlements without modifying the base entitlement rows.
-- When override expires or is revoked, the entitlement reverts to its original state.
CREATE TABLE feature_flags.entitlements_overrides (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL,
  entitlement_key text     NOT NULL,   -- The entitlement key being overridden
  is_active   boolean     NOT NULL,    -- true = force grant, false = force revoke
  expires_at  timestamptz NULL,        -- NULL = permanent override
  reason      text        NULL,        -- Admin notes: why this override was applied
  created_by  uuid        NULL,        -- Which admin applied this
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  revoked     boolean     NOT NULL DEFAULT false,  -- Soft-revoke for audit trail

  CONSTRAINT entitlements_overrides_pkey PRIMARY KEY (id),
  CONSTRAINT entitlements_overrides_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT entitlements_overrides_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.users(id) ON DELETE SET NULL,
  -- Unique: one override per user per entitlement key
  CONSTRAINT entitlements_overrides_user_key_unique UNIQUE (user_id, entitlement_key)
);

-- ========================
-- FEATURE_FLAG_ROLLOUTS
-- ========================
-- Users are bucketed by FNV-1a hash of (user_id + seed).
-- One rollout config per flag (UNIQUE on flag_name).
CREATE TABLE feature_flags.feature_flag_rollouts (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  flag_name   text        NOT NULL,
  percentage  smallint    NOT NULL,   -- 0-100
  seed        text        NULL,       -- Optional: re-seed to re-bucket users
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid        NULL,
  description text        NULL,
  is_active   boolean     NOT NULL DEFAULT true,

  CONSTRAINT rollouts_pkey PRIMARY KEY (id),
  CONSTRAINT rollouts_flag_name_key UNIQUE (flag_name),
  CONSTRAINT rollouts_flag_name_fkey FOREIGN KEY (flag_name)
    REFERENCES feature_flags.feature_flags(flag_name) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT rollouts_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT ck_percentage_valid CHECK (percentage >= 0 AND percentage <= 100)
);

-- ========================
-- INDEXES
-- ========================

-- feature_flags: Recently modified flags (admin dashboard sorting)
CREATE INDEX idx_feature_flags_updated_at
  ON feature_flags.feature_flags USING btree (updated_at DESC);

-- entitlements: Find all entitlements for a user
CREATE INDEX idx_entitlements_user_id
  ON feature_flags.entitlements USING btree (user_id);

-- entitlements: Find all users with a specific entitlement
CREATE INDEX idx_entitlements_key
  ON feature_flags.entitlements USING btree (key);

-- entitlements: Identify expired entitlements for cleanup
CREATE INDEX idx_entitlements_expires_at
  ON feature_flags.entitlements USING btree (expires_at);

-- overrides: Find all overrides for a user
CREATE INDEX idx_overrides_user_id
  ON feature_flags.feature_flag_overrides USING btree (user_id);

-- overrides: Expiration cleanup
CREATE INDEX idx_overrides_expires_at
  ON feature_flags.feature_flag_overrides USING btree (expires_at);

-- entitlements_overrides: Find all overrides for a user
CREATE INDEX idx_entitlements_overrides_user_id
  ON feature_flags.entitlements_overrides USING btree (user_id);

-- entitlements_overrides: Expiration cleanup
CREATE INDEX idx_entitlements_overrides_expires_at
  ON feature_flags.entitlements_overrides USING btree (expires_at);

-- entitlements_overrides: Lookup by entitlement key for bulk operations
CREATE INDEX idx_entitlements_overrides_key
  ON feature_flags.entitlements_overrides USING btree (entitlement_key);

-- rollouts: Lookup by flag name
CREATE INDEX idx_rollouts_flag_name
  ON feature_flags.feature_flag_rollouts USING btree (flag_name);

-- rollouts: Active rollouts by flag (most common query path)
CREATE INDEX idx_rollouts_flag_name_active
  ON feature_flags.feature_flag_rollouts USING btree (flag_name, is_active);

-- rollouts: Filter only active rollouts
CREATE INDEX idx_rollouts_is_active
  ON feature_flags.feature_flag_rollouts USING btree (is_active);

-- Partial indexes: optimize common filter queries
-- Find active (non-expired, non-revoked) entitlements using stable is_active column
CREATE INDEX idx_entitlements_active
  ON feature_flags.entitlements (user_id) 
  WHERE is_active = true;

-- Find active (non-revoked, non-expired) overrides using stable is_active column
CREATE INDEX idx_overrides_active
  ON feature_flags.feature_flag_overrides (user_id) 
  WHERE revoked = false;

-- Find active (non-revoked, non-expired) entitlements_overrides using stable columns
CREATE INDEX idx_entitlements_overrides_active
  ON feature_flags.entitlements_overrides (user_id) 
  WHERE revoked = false;

-- Find active rollouts using stable is_active column
CREATE INDEX idx_rollouts_active_time
  ON feature_flags.feature_flag_rollouts (flag_name) 
  WHERE is_active = true;

-- ========================
-- TRIGGERS
-- ========================

CREATE TRIGGER trg_feature_flags_updated_at
  BEFORE UPDATE ON feature_flags.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER trg_entitlements_updated_at
  BEFORE UPDATE ON feature_flags.entitlements
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER trg_overrides_updated_at
  BEFORE UPDATE ON feature_flags.feature_flag_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER trg_rollouts_updated_at
  BEFORE UPDATE ON feature_flags.feature_flag_rollouts
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- Auto-update updated_at on entitlements_overrides
CREATE TRIGGER trg_entitlements_overrides_updated_at
  BEFORE UPDATE ON feature_flags.entitlements_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- ========================
-- HELPER FUNCTIONS
-- ========================

-- Mark expired entitlements as inactive.
-- Call this via cron job or application code to clean up expired entitlements.
-- Note: This does NOT delete rows; it sets is_active = false for audit/analytics.
CREATE OR REPLACE FUNCTION feature_flags.mark_expired_entitlements_inactive()
RETURNS void
LANGUAGE SQL
SECURITY DEFINER
SET search_path = feature_flags, public
AS $$
  UPDATE feature_flags.entitlements
  SET is_active = false
  WHERE is_active = true
    AND expires_at IS NOT NULL
    AND expires_at <= now();
$$;

-- ========================
-- ROW LEVEL SECURITY
-- ========================

ALTER TABLE feature_flags.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags.entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags.feature_flag_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags.entitlements_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags.feature_flag_rollouts ENABLE ROW LEVEL SECURITY;

-- ---- FEATURE_FLAGS POLICIES ----

-- Anyone can read feature flags (needed for unauthenticated feature gating)
DROP POLICY IF EXISTS "feature_flags_public_read" ON feature_flags.feature_flags;
CREATE POLICY "feature_flags_public_read" ON feature_flags.feature_flags
  FOR SELECT TO PUBLIC
  USING (true);

-- NOTE: INSERT policy removed - feature flags managed server-side only
-- Use Edge Functions or admin UI for all flag changes

DROP POLICY IF EXISTS "feature_flags_admin_update" ON feature_flags.feature_flags;
CREATE POLICY "feature_flags_admin_update" ON feature_flags.feature_flags
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "feature_flags_admin_delete" ON feature_flags.feature_flags;
CREATE POLICY "feature_flags_admin_delete" ON feature_flags.feature_flags
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---- ENTITLEMENTS POLICIES ----

-- Users can read their own entitlements
DROP POLICY IF EXISTS "entitlements_user_read_own" ON feature_flags.entitlements;
CREATE POLICY "entitlements_user_read_own" ON feature_flags.entitlements
  FOR SELECT TO authenticated
  USING (user_id = public.get_current_user_id());

-- Admins have full access to all entitlements
DROP POLICY IF EXISTS "entitlements_admin_full_access" ON feature_flags.entitlements;
CREATE POLICY "entitlements_admin_full_access" ON feature_flags.entitlements
  FOR ALL TO authenticated
  USING (public.is_admin());

-- ---- ENTITLEMENTS_OVERRIDES POLICIES ----

-- Users can read their own entitlements_overrides
DROP POLICY IF EXISTS "entitlements_overrides_user_read_own" ON feature_flags.entitlements_overrides;
CREATE POLICY "entitlements_overrides_user_read_own" ON feature_flags.entitlements_overrides
  FOR SELECT TO authenticated
  USING (user_id = public.get_current_user_id());

-- NOTE: INSERT policy removed - entitlement overrides managed server-side only
-- Use Edge Functions or admin UI for all override changes

DROP POLICY IF EXISTS "entitlements_overrides_admin_update" ON feature_flags.entitlements_overrides;
CREATE POLICY "entitlements_overrides_admin_update" ON feature_flags.entitlements_overrides
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "entitlements_overrides_admin_delete" ON feature_flags.entitlements_overrides;
CREATE POLICY "entitlements_overrides_admin_delete" ON feature_flags.entitlements_overrides
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---- FEATURE_FLAG_OVERRIDES POLICIES ----

-- Users can read their own overrides
DROP POLICY IF EXISTS "overrides_user_read_own" ON feature_flags.feature_flag_overrides;
CREATE POLICY "overrides_user_read_own" ON feature_flags.feature_flag_overrides
  FOR SELECT TO authenticated
  USING (user_id = public.get_current_user_id());

-- NOTE: INSERT policy removed - feature flag overrides managed server-side only
-- Use Edge Functions or admin UI for all override changes

DROP POLICY IF EXISTS "overrides_admin_update" ON feature_flags.feature_flag_overrides;
CREATE POLICY "overrides_admin_update" ON feature_flags.feature_flag_overrides
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "overrides_admin_delete" ON feature_flags.feature_flag_overrides;
CREATE POLICY "overrides_admin_delete" ON feature_flags.feature_flag_overrides
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---- FEATURE_FLAG_ROLLOUTS POLICIES ----

-- Authenticated users can read rollouts (needed for client-side bucketing)
DROP POLICY IF EXISTS "rollouts_authenticated_read" ON feature_flags.feature_flag_rollouts;
CREATE POLICY "rollouts_authenticated_read" ON feature_flags.feature_flag_rollouts
  FOR SELECT TO authenticated
  USING (true);

-- NOTE: INSERT policy removed - feature flag rollouts managed server-side only
-- Use Edge Functions or admin UI for all rollout changes

DROP POLICY IF EXISTS "rollouts_admin_update" ON feature_flags.feature_flag_rollouts;
CREATE POLICY "rollouts_admin_update" ON feature_flags.feature_flag_rollouts
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "rollouts_admin_delete" ON feature_flags.feature_flag_rollouts;
CREATE POLICY "rollouts_admin_delete" ON feature_flags.feature_flag_rollouts
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ========================
-- COMMENTS (Documentation)
-- ========================

COMMENT ON TABLE feature_flags.feature_flags IS
  'Master list of feature flags. Resolution order: overrides > entitlements > rollouts > global enabled flag.';

COMMENT ON TABLE feature_flags.entitlements IS
  'User capability unlocks (premium, beta access, etc.). Can be permanent or temporary (via expires_at). is_active tracks auto-expiry; remind_user prompts for renewal.';

COMMENT ON TABLE feature_flags.feature_flag_overrides IS
  'Admin-only overrides for global feature flags per user. Supports temporarily enabling/disabling features for testing, early access, or emergency bug mitigation.';

COMMENT ON COLUMN feature_flags.feature_flag_overrides.flag_name IS
  'The flag being overridden. Must exist in feature_flags.feature_flags table.';

COMMENT ON TABLE feature_flags.entitlements_overrides IS
  'Admin tool to temporarily grant/revoke entitlements. Separate from feature_flag_overrides for cleaner entitlement management.';

COMMENT ON TABLE feature_flags.feature_flag_rollouts IS
  'Percentage-based A/B testing via deterministic hashing. Users bucketed by FNV-1a(user_id + seed).';

COMMENT ON COLUMN feature_flags.entitlements.is_active IS
  'Active flag. Auto-set to false when expires_at is reached (via mark_expired_entitlements_inactive). Can be manually revoked by admins.';

COMMENT ON COLUMN feature_flags.entitlements.remind_user IS
  'Reminder flag for expired entitlements. Set to true when expiry is detected; app can prompt user for renewal. Reset to false after user action (yes/no/skip).';

COMMENT ON COLUMN feature_flags.entitlements.expires_at IS
  'Expiration timestamp. NULL = permanent. Index supports fast cleanup queries.';

COMMENT ON COLUMN feature_flags.feature_flag_overrides.revoked IS
  'Soft-revoke flag (true = revoked, not deleted). Preserves audit trail via triggers.';

COMMENT ON COLUMN feature_flags.feature_flag_overrides.reason IS
  'Admin notes explaining why this override was applied (for audit and future reference).';

COMMENT ON COLUMN feature_flags.entitlements_overrides.is_active IS
  'Override state. true = force grant, false = force revoke.';

COMMENT ON COLUMN feature_flags.entitlements_overrides.revoked IS
  'Soft-revoke flag. true = this override is no longer applied.';

COMMENT ON COLUMN feature_flags.entitlements_overrides.reason IS
  'Admin notes (e.g., "testing premium access", "early access grant").';

COMMENT ON COLUMN feature_flags.feature_flag_rollouts.percentage IS
  'Rollout percentage (0-100). Users are deterministically bucketed by hash; consistent across sessions.';

COMMENT ON COLUMN feature_flags.feature_flag_rollouts.seed IS
  'Optional re-seed value to re-bucket users without changing percentage. Useful for refreshing A/B tests.';

COMMENT ON FUNCTION feature_flags.mark_expired_entitlements_inactive() IS
  'Call via cron or application code to mark expired entitlements as inactive (is_active = false). Does not delete rows; preserves audit history.';

COMMIT;
