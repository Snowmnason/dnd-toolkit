-- ============================================================
-- 005: COHORTS (feature_flags schema)
-- Tables: cohorts, cohort_flag_assignments, user_cohort_memberships
-- EXECUTION ORDER: Run AFTER 003_feature_flags_schema.sql and 001_public_schema.sql
-- PREREQUISITES: public.update_timestamp(), public.get_current_user_id(), public.is_admin(), audit.log_change() (optional)
-- ============================================================

BEGIN;

-- Ensure feature_flags schema exists (safe if already present)
CREATE SCHEMA IF NOT EXISTS feature_flags;

-- Ensure required extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ========================
-- TABLES
-- ========================

-- COHORTS: Definitions of named cohorts for feature targeting
CREATE TABLE IF NOT EXISTS feature_flags.cohorts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  description text NULL,
  percentage integer NOT NULL DEFAULT 100,
  seed text NULL,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cohorts_pkey PRIMARY KEY (id),
  CONSTRAINT cohorts_slug_unique UNIQUE (slug),
  CONSTRAINT ck_percentage_range CHECK (percentage >= 0 AND percentage <= 100),
  CONSTRAINT ck_seed_length CHECK (seed IS NULL OR length(seed) > 0)
);

-- COHORT_FLAG_ASSIGNMENTS: Map flags to cohorts (many-to-many)
CREATE TABLE IF NOT EXISTS feature_flags.cohort_flag_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  flag_name text NOT NULL,
  cohort_id uuid NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cfa_pkey PRIMARY KEY (id),
  CONSTRAINT cfa_flag_fkey FOREIGN KEY (flag_name)
    REFERENCES feature_flags.feature_flags(flag_name) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT cfa_cohort_fkey FOREIGN KEY (cohort_id)
    REFERENCES feature_flags.cohorts(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT cfa_flag_cohort_unique UNIQUE (flag_name, cohort_id)
);

-- USER_COHORT_MEMBERSHIPS: Explicit admin-assigned or system-assigned memberships
CREATE TABLE IF NOT EXISTS feature_flags.user_cohort_memberships (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cohort_id uuid NOT NULL,
  source text NOT NULL,
  created_by uuid NULL,
  reason text NULL,
  expires_at timestamptz NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ucm_pkey PRIMARY KEY (id),
  CONSTRAINT ucm_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT ucm_cohort_fkey FOREIGN KEY (cohort_id) REFERENCES feature_flags.cohorts(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT ucm_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT ucm_user_cohort_unique UNIQUE (user_id, cohort_id)
);

-- ========================
-- INDEXES
-- ========================

CREATE INDEX IF NOT EXISTS idx_cohort_flag_assignments_flag ON feature_flags.cohort_flag_assignments(flag_name);
CREATE INDEX IF NOT EXISTS idx_cohorts_active ON feature_flags.cohorts(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_cohort_memberships_user ON feature_flags.user_cohort_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_user_cohort_memberships_cohort ON feature_flags.user_cohort_memberships(cohort_id);
-- Maintain `is_active` boolean via trigger; index on stable boolean predicate for planner friendliness
CREATE INDEX IF NOT EXISTS idx_user_cohort_memberships_active ON feature_flags.user_cohort_memberships(user_id, cohort_id) WHERE is_active = true;

-- ========================
-- TRIGGERS
-- ========================

-- Update `updated_at` on change (uses public.update_timestamp())
CREATE TRIGGER trg_cohorts_updated_at
  BEFORE UPDATE ON feature_flags.cohorts
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER trg_cfa_updated_at
  BEFORE UPDATE ON feature_flags.cohort_flag_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER trg_ucm_updated_at
  BEFORE UPDATE ON feature_flags.user_cohort_memberships
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- Maintain `is_active` based on `expires_at` for stable indexing and queries
CREATE OR REPLACE FUNCTION feature_flags.user_cohort_memberships_set_is_active()
RETURNS trigger AS $$
BEGIN
  NEW.is_active := (NEW.expires_at IS NULL OR NEW.expires_at > now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ucm_set_is_active
  BEFORE INSERT OR UPDATE ON feature_flags.user_cohort_memberships
  FOR EACH ROW EXECUTE FUNCTION feature_flags.user_cohort_memberships_set_is_active();

-- Attach existing centralized audit trigger if available
-- (audit.log_change() is created by 004_audit_schema.sql in this repo)
DO $$
BEGIN
  -- Check for existence of audit.log_change function in the audit schema
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'log_change' AND n.nspname = 'audit'
  ) THEN
    -- attach audit triggers idempotently (skip if triggers already exist)
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_cohorts') THEN
      CREATE TRIGGER trg_audit_cohorts
        AFTER INSERT OR UPDATE OR DELETE ON feature_flags.cohorts
        FOR EACH ROW EXECUTE FUNCTION audit.log_change();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_cohort_flag_assignments') THEN
      CREATE TRIGGER trg_audit_cohort_flag_assignments
        AFTER INSERT OR UPDATE OR DELETE ON feature_flags.cohort_flag_assignments
        FOR EACH ROW EXECUTE FUNCTION audit.log_change();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_user_cohort_memberships') THEN
      CREATE TRIGGER trg_audit_user_cohort_memberships
        AFTER INSERT OR UPDATE OR DELETE ON feature_flags.user_cohort_memberships
        FOR EACH ROW EXECUTE FUNCTION audit.log_change();
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ========================
-- RLS POLICIES
-- ========================

ALTER TABLE feature_flags.cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags.cohort_flag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags.user_cohort_memberships ENABLE ROW LEVEL SECURITY;

-- Public: allow reading active cohorts
DROP POLICY IF EXISTS cohorts_select_public ON feature_flags.cohorts;
CREATE POLICY cohorts_select_public ON feature_flags.cohorts FOR SELECT TO PUBLIC USING (coalesce(is_active, false) = true);

-- Public: allow reading enabled assignments
DROP POLICY IF EXISTS cohort_flag_assignments_select_public ON feature_flags.cohort_flag_assignments;
CREATE POLICY cohort_flag_assignments_select_public ON feature_flags.cohort_flag_assignments FOR SELECT TO PUBLIC USING (enabled = true);

-- Users: can read their own explicit memberships
DROP POLICY IF EXISTS user_cohort_memberships_select_self ON feature_flags.user_cohort_memberships;
CREATE POLICY user_cohort_memberships_select_self ON feature_flags.user_cohort_memberships FOR SELECT TO authenticated USING (user_id = (SELECT public.get_current_user_id()));

-- Admins: full access to manage cohorts and assignments
DROP POLICY IF EXISTS cohorts_admin_all ON feature_flags.cohorts;
CREATE POLICY cohorts_admin_all ON feature_flags.cohorts FOR ALL TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS cfa_admin_all ON feature_flags.cohort_flag_assignments;
CREATE POLICY cfa_admin_all ON feature_flags.cohort_flag_assignments FOR ALL TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS ucm_admin_all ON feature_flags.user_cohort_memberships;
CREATE POLICY ucm_admin_all ON feature_flags.user_cohort_memberships FOR ALL TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

-- ========================
-- SEED DATA (idempotent)
-- ========================

INSERT INTO feature_flags.cohorts (slug, name, description, percentage)
VALUES
  ('beta_testers', 'Beta Testers', 'Early adopters testing features before release', 20),
  ('enterprise', 'Enterprise', 'Enterprise customers', 100),
  ('internal', 'Internal Team', 'Internal team members (dogfooding)', 100),
  ('mobile_first', 'Mobile-First Users', 'Mobile platform optimizations', 100),
  ('desktop_first', 'Desktop-First Users', 'Desktop/web platform optimizations', 100)
ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      percentage = EXCLUDED.percentage,
      updated_at = now();

COMMIT;
