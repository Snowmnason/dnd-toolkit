# Remaining Codebase Updates

## Status Summary

### ✅ COMPLETED

**Phases 1-3 (Pre-session):**

- [x] lib/database/worlds.ts - Schema prefixes (`worlds.worlds`, `worlds.world_access`)
- [x] lib/database/entitlements.ts - Schema prefix + `is_active`/`remind_user` columns
- [x] lib/database/feature-flags.ts - JSDoc schema clarification
- [x] lib/database/feature-flag-overrides.ts - JSDoc + synthetic field documentation
- [x] lib/database/index.ts - New exports (`EntitlementOverrideRow`, `fetchEntitlementOverridesByUserId`)
- [x] lib/database/README.md - 4-schema architecture documentation

**Phase A (Session):**

- [x] lib/database/users.ts - All `isAdmin` → `is_admin` conversions (5 changes)

**Phase B (Session):**

- [x] supabase/functions/get_feature_flags/queries.txt - Schema prefixes (5 changes)
- [x] supabase/functions/delete-account/index.txt - Schema prefix (1 change)
- [x] supabase/functions/invite-link-cleanup/index.txt - Verified already correct (raw SQL)

**Phase C (Session):**

- [x] lib/api/types-inference-guide.ts - Zod schema + comment (2 changes)
- [x] lib/api/clients/users.ts - User interface (1 change)
- [x] app/settings/admin-panel.tsx - Admin check (1 change)

**Phase D (Session):**

- [x] lib/database/users.ts - Schema prefixes (3 changes: lines 59, 182, 278)
- [x] lib/storage/update-storage-cache.ts - Schema prefix (1 change: line 136)
- [x] lib/database/common.ts - Schema prefixes (2 changes: lines 83, 203)
- [x] providers/auth-provider.tsx - Schema prefix (1 change: line 107) → **REMOVED** (dead code)
- [x] lib/database/invites.ts - Schema prefixes (4 changes: lines 56, 103, 173, 208)
- [x] lib/database/feature-flags.ts - Schema prefix (1 change: line 45)
- [x] lib/database/feature-flag-overrides.ts - Schema prefix (1 change: line 78)
- [x] lib/auth/auth-state.ts - Schema prefix (1 change: line 481)

**Bonus Refactor (Session):**

- [x] Removed `providers/auth-provider.tsx` - Dead code, never used in app
- [x] Removed `components/built-in/splash-screen-controller.tsx` - Dead code
- [x] Removed `hooks/auth/use-auth-context.tsx` - Dead code
- [x] Updated `hooks/auth/index.ts` - Removed dead exports
- [x] Updated `providers/README.md` - Removed AuthProvider docs
- [x] Updated `hooks/README.md` - Removed useAuthContext reference
- [x] Documentation: `docs/issues/MileStone 2/Tier 3/197 - Config Versioning/auth-provider-removal.md`

### 🔶 IN PROGRESS

None currently

### ❌ TO DO

#### Phase D: Scan for Remaining Direct Queries

**Impact**: Breaking - queries need explicit schema prefixes  
**Files**: 8  
**Estimated Changes**: 14 locations

- [x] lib/database/users.ts - 3 schema prefixes added
- [x] lib/storage/update-storage-cache.ts - 1 schema prefix added
- [x] lib/database/common.ts - 2 schema prefixes added
- [x] providers/auth-provider.tsx - 1 schema prefix added
- [x] lib/database/invites.ts - 4 schema prefixes added
- [x] lib/database/feature-flags.ts - 1 schema prefix added
- [x] lib/database/feature-flag-overrides.ts - 1 schema prefix added
- [x] lib/auth/auth-state.ts - 1 schema prefix added

#### Phase E: NEW Features (FUTURE - Out of Scope for Migration)

**Impact**: Additive only - not required for migration  
**Files**: New files to create  
**Issue Tracker:** `docs/suggestions/entitlements-cleanup-job.md`

- [ ] lib/jobs/entitlements-cleanup.ts - Background job to mark expired entitlements inactive
- [ ] components/modals/EntitlementExpiredModal.tsx - User-facing expiry reminder
- [ ] supabase/functions/entitlements-cleanup/index.ts - Edge Function for cron trigger
- [ ] Add cron job configuration for entitlements cleanup
- [ ] Analytics tracking for entitlement renewal decisions

See full proposal: [`docs/suggestions/entitlements-cleanup-job.md`](../../suggestions/entitlements-cleanup-job.md)

---

## Recommended Execution Order

### Today (Migration Critical Path):

4. ✅ **Phase D: Final Scan** - Catch any stragglers (14 schema prefixes across 8 files)
1. ✅ **Phase A: Users Table** - Fix `isAdmin` → `is_admin`
1. ✅ **Phase B: Edge Functions** - Add schema prefixes
1. ✅ **Phase C: Auth/Providers** - Update user interfaces (lib/api/\*, admin-panel)
1. ⏳ **Phase D: Final Scan** - Catch any stragglers

### Future (Additive Features):

5. ⏳ **Phase E: Jobs & UI** - Entitlements lifecycle management

---

## Validation After Each Phase

### Phase A Validation

```bash
# TypeScript compilation should pass
npm run build

# Search for any remaining isAdmin references
grep -r "isAdmin" lib/ providers/ --exclude-dir=node_modules
```

### Phase B Validation

```bash
# Edge functions should deploy without errors
cd supabase/functions
deno check **/*.ts
```

### Phase C Validation

```bash
# No TypeScript errors
npm run build

# Test auth flow (login/signup)
npm run test:auth
```

### Phase D Validation

```bash
# Search for unqualified table references
grep -rE '\.from\(["\']worlds["\']\)' lib/ app/ --exclude-dir=node_modules
grep -rE '\.from\(["\']entitlements["\']\)' lib/ app/ --exclude-dir=node_modules
```

---

## Risk Assessment

| Phase | Risk Level | Rollback Difficulty | Impact Scope      |
| ----- | ---------- | ------------------- | ----------------- |
| A     | 🔴 HIGH    | Easy                | All user queries  |
| B     | 🔴 HIGH    | Easy                | Edge functions    |
| C     | 🟡 MEDIUM  | Easy                | Auth layer        |
| D     | 🟢 LOW     | Easy                | Isolated queries  |
| E     | 🟢 LOW     | N/A (new features)  | Optional features |

---

## Current Status: Phases A-D Complete! 🎉

**All codebase updates synchronized with migrations 001-004.**

**Total Changes This Session:**

- **Phase A**: 5 changes (isAdmin rename in lib/database/users.ts)
- **Phase B**: 6 changes (schema prefixes in 2 Edge Functions)
- **Phase C**: 4 changes (isAdmin rename in lib/api/\* + admin-panel)
- **Phase D**: 14 changes (schema prefixes across 8 files)
- **Bonus Cleanup**: Removed 3 dead code files (~200 lines)
- **Grand Total**: 29 code changes + dead code removal across 17 files

**Next Step:** Validate SQL migrations in Supabase (run migrations 001-004, test RLS policies, verify triggers)
