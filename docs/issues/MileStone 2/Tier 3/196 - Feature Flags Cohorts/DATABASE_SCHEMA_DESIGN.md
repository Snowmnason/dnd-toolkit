# Issue #196 Phase 2: Database Schema & Cohort Design

**Document Type:** Schema Design & Migration Strategy  
**Current State Analysis:** Reviewed 001-004 migrations, public + feature_flags schemas, get_feature_flags edge function

---

## 1. Cohort Enum Definition

### Recommended Cohorts

```typescript
// In lib/feature-flags/cohorts.ts (Phase 1)
export enum CohortId {
  BETA_TESTERS = "beta_testers",      // Early adopters, pre-release testing
  ENTERPRISE = "enterprise",           // Enterprise customers (may not apply to D&D app, but general)
  INTERNAL = "internal",               // Internal team, dogfooding
  MOBILE_FIRST = "mobile_first",       // Mobile-optimized features (platform consideration)
  DESKTOP_FIRST = "desktop_first",     // Desktop/web-optimized features
}

export interface CohortDef {
  id: CohortId;
  name: string;
  description?: string;
  percentage?: number;  // 0-100; null/undefined = 100%
}

// Configuration mapping in appsettings.json
export const COHORT_DEFINITIONS: Record<CohortId, CohortDef> = {
  [CohortId.BETA_TESTERS]: {
    id: CohortId.BETA_TESTERS,
    name: "Beta Testers",
    description: "Early adopters testing features before release",
    percentage: 20,
  },
  [CohortId.ENTERPRISE]: {
    id: CohortId.ENTERPRISE,
    name: "Enterprise Customers",
    description: "Enterprise tier customers",
    percentage: 100,
  },
  [CohortId.INTERNAL]: {
    id: CohortId.INTERNAL,
    name: "Internal Team",
    description: "Internal team members (dogfooding)",
    percentage: 100,
  },
  [CohortId.MOBILE_FIRST]: {
    id: CohortId.MOBILE_FIRST,
    name: "Mobile-First Users",
    description: "Users on mobile platforms (iOS/Android)",
    percentage: 100,
  },
  [CohortId.DESKTOP_FIRST]: {
    id: CohortId.DESKTOP_FIRST,
    name: "Desktop-First Users",
    description: "Users on desktop/web platforms",
    percentage: 100,
  },
};
```

### Semantics & Use Cases

| Cohort | Use Case | Example |
|--------|----------|---------|
| **beta_testers** | Early feature adoption; semi-controlled rollout | "Enable advanced_maps for beta testers first (20%)" |
| **enterprise** | Tier-based features (not all apps need this) | "Enterprise license features (licensing system later)" |
| **internal** | Team dogfooding, internal-only tools | "Internal notes system, team analytics" |
| **mobile_first** | Mobile platform-specific features (with #198 conditions) | "Mobile gesture controls (mobile_first cohort AND platform=ios/android)" |
| **desktop_first** | Desktop/web platform-specific features (with #198 conditions) | "Desktop-optimized UI (desktop_first cohort AND platform=web)" |

---

## 2. Database Schema Location & Design

### Recommendation: Place in `feature_flags` Schema

**Rationale:**
- Cohorts are feature control constructs (like flags, entitlements, overrides)
- Keeps related functionality together in `feature_flags` schema
- Separate from user identity (`public.users`) → cleaner separation of concerns
- Easier to audit and manage as a feature control system

### Proposed Tables

```sql
-- COHORTS: Named groups of users for feature targeting.
-- Example: beta_testers, qa_testers, enterprise, internal
-- Deterministic membership via hashing (see isUserInCohort in app)
-- Also supports explicit membership via user_cohort_memberships
CREATE TABLE feature_flags.cohorts (
  id              text        NOT NULL,       -- "beta_testers", "qa_testers", etc. (PK)
  name            text        NOT NULL,       -- "Beta Testers" (display name)
  description     text        NULL,           -- Human-readable description
  percentage      integer     NOT NULL DEFAULT 100,  -- 0-100; % of users included (deterministic bucketing)
  is_active       boolean     NOT NULL DEFAULT true, -- Admin can deactivate cohort
  
  -- Metadata for future use (Phase 2+):
  -- - promotion_date: when to promote next stage
  -- - rollback_plan: if something goes wrong, revert to this cohort #
  -- - owner: who manages this cohort (admin user)
  metadata        jsonb       NULL,
  
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT cohorts_pkey PRIMARY KEY (id),
  CONSTRAINT ck_percentage_range CHECK (percentage >= 0 AND percentage <= 100)
);

-- COHORT_FLAG_ASSIGNMENTS: Map flags to cohorts (many-to-many).
-- Example: advancedMaps flag enabled for beta_testers AND enterprise cohorts
CREATE TABLE feature_flags.cohort_flag_assignments (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  flag_name   text        NOT NULL,
  cohort_id   text        NOT NULL,
  enabled     boolean     NOT NULL DEFAULT true,  -- true = flag enabled for this cohort
  
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT cohort_flag_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT cfa_flag_fkey FOREIGN KEY (flag_name)
    REFERENCES feature_flags.feature_flags(flag_name) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT cfa_cohort_fkey FOREIGN KEY (cohort_id)
    REFERENCES feature_flags.cohorts(id) ON UPDATE CASCADE ON DELETE CASCADE,
  -- Prevent duplicate assignments
  CONSTRAINT cfa_flag_cohort_unique UNIQUE (flag_name, cohort_id)
);

-- USER_COHORT_MEMBERSHIPS: Optional explicit cohort membership (Phase 2+).
-- Used for admin-assigned memberships OR property-based auto-assignment (future).
-- 
-- Note: Deterministic membership (via hash in app) doesn't require database storage.
-- This table is optional and only needed for:
--   - Explicit admin assignments (override deterministic bucketing)
--   - Audit trail (who is explicitly in which cohort)
--   - Dynamic assignment based on user properties (future)
--
-- The app uses THREE sources of cohort membership (in order):
--   1. Explicit membership (this table) - highest priority
--   2. Deterministic bucketing (hash-based, no DB needed) - middle
--   3. No membership - fallback
CREATE TABLE feature_flags.user_cohort_memberships (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL,
  cohort_id   text        NOT NULL,
  source      text        NOT NULL,  -- 'admin', 'property-based', 'auto-assigned'
  
  created_by  uuid        NULL,      -- Which admin assigned this
  reason      text        NULL,      -- Why was this assigned?
  expires_at  timestamptz NULL,      -- Temporary assignment expiry (e.g., for testing)
  
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  
  # Issue #196 — Phase 2: Database Schema & Cohort Design (revised)

  Document purpose: produce an implementable, ordered migration and design plan for cohorts, matching the repo's existing migration conventions (see 001–004). This document is reorganized for clarity and execution.

  Contents
  - Prerequisites & safety checks
  - TypeScript interfaces & public API changes (Phase 1)
  - Migration file: `005_add_cohorts.sql` (DDL, indexes, triggers, seeds)
  - RLS policies (placed immediately after DDL)
  - Edge function / API changes
  - Client caching, bootstrap, and evaluation flow
  - Audit, telemetry, privacy, and retention
  - Tests, validation and rollout checklist
  - Implementation checklist & migration recipe

  ---

  ## Prerequisites & Safety Checks

  Before creating or applying `005_add_cohorts.sql`, verify the environment matches expectations:

  - Required Postgres extensions (add to migration header):
    - `pgcrypto` (for `gen_random_uuid()`)
    - `uuid-ossp` (if used) — include `CREATE EXTENSION IF NOT EXISTS` statements in migration

  - Required helper functions (present in `001_public_schema.sql`):
    - `public.update_timestamp()` — used by triggers
    - `public.get_current_user_id()` — used by RLS
    - `public.is_admin()` — used by RLS

  If any helper is missing in an environment, the migration should either create a safe stub (for development) or fail early with a clear message and link to `001_public_schema.sql`.

  Security note: seed data and cohort definitions returned by public endpoints must not contain admin-only fields (e.g., `metadata.owner_id`) unless the caller is authorized.

  ---

  ## Phase 1 (Config + Types) — Minimal client changes (safe, no DB required)

  Goal: Add TypeScript types and small API changes so the client can support cohorts defined in config before DB rollout.

  Files to add/modify:
  - `lib/feature-flags/cohorts.ts` — new module with deterministic bucketing helpers.
  - `lib/feature-flags/README.md` — docs for usage and seeds.

  Types (copy-paste ready)
  ```ts
  export interface CohortDef {
    id: string;            // e.g. 'beta_testers'
    name: string;
    description?: string;
    percentage?: number;   // 0-100; undefined => 100
    seed?: string | null;  // optional seed for rebalancing
    metadata?: Record<string, any> | null;
  }

  export interface CohortRow extends CohortDef {
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }

  export interface CohortFlagAssignmentRow {
    id: string;
    flag_name: string;
    cohort_id: string;
    enabled: boolean;
  }

  export interface UserCohortMembershipRow {
    id: string;
    user_id: string;
    cohort_id: string;
    source: string; // 'admin'|'property-based'|'auto-assigned'
    expires_at?: string | null;
  }
  ```

  Public API change (recommended, additive):

  ```ts
  // Backward-compatible overload
  isEnabled(flagName: string): boolean
  isEnabled(flagName: string, userId?: string, context?: FlagContext): boolean
  ```

  Helper functions to implement in `lib/feature-flags/cohorts.ts`:

  ```ts
  function isUserInCohort(
    userId: string,
    cohortId: string,
    cohortDef: CohortDef,
    explicitMemberships?: string[]
  ): boolean {
    if (explicitMemberships?.includes(cohortId)) return true;
    const percentage = cohortDef.percentage ?? 100;
    const seed = cohortDef.seed ?? cohortId;
    return isInRollout(userId, cohortId, percentage, seed);
  }
  ```

  ---

  ## Migration: `005_add_cohorts.sql` (Phase 2)

  Purpose: create `feature_flags.cohorts`, `feature_flags.cohort_flag_assignments`, `feature_flags.user_cohort_memberships`, with indexes, triggers, RLS, seed data, and audit triggers. Follow patterns from `003_feature_flags_schema.sql` (schema creation, grants, indexes) and `001_public_schema.sql` (helper functions, triggers).

  Migration header (pattern consistent with existing files):

  ```sql
  -- ============================================================
  -- 005: COHORTS (feature_flags schema)
  -- Tables: cohorts, cohort_flag_assignments, user_cohort_memberships
  -- EXECUTION ORDER: Run AFTER 003_feature_flags_schema.sql and 001_public_schema.sql
  -- PREREQUISITES: public.update_timestamp(), public.get_current_user_id(), public.is_admin(), extensions
  -- ============================================================

  BEGIN;

  -- Ensure extensions
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

  CREATE SCHEMA IF NOT EXISTS feature_flags;
  GRANT USAGE ON SCHEMA feature_flags TO anon, authenticated, service_role;
  -- (match grants used in 003)
  ```

  DDL (core tables) — follow existing style and constraints:

  ```sql
  CREATE TABLE IF NOT EXISTS feature_flags.cohorts (
    id text NOT NULL,
    name text NOT NULL,
    description text NULL,
    percentage integer NOT NULL DEFAULT 100,
    seed text NULL,
    is_active boolean NOT NULL DEFAULT true,
    metadata jsonb NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT cohorts_pkey PRIMARY KEY (id),
    CONSTRAINT ck_percentage_range CHECK (percentage >= 0 AND percentage <= 100),
    CONSTRAINT ck_seed_length CHECK (seed IS NULL OR length(seed) > 0)
  );

  CREATE TABLE IF NOT EXISTS feature_flags.cohort_flag_assignments (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    flag_name text NOT NULL,
    cohort_id text NOT NULL,
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

  CREATE TABLE IF NOT EXISTS feature_flags.user_cohort_memberships (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    cohort_id text NOT NULL,
    source text NOT NULL,
    created_by uuid NULL,
    reason text NULL,
    expires_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ucm_pkey PRIMARY KEY (id),
    CONSTRAINT ucm_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT ucm_cohort_fkey FOREIGN KEY (cohort_id) REFERENCES feature_flags.cohorts(id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT ucm_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL,
    CONSTRAINT ucm_user_cohort_unique UNIQUE (user_id, cohort_id)
  );
  ```

  Indexes and triggers (attach `public.update_timestamp()`):

  ```sql
  CREATE INDEX IF NOT EXISTS idx_cohort_flag_assignments_flag ON feature_flags.cohort_flag_assignments(flag_name);
  CREATE INDEX IF NOT EXISTS idx_cohorts_active ON feature_flags.cohorts(is_active) WHERE is_active = true;
  CREATE INDEX IF NOT EXISTS idx_user_cohort_memberships_user ON feature_flags.user_cohort_memberships(user_id);
  CREATE INDEX IF NOT EXISTS idx_user_cohort_memberships_cohort ON feature_flags.user_cohort_memberships(cohort_id);
  CREATE INDEX IF NOT EXISTS idx_user_cohort_memberships_active ON feature_flags.user_cohort_memberships(user_id, cohort_id) WHERE expires_at IS NULL OR expires_at > now();

  CREATE TRIGGER IF NOT EXISTS trg_cohorts_updated_at BEFORE UPDATE ON feature_flags.cohorts FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
  CREATE TRIGGER IF NOT EXISTS trg_cfa_updated_at BEFORE UPDATE ON feature_flags.cohort_flag_assignments FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
  CREATE TRIGGER IF NOT EXISTS trg_ucm_updated_at BEFORE UPDATE ON feature_flags.user_cohort_memberships FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
  ```

  Seed data (idempotent):

  ```sql
  INSERT INTO feature_flags.cohorts (id, name, description, percentage) VALUES
    ('beta_testers', 'Beta Testers', 'Early adopters testing features before release', 20),
    ('enterprise', 'Enterprise', 'Enterprise customers', 100),
    ('internal', 'Internal Team', 'Internal team members (dogfooding)', 100),
    ('mobile_first', 'Mobile-First Users', 'Mobile platform optimizations', 100),
    ('desktop_first', 'Desktop-First Users', 'Desktop/web platform optimizations', 100)
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, percentage = EXCLUDED.percentage WHERE feature_flags.cohorts.is_active = true;
  ```

  Commit at end of file:

  ```sql
  COMMIT;
  ```

  ---

  ## RLS Policies (add immediately after DDL in migration)

  Policies follow the project's pattern — examples below must be reviewed against `001_public_schema.sql` helpers.

  ```sql
  -- Public: allow reading active cohorts
  CREATE POLICY IF NOT EXISTS cohorts_select_public ON feature_flags.cohorts FOR SELECT USING (is_active = true);

  -- Public: allow reading enabled assignments
  CREATE POLICY IF NOT EXISTS cohort_flag_assignments_select_public ON feature_flags.cohort_flag_assignments FOR SELECT USING (enabled = true);

  -- Users may read their own explicit memberships
  CREATE POLICY IF NOT EXISTS user_cohort_memberships_select_self ON feature_flags.user_cohort_memberships FOR SELECT USING (user_id = public.get_current_user_id());

  -- Admins manage cohorts/assignments/memberships
  CREATE POLICY IF NOT EXISTS cohorts_admin_all ON feature_flags.cohorts FOR ALL USING (public.is_admin());
  CREATE POLICY IF NOT EXISTS cfa_admin_all ON feature_flags.cohort_flag_assignments FOR ALL USING (public.is_admin());
  CREATE POLICY IF NOT EXISTS ucm_admin_all ON feature_flags.user_cohort_memberships FOR ALL USING (public.is_admin());
  ```

  Notes:
  - Ensure `public.get_current_user_id()` and `public.is_admin()` exist; otherwise migration must fail with a clear precheck message.

  ---

  ## Edge functions & API

  Phase 1: client-side only. No edge function change required if cohorts are config-only.

  Phase 2 (recommended): update `get_feature_flags` to include `cohorts` and `cohort_flag_assignments` and (optionally) `user_cohort_memberships` for the requesting user (RLS will limit rows).

  Suggested response types (TypeScript):

  ```ts
  interface GetFeatureFlagsResponse {
    flags: FeatureFlagRow[];
    entitlements: EntitlementRow[];
    overrides: OverrideRow[];
    cohorts: CohortRow[]; // public: active cohorts
    cohort_flag_assignments: CohortFlagAssignmentRow[]; // public: enabled assignments
    user_cohort_memberships?: UserCohortMembershipRow[]; // RLS filtered to this user
  }
  ```

  If `user_cohort_memberships` is returned, it must be filtered by RLS and should not include admin-only metadata unless caller is admin.

  ---

  ## Client bootstrap, caching & evaluation flow

  Recommended flow (safe, backwards-compatible):

  1. `FeatureFlagsManager.bootstrapFlags()` — fetch feature flags (existing behavior)
  2. Fetch cohorts & assignments (edge function) — cache locally
  3. For each `isEnabled(flag, userId?, context?)` call:
     - Check overrides/entitlements/flag.enabled (existing resolution order)
     - If flag has cohorts and userId provided, evaluate cohort membership:
         a. Query explicit memberships (from cached `user_cohort_memberships` or edge function)
         b. If explicit membership exists, use it (highest priority)
         c. Else run deterministic bucketing via `isInRollout(userId, cohortId, percentage, seed)`
     - Evaluate conditions (Phase 3) and dependencies

  Caching recommendations:
  - Cohort definitions: TTL = 1h
  - Cohort assignments: TTL = 30m
  - User explicit memberships: TTL = 15m

  Provide a manual invalidation path (admin action triggers websocket/event to invalidate caches), and fallbacks to last cached state if fetch fails.

  ---

  ## Audit, telemetry and privacy

  - Attach `audit.log_change()` triggers to cohort tables (consistent with `004_audit_schema.sql`).
  - Telemetry events:
    - `cohort_assigned` (hashed user id, cohort id, source)
    - `flag_evaluated` (flag, enabled, reason)
    - `admin_action` (create/assign/remove)

  Privacy & retention:
  - `user_cohort_memberships` contains PII: limit access via RLS, log only hashed user identifiers in telemetry.
  - Add retention policy: delete expired explicit memberships after 90 days (or configurable interval).

  ---

  ## Tests & validation

  Unit tests:
  - `isUserInCohort()` determinism (same user+seed yields same result)
  - seed rebalancing tests
  - explicit override precedence

  Integration tests:
  - RLS: non-admin read vs admin write
  - get_feature_flags includes cohorts and assignments

  Performance: measure fetch times with 100+ cohorts and 10k assignments; ensure indexes support queries used by edge functions.

  ---

  ## Migration recipe (step-by-step)

  1. Prepare migration `005_add_cohorts.sql` and review in staging.
  2. Run migration in staging; ensure no helper function errors.
  3. Upsert config-defined cohorts into DB (idempotent upsert script).
  4. Update edge function `get_feature_flags` to include cohorts and assignments; deploy to staging.
  5. Update client to fetch cohorts (feature-gated). Ship only once staged successfully.
  6. Monitor telemetry for cohort distribution and errors.
  7. Rollout to production in maintenance window; if issues, rollback client gate and remove DB changes if necessary.

  ---

  ## Implementation checklist

  - [ ] Add `lib/feature-flags/cohorts.ts` with helper functions and types
  - [ ] Create `supabase/migrations/005_add_cohorts.sql` (DDL + RLS + indexes + triggers + seeds)
  - [ ] Update `get_feature_flags` to return cohort data
  - [ ] Add unit & integration tests
  - [ ] Add docs to `lib/feature-flags/README.md` and `docs/issues/.../SERVER_SIDE.md`
  - [ ] Create small upsert script to import config cohorts into DB

  ---

  If you'd like, I can now generate a draft `005_add_cohorts.sql` (idempotent), the `cohorts.ts` helper module skeleton, and a unit test scaffold. Which should I create first?

