-- ============================================================
-- 001: PUBLIC SCHEMA
-- Tables: users, user_settings
-- Also: utility functions, auth signup trigger
-- ============================================================
-- EXECUTION ORDER: Run this FIRST (before 002, 003, 004)
-- PREREQUISITES: Fresh Supabase project with auth.users table
-- AFTER THIS: Run 002_worlds_schema.sql
-- ============================================================
-- NOTE: invite_links is created in 002_worlds_schema.sql in the `worlds` schema.
-- ============================================================

-- ========================
-- EXTENSIONS
-- ========================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

BEGIN;

-- ========================
-- TABLES
-- ========================

-- USERS: Core identity table. Bridges Supabase auth.users to app data.
-- One row per authenticated user; created on signup via trigger.
CREATE TABLE public.users (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  auth_id     uuid        NOT NULL,
  username    text        NOT NULL DEFAULT 'changeling',
  is_admin    boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz NULL,      -- Soft delete; cleanup job hard-deletes after grace period

  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_auth_id_key UNIQUE (auth_id),
  CONSTRAINT users_auth_id_fkey FOREIGN KEY (auth_id)
    REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT ck_username_not_empty CHECK (length(trim(username)) > 0)
);

-- USER_SETTINGS: Separated from users for extensibility and portability.
-- One row per user; auto-created on signup via trigger.
CREATE TABLE public.user_settings (
  user_id     uuid        NOT NULL,
  theme       text        NOT NULL DEFAULT 'auto',
  language    text        NOT NULL DEFAULT 'en',
  timezone    text        NOT NULL DEFAULT 'UTC',
  preferences jsonb       NOT NULL DEFAULT '{}',  -- Future: notifications, accessibility, etc.
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT user_settings_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT ck_theme_valid CHECK (theme IN ('light', 'dark', 'auto'))
);


-- ========================
-- UTILITY FUNCTIONS (created AFTER tables so they can reference them)
-- ========================

-- Generic updated_at trigger function (reusable across ALL schemas).
-- Avoids updating timestamp if the row hasn't actually changed (prevents churn).
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- On INSERT or DELETE, always update. On UPDATE, only update if data changed.
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

-- Get the internal user ID for the currently authenticated user.
-- Returns NULL if user doesn't exist or is soft-deleted.
-- Safe for use in RLS USING/WITH CHECK clauses.
-- SECURITY DEFINER: runs with function owner's privileges (trusted operation).
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS uuid
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.users
  WHERE auth_id = (SELECT auth.uid())
    AND deleted_at IS NULL
  LIMIT 1;
$$;

-- Get the auth_id for a given internal user_id.
-- Returns the Supabase auth UUID linked to this user.
-- Used in RLS policies that need to map user_id → auth identity.
-- SECURITY DEFINER: trusted lookup function.
CREATE OR REPLACE FUNCTION public.get_user_auth_id(p_user_id uuid)
RETURNS uuid
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth_id FROM public.users
  WHERE id = p_user_id
  LIMIT 1;
$$;

-- Check if the currently authenticated user is an admin.
-- Single source of truth: checks DB (users.is_admin), not JWT claims.
-- Resolves to false if user doesn't exist or is soft-deleted.
-- SECURITY DEFINER: safe for use in RLS policies without privilege elevation.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.users
     WHERE auth_id = (SELECT auth.uid())
       AND deleted_at IS NULL
     LIMIT 1),
    false
  );
$$;

-- ========================
-- INDEXES
-- ========================

-- users: auth_id UNIQUE constraint auto-creates index (for pk lookups).
-- Additional index for sorting by creation date.
CREATE INDEX idx_users_created_at ON public.users USING btree (created_at DESC);

-- users: partial index on active (non-deleted) users for common queries.
CREATE INDEX idx_users_not_deleted
  ON public.users USING btree (deleted_at) WHERE deleted_at IS NULL;


-- ========================
-- TRIGGERS: updated_at
-- ========================

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER trg_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- ========================
-- AUTH SIGNUP TRIGGER
-- ========================
-- Auto-creates a users row + default user_settings when a new auth.users row is inserted.
-- Safely handles high-concurrency and duplicate trigger events via ON CONFLICT.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Insert or update users row (idempotent: handles duplicate trigger calls)
  INSERT INTO public.users (auth_id, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'changeling')
  )
  ON CONFLICT (auth_id) DO UPDATE SET username = EXCLUDED.username
  RETURNING id INTO v_user_id;

  -- Insert user_settings if not already present (idempotent)
  INSERT INTO public.user_settings (user_id)
  VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========================
-- ROW LEVEL SECURITY
-- ========================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- ---- USERS POLICIES ----

-- Users can read their own profile (soft-deleted users are excluded)
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT TO authenticated
  USING (auth_id = (SELECT auth.uid()) AND deleted_at IS NULL);

-- NOTE: INSERT policy removed - auth trigger creates profile on signup
-- Use server-side functions for any app inserts (none needed currently)

-- Users can update their own profile (soft-deleted users cannot)
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE TO authenticated
  USING (auth_id = (SELECT auth.uid()) AND deleted_at IS NULL)
  WITH CHECK (auth_id = (SELECT auth.uid()));

-- Users can delete their own profile (initiates soft or hard delete)
CREATE POLICY "users_delete_own" ON public.users
  FOR DELETE TO authenticated
  USING (auth_id = (SELECT auth.uid()));

-- Admins have full access to all user records
CREATE POLICY "users_admin_full_access" ON public.users
  FOR ALL TO authenticated
  USING (public.is_admin());

-- ---- USER_SETTINGS POLICIES ----

-- Users can read their own settings
CREATE POLICY "user_settings_select_own" ON public.user_settings
  FOR SELECT TO authenticated
  USING (user_id = public.get_current_user_id());

-- NOTE: INSERT policy removed - signup trigger creates settings automatically
-- Use server-side functions for any app inserts (none needed currently)

-- Users can update their own settings
CREATE POLICY "user_settings_update_own" ON public.user_settings
  FOR UPDATE TO authenticated
  USING (user_id = public.get_current_user_id())
  WITH CHECK (user_id = public.get_current_user_id());

-- Admins have full access
CREATE POLICY "user_settings_admin_full_access" ON public.user_settings
  FOR ALL TO authenticated
  USING (public.is_admin());

COMMIT;
