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
  
  CONSTRAINT ucm_pkey PRIMARY KEY (id),
  CONSTRAINT ucm_user_fkey FOREIGN KEY (user_id)
    REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT ucm_cohort_fkey FOREIGN KEY (cohort_id)
    REFERENCES feature_flags.cohorts(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT ucm_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.users(id) ON DELETE SET NULL,
  -- Prevent duplicate memberships
  CONSTRAINT ucm_user_cohort_unique UNIQUE (user_id, cohort_id)
);

-- Helper indexes for performance
CREATE INDEX idx_cohort_flag_assignments_flag
  ON feature_flags.cohort_flag_assignments(flag_name);

CREATE INDEX idx_user_cohort_memberships_user
  ON feature_flags.user_cohort_memberships(user_id);

CREATE INDEX idx_user_cohort_memberships_cohort
  ON feature_flags.user_cohort_memberships(cohort_id);

-- Partial index for non-expired explicit memberships
CREATE INDEX idx_user_cohort_memberships_active
  ON feature_flags.user_cohort_memberships(user_id, cohort_id)
  WHERE expires_at IS NULL OR expires_at > now();

-- Triggers for updated_at
CREATE TRIGGER trg_cohorts_updated_at
  BEFORE UPDATE ON feature_flags.cohorts
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER trg_cohort_flag_assignments_updated_at
  BEFORE UPDATE ON feature_flags.cohort_flag_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER trg_user_cohort_memberships_updated_at
  BEFORE UPDATE ON feature_flags.user_cohort_memberships
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
```

### Data Insertion (Bootstrap Cohorts)

```sql
-- Insert default cohorts on migration
INSERT INTO feature_flags.cohorts (id, name, description, percentage) VALUES
  ('beta_testers', 'Beta Testers', 'Early adopters testing features before release', 20),
  ('enterprise', 'Enterprise', 'Enterprise customers', 100),
  ('internal', 'Internal Team', 'Internal team members (dogfooding)', 100),
  ('mobile_first', 'Mobile-First Users', 'Mobile platform optimizations', 100),
  ('desktop_first', 'Desktop-First Users', 'Desktop/web platform optimizations', 100)
ON CONFLICT DO NOTHING;
```

---

## 3. Migration Strategy: Schema Definition Files + Patch Files

### Philosophy: Schema Files as Source of Truth

**001-004 are schema definition files**, not immutable history:
- They represent the **current desired schema state**
- When you add a table to the schema, you **edit the relevant migration file**
- If database needs reset, running 001-004 creates the final, complete schema
- Keeps migration files minimal and maintainable (less file bloat)

**Patch files** (small, temporary .sql) are created **only when altering a live database**:
- Used to migrate live data between schema versions
- Can be discarded after applied (not part of permanent history)
- Keeps the workflow simple: schema files + minimal patches

### Implementation: Single `005_add_cohorts.sql`

**Naming Convention:** `005_add_cohorts.sql` (combines Phase 1 + Phase 2)

```
supabase/migrations/
├── 001_public_schema.sql          (EVOLVING - users/settings, add new tables here)
├── 002_worlds_schema.sql          (EVOLVING - worlds/members/invites, add new tables here)
├── 003_feature_flags_schema.sql   (EVOLVING - flags/entitlements/overrides, will add cohorts here in Phase 1)
├── 004_audit_schema.sql           (EVOLVING - audit logs)
└── 005_add_cohorts.sql            (NEW - cohorts + flag_assignments + memberships + seed data)
```

### Phase 1 + Phase 2 Combined in Single File

**Create `005_add_cohorts.sql`** with:
- ✅ `cohorts` table (definitions: beta_testers, enterprise, internal, mobile_first, desktop_first)
- ✅ `cohort_flag_assignments` table (flag ↔ cohort mapping)
- ✅ `user_cohort_memberships` table (explicit admin assignments, used in Phase 2+)
- ✅ RLS policies (public read, admin write)
- ✅ Indexes for performance
- ✅ Triggers for updated_at
- ✅ Seed data (5 default cohorts)

**Benefits of this approach:**
✅ Single migration file (simpler, less file bloat)  
✅ Phase 1 + Phase 2 in one place (cohorts are self-contained)  
✅ Can implement Phase 2 without new migrations  
✅ If database resets, 005 creates full cohort schema  
✅ Fewer files to maintain  
✅ Easier to understand (all cohort-related schema in one place)

---

## 4. Edge Functions: What Needs Updating

### Current: `get_feature_flags` (POST)

**Current Behavior:**
- Authenticates via JWT
- Returns: feature_flags + entitlements + overrides (all users' data needed)
- Used by: FeatureFlagsManager.bootstrapFlags()

**Changes Needed for Cohorts:**

```typescript
// PHASE 1: No edge function changes (client-side bucketing only)
// Cohort membership is computed client-side via isUserInCohort()
// Edge function doesn't need to know about cohorts yet

// PHASE 2: Add cohort data to response
interface GetFeatureFlagsResponse {
  flags: FeatureFlagRow[];
  entitlements: EntitlementRow[];
  overrides: OverrideRow[];
  cohorts: CohortRow[];                  // NEW: cohort definitions
  cohort_flag_assignments: CohortFlagAssignmentRow[];  // NEW: flag ↔ cohort map
  user_cohort_memberships?: UserCohortMembershipRow[];  // NEW: explicit memberships (optional)
}

// New queries in edge function:
const cohorts = await fetchCohorts(supabase);  // All cohorts
const assignments = await fetchCohortFlagAssignments(supabase);  // All assignments
const memberships = await fetchUserCohortMemberships(supabase, userId);  // This user only
```

### Proposed New Edge Function: `get_user_cohorts` (POST, Phase 2)

Only needed if Phase 2 adds server-side explicit memberships.

```typescript
// PHASE 2 (Optional): New edge function to check cohort membership
// Used by: FeatureFlagsManager to verify if user is in specific cohort
// (For explicit memberships; deterministic bucketing doesn't need this)

interface GetUserCohortsRequest {
  user_id: uuid;
}

interface GetUserCohortsResponse {
  cohort_ids: string[];  // ["beta_testers", "qa_testers"]
}

// Returns explicit cohort memberships + deterministic bucketing result
// This is a convenience function; Phase 1 doesn't need it
```

### Edge Function Update Priority

| Function | Phase | Change | Priority |
|----------|-------|--------|----------|
| **get_feature_flags** | 1 | ✅ Add `cohorts` + `cohort_flag_assignments` to response | HIGH (Phase 1) |
| **get_user_cohorts** | 2 | ➕ NEW: Return user's explicit memberships | MEDIUM (Phase 2+) |

---

## 5. RLS Policies for Cohorts

### Public Access (Users can view, not modify)

```sql
-- Cohorts: Users can view all cohorts (needed for client-side bucketing)
CREATE POLICY "cohorts_select_public"
  ON feature_flags.cohorts FOR SELECT
  USING (is_active = true);

-- Cohort assignments: Users can view all assignments
CREATE POLICY "cohort_flag_assignments_select_public"
  ON feature_flags.cohort_flag_assignments FOR SELECT
  USING (enabled = true);

-- User memberships: Users can view only their own memberships
CREATE POLICY "user_cohort_memberships_select_self"
  ON feature_flags.user_cohort_memberships FOR SELECT
  USING (user_id = public.get_current_user_id());
```

### Admin Write Access (Phase 2+)

```sql
-- Admins can manage cohorts (CRUD)
CREATE POLICY "cohorts_admin_write"
  ON feature_flags.cohorts FOR ALL
  USING (public.is_admin());

-- Admins can manage assignments (CRUD)
CREATE POLICY "cohort_flag_assignments_admin_write"
  ON feature_flags.cohort_flag_assignments FOR ALL
  USING (public.is_admin());

-- Admins can manage explicit memberships (CRUD)
CREATE POLICY "user_cohort_memberships_admin_write"
  ON feature_flags.user_cohort_memberships FOR ALL
  USING (public.is_admin());
```

---

## 6. Implementation Checklist (Phase 1 + 2 Combined)

### Database Preparation (Single Migration File)

- [ ] Create `supabase/migrations/005_add_cohorts.sql` with:
  - [ ] `cohorts` table (id, name, description, percentage, is_active, metadata, timestamps)
  - [ ] `cohort_flag_assignments` table (flag ↔ cohort mapping)
  - [ ] `user_cohort_memberships` table (explicit admin assignments)
  - [ ] RLS policies (public read, admin write)
  - [ ] Indexes for performance (flag, cohort, user lookups)
  - [ ] Triggers for updated_at
  - [ ] Insert 5 seed cohorts (beta_testers, enterprise, internal, mobile_first, desktop_first)

### Edge Function Updates

- [ ] Update `get_feature_flags` function:
  - [ ] Add `fetchCohorts(supabase)` query
  - [ ] Add `fetchCohortFlagAssignments(supabase)` query
  - [ ] Add `fetchUserCohortMemberships(supabase, userId)` query (Phase 2)
  - [ ] Add cohort data to response
  - [ ] Export new types in `types.ts`

### Live Database Patches (Only if Needed)

- [ ] If live database needs schema adjustment before Phase 1 complete:
  - [ ] Create small `patch_YYYY-MM-DD_cohorts_alter.sql` file
  - [ ] Apply patch to live database
  - [ ] Document patch in PR (temporary file, can be discarded after applied)

---

## 7. Decision Summary

### Cohort Enum Answer

✅ **Use:** `beta_testers`, `enterprise`, `internal`, `mobile_first`, `desktop_first`  
✅ **Add more later** if needed (new product features, new user types)  
✅ **Not hardcoded** - stored in database, can be added dynamically (Phase 2+)

### Schema Location Answer

✅ **Place in: `feature_flags` schema** (not `public` with users)  
✅ **Reason:** Cohorts are feature control constructs, not user identity  
✅ **Three tables:** `cohorts` (definitions), `cohort_flag_assignments` (config), `user_cohort_memberships` (explicit, Phase 2+)

### Migration Strategy Answer

✅ **Use single migration file:** `005_add_cohorts.sql` (Phase 1 + 2 combined)  
✅ **Philosophy:** 001-004 are evolving schema definition files (not immutable)  
✅ **When updating 001-004:** Edit migration file directly to keep schema current  
✅ **Live database patches:** Create temporary patch files only when needed  
✅ **Benefits:** Fewer files, simpler setup, cleaner schema ownership

### Edge Functions Answer

✅ **Phase 1:** Update `get_feature_flags` to include cohort definitions + assignments  
✅ **Phase 2:** (Optional) New `get_user_cohorts` for explicit membership verification  
✅ **No breaking changes** - cohort data is additive to existing response

---

## Next Steps

1. **Approve cohort enum** (beta_testers, enterprise, internal, mobile_first, desktop_first - or modify?)
2. **Approve schema location** (feature_flags schema confirmed?)
3. **Create Phase 1 migration file** (`005_add_cohorts.sql`)
4. **Update Phase 1 issue scope** with migration file details
5. **Proceed with implementation** (Phase 1 client-side bucketing)
