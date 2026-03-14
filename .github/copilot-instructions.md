# Copilot instructions for dnd-toolkit

Purpose: Make high-quality, end-to-end edits quickly by following the repo’s real architecture, workflows, and conventions. Keep changes minimal, typed, and consistent with existing patterns.

## Architecture Overview

Clean 5-layer architecture with strong boundary enforcement:

```
app/ + Screens/             Presentation only (imports hooks + components only, NEVER lib/system)
    ↓
hooks/                      React bridge layer (wraps lib/ for React, handles loading/errors for display)
    ↓
lib/                        Orchestration + domain logic (managers, operations, repos)
    ↓
system/                     Foundation layer (portable, reusable infrastructure: API, Storage, Network, Jobs, Kernel)
    ↓
External packages           Third-party dependencies (React, Expo, Supabase, etc.)
```

**Golden Rule:** Components can ONLY import from hooks and components. Never directly from lib/ or system/.

**Dependency Flow:**
- Screens/apps → hooks only
- Hooks → lib/ + providers + contexts
- lib/ → system/ + validation/ + type-definitions/ + maps/ + config/ + pure-algo-immutables/
- system/ → external packages only (no lib/ or hooks/)
- validation/, type-definitions/, maps/, pure-algo-immutables/ are importable everywhere

## Big picture

- App type: React Native + Expo Router (web, iOS, Android). Entry at `index.tsx`; routing/layout in `app/_layout.tsx`.
- Root providers: `AppKernelProvider` → `ThemeProvider` → `ScaleProvider` → `PlatformProvider` → `SubscriptionProvider` → `AppParamsStableProvider` + `AppParamsVolatileProvider` (see `app/_layout.tsx`). Don't move or reorder these casually.
- Kernel flow: `lib/kernel/use-app-kernel.tsx` preloads fonts/images/themes, initializes network, and restores Supabase session where appropriate. UI waits on `kernel.phases.appReady` or specific phase flags.
- Auth: `lib/auth/auth-manager.ts` provides the domain wrapper; `lib/auth/auth-state.ts` (`AuthStateManager`) handles authentication checks and world access verification. `lib/auth/useAuthGuard.ts` is the primary hook for protecting routes with tiered levels ('account-only', 'world-required'). Supabase is dynamically imported and guarded by `isSupabaseConfigured()` to support GH Pages/no-env scenarios.
- Navigation: Centralized in `lib/navigation/navigation-config.ts`. Each route's TopBar, back button, params, modals, and redirects are defined declaratively. Use `getRouteConfig(context)` instead of inline switch/case.
- Route params: Expo Router segments (`useSegments()`) + URL params merged into split contexts (`AppParamsStableContext` for userId/connectedWorlds, `AppParamsVolatileContext` for worldId/userRole). Use selector hooks (`useWorldId()`, `useUserId()`, `useConnectedWorlds()`, `useUserRole()`) instead of full context consumers to minimize re-renders.

## Data Organization

Root-level directories organize cross-cutting concerns and foundation layer:

**Foundation Layer (Portable Infrastructure):**
- **`/system`** — Foundation infrastructure (API/, Storage/, Network/, Jobs/, Kernel/, Services/). App-agnostic, ideally portable to other projects. Contains no orchestration or domain logic.

**Reusable Utilities & Types (Importable Everywhere):**
- **`/maps`** — Static mappings and reference data (error code lookups, cache key registries, storage key constants, HTTP status mappers, event-to-consent mappings). Used by lib modules for data transformation & classification.
- **`/type-definitions`** — Shared type definitions for global systems (job queue types, mutation types, breadcrumb types, data classification enums). Avoids circular dependencies by centralizing types.
- **`/validation`** — Independent schemas and validators (auth schemas, world schemas, email validators). No orchestration logic; pure data validation.
- **`/pure-algo-immutables`** — Pure algorithms and rarely-changing implementations (redaction-manager, rollout logic, app-error types, backoff). Isolated to keep `lib/[module]` clean.

**Configuration:**
- **`/config`** — App configuration (appsettings.dev.json, appsettings.json, storage-backends-config.ts, etc.). Read by kernel/managers during bootstrap. Environment-specific feature flags, logger categories, runtime options.

## Managers & Middleware Pattern

**Every major lib module has this 4-layer structure:**

```
hooks/
    ↓
lib/[domain]-manager.ts (ORCHESTRATION HUB: validation + hooks + coordination + system delegation)
    ↓
lib/[domain]/[operation]-system.ts (DOMAIN SYSTEMS: business logic + owns middleware calls)
    ↓
lib/middleware/services/*.ts (MIDDLEWARE: network checks, normalization, provider calls)
    ↓
system/* (PURE TRANSPORT: storage, API, network, jobs — portable infrastructure)
```

### Layer Responsibilities

**1. hooks/ (React integration)**
- React lifecycle bridge
- Call manager functions
- Handle loading/error states for UI display
- Example: `hooks/auth/useSignOut.ts` calls `AuthManager.signOut()`

**2. lib/[domain]-manager.ts (Orchestration Hub)**
- **Validation** — Check data format + security (password strength, email validity, detect malicious input)
- **Pre-operation hooks** — Call registered listeners before operation
- **Delegation** — Pass control to domain-specific system (NOT direct middleware calls)
- **Post-operation hooks** — Feed results to listeners  
- **Distribute results** — Send data to proper lib files/consumers
- **Return to caller** — Final result back to hooks

**3. lib/[domain]/[operation]-system.ts (Domain Systems)**
- **Business logic** — Domain-specific orchestration (e.g., which phases to run, what cleanup to do)
- **Own middleware calls** — This system calls its required middleware functions directly
- **Hook registry** — Manages hooks for its operation (e.g., SignOutHook for sign-out-system)
- **Error handling** — Collects errors per-phase and continues (non-fatal errors)
- **Return structured result** — Returns typed result with success/errors/metadata

Example: `lib/auth/account/sign-out-system.ts`
```typescript
import { authSignOut } from '@/lib/middleware/services';
import { AuthStateManager } from '@/lib/auth/auth-state';
import { QueryCache } from '@/system/storage/cache';

export async function performSignOut(source: SignOutSource): Promise<SignOutResult> {
  const result = { success: true, clearedKeys: [], errors: [], durationMs: 0 };

  // Phase 1: before-auth (e.g., drain offline queue)
  await executePhase('before-auth', result);

  // Phase 2: auth (THIS SYSTEM CALLS MIDDLEWARE)
  try {
    await authSignOut();  // ← System owns this call
    await AuthStateManager.clearAuthState();  // ← System owns this call
    await QueryCache.clearAll();  // ← System owns this call
  } catch (error) {
    result.success = false;
    result.errors.push({ phase: 'auth', error });
  }

  // Phase 3: after-auth (UI cleanup, notifications)
  await executePhase('after-auth', result);

  return result;
}
```

**4. lib/middleware/services/*.ts (Middleware)**
- **Network readiness** — Check if system is ready (network online, provider initialized)
- **Data normalization** — Transform validated data to system format
- **Logging/tracing** — Record request details
- **Call system** — Delegate to `system/` layer
- **Error handling** — Catch system errors and provide meaningful feedback

**5. system/* (Pure Transport)**
- No validation (manager + system handled it)
- No normalization (middleware handled it)
- Pure HTTP/storage transport — retries, caching, deduplication, rate limiting, circuit breaker
- Expects clean, validated, normalized data

### Data Flow Example

```typescript
// 1. Hook calls manager with validated input
const result = await AuthManager.signOut('user-initiated');

// 2. Manager validates source parameter
//    - Is source one of: 'user-initiated' | 'auth-state-change'?

// 3. Manager calls pre-operation hooks
//    await AuthStateManager.beforeSignOut?.();

// 4. Manager delegates to system (NOT calling middleware directly)
//    const { performSignOut } = await import('./account/sign-out-system');
//    const result = await performSignOut(source);
//    ↓↓↓ System now controls the flow ↓↓↓

// 5. System executes phases:
//    Phase 1 (before-auth): Run offline-queue drain, stop background jobs
//    Phase 2 (auth): THIS SYSTEM CALLS MIDDLEWARE
//      - authSignOut() — sign out from auth provider
//      - AuthStateManager.clearAuthState() — clear local auth state
//      - QueryCache.clearAll() — clear cached queries
//    Phase 3 (after-auth): Reset UI state, notify listeners

// 6. System returns structured result
//    { success: true, clearedKeys: [...], errors: [], durationMs: 182 }

// 7. Manager receives result and calls post-operation hooks
//    await AuthStateManager.afterSignOut?.(result);

// 8. Manager distributes results (if any to other lib modules)
//    // (in this case, result goes straight back)

// 9. Manager returns final result to hook
//    return result;

// 10. Hook handles UI display
//     if (result.success) { navigate to login }
//     else { show error toast }
```

### Why This Pattern?

- **Separation of concerns** — Each layer has one clear job
- **Testability** — Mock system layer independently from manager
- **Reusability** — Systems are self-contained and can be isolated/tested without manager
- **Modularity** — Systems can potentially be used in other contexts (e.g., `sign-out-system` is not auth-manager-dependent)
- **Maintainability** — A bug is isolated to its layer
- **Scalability** — Easy to add new systems (sign-in-system, delete-account-system) without touching manager's core logic
- **Security** — Validation happens in manager, but systems own their middleware calls for transparency

### Manager Responsibilities Summary

1. ✅ Validate input data (format + security)
2. ✅ Call pre-operation hooks
3. ✅ Delegate to domain-specific system (passing validated data)
4. ✅ Call post-operation hooks
5. ✅ Distribute results (if needed to other lib modules)
6. ✅ Return final result to caller

### System Responsibilities Summary

1. ✅ Execute domain-specific business logic
2. ✅ Call own middleware functions (this system owns those calls)
3. ✅ Manage hook registry for this operation
4. ✅ Handle errors gracefully (collect errors, continue)
5. ✅ Return typed, structured result

## Boundary Layer Enforcement

**CRITICAL:** The component → hook boundary is strictly enforced to prevent architectural creep.

- **Screens/components** import from: `hooks/`, `components/`, `@/providers`, `@/theme`, `@/config` (types only)
- **hooks/** import from: `lib/`, `@/contexts`, `@/theme`, `@/config`, `@/type-definitions`
- **lib/** imports from: `system/`, `@/validation`, `@/type-definitions`, `@/maps`, `@/config`, `@/pure-algo-immutables`
- **system/** imports from: external packages only (no lib/ or hooks/)
- **Components that violate this rule:**
  - ✅ `ErrorBoundary.tsx` — Exception: class component, cannot use hooks; lib imports are necessary
  - ✅ `VersionDisplay.tsx` — Exception: simple constant read, no logic

**Run ESLint to detect violations:** `npm run lint` will flag any cross-layer imports.

## UI system

- Components live in `components/ui` and are exported via `components/ui/index.ts` (barrel). Import only from this barrel.
- Components NEVER import from `lib/` or `system/` — always use hooks as intermediaries.
- Theming/sizing: use `UseTheme()` and `useScale()`. Resolve tokens with `$()` (CSS vars on web, concrete values on native). Tokens and themes live in `theme/` (`theme/tokens.ts`, families, `theme/ThemeProvider.tsx`).
- Animations: `react-native-reanimated` (v4.x). Haptics via `expo-haptics` in interactive components.
- Notifications: The queue/provider is currently disabled in runtime. Prefer `AppToast` or `Snackbar` for transient feedback. Avoid reintroducing full-screen overlays that intercept pointer events on web.

## Project workflows

- Dev server: `npm run start` (Expo CLI). Platform shorthands: `npm run web|ios|android`.
- Linting: `npm run lint` (eslint-config-expo). Keep TypeScript strict.
- Web export: `npm run predeploy` (Expo export → `dist`), then `npm run deploy` (gh-pages). A `deploy-dev` branch exists for previews.
- Reset: `npm run reset-project` runs `scripts/reset-project.js` (use sparingly).
- Commits: Never commit unless the user explicitly requests it.

## Screen/routing conventions

- Add screens under `app/` using Expo Router. Layouts live in directory-level `_layout.tsx` files.
- **Route Authentication**: Routes are protected/public via `lib/routing/AUTH_CONFIG`. See `lib/routing/README.md` for which routes require authentication. Use `lib/auth/useAuthGuard` in `_layout.tsx` to enforce protection.
- **Route Navigation Config**: Routes are defined in `lib/navigation/navigation-config.ts` with TopBar title, back behavior, params, modals, redirects. When adding a route, add one config entry—no need to modify layouts.
- Legacy TopBar logic: `app/_layout.tsx` still has inline switch/case; migration to use config pending (see follow-up issue).
- URL params (e.g., `worldId`, `userRole`) are read via `useLocalSearchParams()` and merged into `AppParamsContext`. Don’t pass these deep as props; use the context.

## Data and services

- Supabase client/config under `lib/database/`. Always guard usage with `isSupabaseConfigured()` and prefer dynamic imports to avoid circular deps and to keep web fallback working.
- **Auth**: Call `lib/auth/auth-manager.ts` (not direct operations). Use `useAuthGuard(kernel.phases.appReady, level)` in protected layouts with level='account-only' (needs auth) or 'world-required' (needs auth + world access).
- **Database**: Call `lib/database/database-manager.ts` for coordinated database operations. Direct repository calls for low-level queries.
- **Analytics**: Call `lib/analytics/analytics-manager.ts` for event dispatch and tracking (respects consent via middleware).
- **Error Tracking**: Call `lib/error/error-manager.ts` for reporting errors (respects consent via middleware).
- **World Access Verification**: Use `verifyWorldAccessWithDatabase(worldId)` which implements cache-first verification (fresh <2h = instant, stale 2-4h = Supabase check). Use `forceVerification: true` option for sensitive pages (settings).
- **Storage**: Use `SecureStorage` from `@/system/storage/cache/` for all persistent app data. All data is encrypted via AES-CTR on all platforms (web, iOS, Android, desktop). Never use direct `localStorage`, `sessionStorage`, or `EncryptedStorage`—always go through `SecureStorage`. Use `STORAGE_KEYS` constants from `/maps/storage-keys.ts`, never hardcode keys.
- **Query Cache**: Use `QueryCache` from `@/system/storage/cache/` for in-memory caching of API responses. Follow hierarchical key naming (`domain:entity:action:identifier`). Use tags for invalidation. Cache keys are in `/maps/cache-keys.ts`.
- **Context Optimization**: Use granular selector hooks (`useWorldId()`, `useUserId()`, etc.) instead of consuming full contexts. This prevents unnecessary re-renders.

## Cache Versioning

- **Version Updates**: Increment `CURRENT_CACHE_VERSION` in `@/system/storage/cache/cache-versioning.ts` when making breaking changes to stored data structures
- **Breaking Changes Include**: Schema changes (add/remove/rename fields), stricter validation rules, type changes, new required fields without defaults
- **Non-Breaking**: Optional fields with defaults, performance improvements, bug fixes, cosmetic changes
- **Process**: Update schema validation → update migration function → increment version → test migration
- **Location**: `@/system/storage/cache/cache-versioning.ts` (core logic), `docs/issues/MileStone 1/098 - Cache Versioning/CACHE_VERSIONING.md` (docs)

## Logger System

- Use category-based logging: `logger.category('auth').info('message')` (avoid the legacy `logger.info('auth', ...)` form)
- Categories: `auth`, `navigation`, `api`, `performance`, `storage`, `ui`, `analytics`, `security`, `bootstrap`, `error`, `other`
- Configure categories in `config/appsettings.*.json` under `featureFlags.loggerCategories`
- See `docs/issues/MileStone 1/108 - Improve Logger System with Categories and Filtering/LOGGER_SYSTEM.md`

## Patterns and examples

- Import UI components:
  ```ts
  import {
    Button,
    Card,
    TextInput,
    AppModal,
    Snackbar,
    AppToast,
  } from "@/components/ui";
  ```
- Apply themed backgrounds: `contentStyle: { backgroundColor: '$background' }` (as used in `app/_layout.tsx`).
- Prefer design tokens (colors, radius, spacing) over hard-coded values; escalate via theme tokens or `ElevatedView` variants.
- Typography/components: Use `Body`, `Title`, `Subtitle` heading components; do not use `AppText`.
- For layout, use the provided view components (not `ViewCust`), and only use raw `View` as a simple container when necessary.

## Gotchas

- RN Web pointerEvents: avoid full-screen wrappers that block clicks; if needed, set pointer events via style and keep overlays minimal.
- Fonts on web: non-critical fonts are loaded in bootstrap; Eurostile/Cyberpunk is on-demand to avoid decode warnings.
- Notifications flicker: do not mount the old notification provider/container; use `AppToast`/`Snackbar` until the system is redesigned.

## Database & Schema Conventions

**Data Migrations Philosophy:**
- Migration files **001-004** are **evolving schema definition files**, NOT immutable history
- They represent the **current desired schema state**; when adding a table, edit the relevant migration file directly
- **Patch files** (e.g., `patch_YYYY-MM-DD_cohorts.sql`) are created **only when altering a live database** before schema changes are finalized
- Patch files can be discarded after applied; they don't become part of permanent history
- If database needs reset, running 001-004 creates the final, complete schema

**Database Organization:**
- Schemas: `public` (users), `worlds` (worlds/members), `feature_flags` (all flag-related), `audit` (audit logs)
- **All database calls must be centralized in `lib/database/`** — never scatter queries in components, hooks, or other lib folders
- Database files follow pattern: `lib/database/[entity].ts` (e.g., `users.ts`, `feature-flags.ts`, `worlds.ts`)
- Each database module exports: typed queries, types for rows, helper functions, error handling

**Audit System (004_audit_schema.sql):**
- All tables automatically capture changes via `audit.log_change()` trigger function
- Tracks: `old_data`, `new_data` (JSONB snapshots), `initiated_by` (user), `created_at` (timestamp)
- RLS policies allow admins to see all audit events; users see only their own changes
- No need to manually log database changes—triggers handle it automatically

## Feature Flags System (Tier 3)

**System Architecture:**
- Config-based flags: `config/appsettings.*.json` (flags, cohorts, conditions, overrides)
- Database-backed: `supabase/migrations/003_feature_flags_schema.sql` (feature_flags, entitlements, overrides)
- Cohorts (named user groups): `supabase/migrations/005_add_cohorts.sql` (cohorts, cohort_flag_assignments, user_cohort_memberships)
- Remote sync: `lib/feature-flags/` provides `FeatureFlagsManager` that syncs with edge function
- Edge function: `supabase/functions/get_feature_flags/` returns all flags, cohorts, conditions, and user-specific data

**How Features Integrate (AND logic):**
- **A/B Testing (#058)**: Percentage-based rollout (10%, 50%, 100%) using deterministic hashing via `isInRollout(userId, flagName, percentage)`
- **Conditions (#198)**: Rules that must match (platform=web, environment=production, etc.)
- **Cohorts (#196)**: Named user groups (beta_testers, enterprise, internal, mobile_first, desktop_first)
- **Overrides (#057)**: Per-user flag values override global settings
- **Combined evaluation**: `enabled AND (condition checks) AND (cohort check) AND NOT overridden`
  - Example: Enable "advancedMaps" for 20% of beta_testers on web platform only
  - Config: `{ enabled: true, cohorts: ['beta_testers'], percentage: 20, conditions: { platform: 'web' } }`

**Cohort Semantics (use when you need semantic user groups):**
- `beta_testers` (20%): Early adopters, semi-controlled pre-release rollout
- `enterprise` (100%): Enterprise tier features
- `internal` (100%): Internal team dogfooding, internal-only tools
- `mobile_first` (100%): Mobile platform-optimized features
- `desktop_first` (100%): Desktop/web platform-optimized features
- **When to use cohorts**: Named, intentional user groups; when you need to know which users are in a cohort
- **When to use percentage rollouts**: Unnamed, mathematical distributions; canary releases (1% → 10% → 50% → 100%)
- **When to use conditions**: Rules based on context (platform, environment, subscription level)

**Client-Side vs Server-Side:**
- **Phase 1 (client-side)**: Config-based cohorts, deterministic bucketing via `isUserInCohort()`, no database needed for membership
- **Phase 2 (server-side)**: Database-backed cohorts, explicit admin assignments via `user_cohort_memberships` table
- App can use THREE sources of membership (in priority order):
  1. Explicit membership from `user_cohort_memberships` (admin override)
  2. Deterministic bucketing (hash-based, no DB needed)
  3. No membership (fallback)

**Usage Patterns:**
```typescript
// Simple percentage rollout (A/B testing)
const { isEnabled } = useFeatureFlags();
if (isEnabled('advancedMaps')) { /* show feature */ }

// With user ID (checks cohorts)
const { isEnabledForUser } = useFeatureFlags();
if (isEnabledForUser('advancedMaps', userId)) { /* show feature */ }

// With conditions (platform, environment, etc.)
const { isEnabledWithContext } = useFeatureFlags();
if (isEnabledWithContext('advancedMaps', { platform: 'web' })) { /* show feature */ }

// All together: cohorts + conditions + percentage
// Config: { enabled: true, cohorts: ['beta_testers'], percentage: 20, conditions: { platform: 'web' } }
if (isEnabledWithContext('advancedMaps', userId, { platform: 'web' })) { /* beta testers on web only */ }
```

## Pre-Release Development Guideline

⚠️ **DO NOT BUILD FOR BACKWARDS COMPATIBILITY**

We are nowhere near release. Building backwards compatibility now adds:
- Unnecessary code complexity (migrations, version checks, data transformations)
- Technical debt (we'll change designs multiple times before release)
- Longer iteration cycles (more careful about breaking changes)
- Wasted effort (pre-release designs often change entirely)

**Default approach:**
- ✅ Make breaking changes freely (schema changes, API renames, file restructuring)
- ✅ Delete old code and patterns; don't keep "for backwards compat"
- ✅ Refactor aggressively; don't worry about existing deployments
- ❌ Do NOT create migration systems or version checks unless absolutely required
- ❌ Do NOT keep deprecated functions "for compatibility"
- ❌ Do NOT design for forwards/backwards compatibility

**When breaking changes are needed:**
1. Update all code that uses the old pattern (don't leave stubs)
2. Delete the old code entirely
3. Only upgrade tests and docs
4. No migration logic needed

**Exception: Schema migrations**
- Once data goes to live Supabase (if using it), follow schema evolution patterns (001-004 edit philosophy)
- This is about data safety, not backwards API compatibility

## Where to look

**Component/Hook/Screen Navigation:**
- **Screens/components**: `Screens/`, `app/`, `components/` — Import from hooks only
- **Hooks**: `hooks/` — Organized by domain (auth/, navigation/, storage/, etc.)
- **Context providers**: `providers/` — Root-level React context

**Domain Logic (lib/):**
- **Managers** (domain wrappers): `lib/[domain]-manager.ts` (auth-manager, analytics-manager, error-manager, database-manager, etc.)
- **Auth system**: `lib/auth/auth-manager.ts` (manager), `lib/auth/auth-state.ts` (AuthStateManager)
- **Database**: `lib/database/database-manager.ts` (manager), `lib/database/repositories/` (direct queries)
- **Kernel/Bootstrap**: `lib/kernel/app-kernel.ts` (bootstrap logic). See **`hooks/kernel/useAppKernel.ts`** for hook.
- **Feature Flags**: `lib/feature-flags/` (core system), `/config/appsettings.*.json` (config)
- **Navigation**: `lib/navigation/navigation-config.ts` (route config)

**Foundation Layer (system/):**
- **Storage**: `system/storage/cache/` (SecureStorage, FastCache, QueryCache), `system/storage/buckets/` (cloud)
- **Network**: `system/network/` (detection, state machine, configuration)
- **Error**: `system/error/` (error types, safe mode)
- **API**: `system/API/` (request management, circuit breaker)
- **Jobs**: `system/jobs/` (queue, backoff algorithms)
- **Services**: `system/services/` (Supabase, Sentry adapters)
- **Kernel**: `system/kernel/` (bootstrap utilities)

**Root-Level Utilities (Importable Everywhere):**
- **Data Organization**: `/maps/` (static references), `/type-definitions/` (shared types), `/validation/` (schemas), `/pure-algo-immutables/` (algorithms)
- **Configuration**: `/config/appsettings.*.json` (feature flags, logger categories, runtime options)
- **UI barrel**: `components/ui/index.ts`
- **Theme root**: `theme/index.ts`

## Documentation Rule

**AVOID MAKING PHASE COMPLETION DOCS** UNLESS ABSOLUTELY NECESSARY.\*\* Most documentation should go into module READMEs, issue docs, or suggestion files as outlined below. Only create milestone completion docs when a feature is large/complex enough to warrant end-to-end explanation beyond module-level docs. Phase completion docs tend to become outdated and are hard to maintain. (and waste tokens) Phase completion docs should only be created when:

- The feature spans multiple modules and requires cross-module explanation
- There are complex architectural decisions that need to be documented in one place
- There is significant usage guidance that cannot be captured in module READMEs or issue docs

### For New lib/\* Enhancements

**Every new enhancement (anything added to `lib/`) must include:**

1. **Module README** – Create or update `lib/[module]/README.md` with:
   - "When to Use This Module" section (suitable vs. unsuitable use cases)
   - Architecture & Data Flow (brief description or diagram)
   - API Reference (all exports with type signatures and code examples)
   - Dependencies (external packages + internal lib dependencies)
   - Error Handling & Edge Cases (known limitations, error patterns)
   - Performance Notes (caching, overhead, optimization tradeoffs)
   - Related Modules (links to connected lib/\* modules)
   - File Breakdown (what each file does in a table)
   - Testing section (link to test guide if exists, or manual testing tips)
   - Future Enhancements (planned improvements or tech debt)
   - **Must be app-agnostic** – no app-specific language; readable by developers using this in future projects

2. **Detailed Issue Docs** – Create docs in `docs/issues/MileStone X/NNN - Feature Name/` folder:
   - Include 1-2 docs max: one for "How to use" (with examples), one for architecture/implementation if complex
   - Focus on feature functionality and usage, not implementation history or design decisions
   - Include code examples, API reference, troubleshooting, and best practices
   - Check folder structure for highest label Milestone and create subfolder if needed

3. **Suggestions/Improvements** – Create files in `docs/suggestions/` for identified improvements:
   - Each suggestion is formatted as a GitHub issue (Issue Type, Problem, Solution, Scope, Acceptance Criteria, Notes)
   - Scope should be meaningful (not one-line fixes); can combine or separate based on complexity
   - One suggestion per file or group related suggestions in one file (use judgment)
   - Helps surface future work and documents architectural thinking

### For Test Documentation

- When adding or changing public hooks, API behaviors, or storage/cache schemas, add or update a corresponding test guide under `docs/A Testing Guide`.
- Follow the repository test-case template (H1 title, `##` sections, and `###` test cases with checkboxes, screenshots, and console-log capture).
- If a feature needs scripts for validation, include a "Scripts" section describing passing/failing scripts and admin execution constraints (Supabase flag). Do not commit runnable or destructive scripts without review.
- Also create/update `docs/A Testing Guide/MAINTAINING_TEST_GUIDES.md` with environment and reporting notes.

This file exists to make the testing guidance discoverable until `.github/copilot-instructions.md` can be updated directly.

## Milestone Overview

For comprehensive overviews of implementation tiers, see:
- `docs/issues/MileStone 2/Tier 1/` — Core Foundation (job queues, safe mode, privacy policies)
- `docs/issues/MileStone 2/Tier 2/` — API & Network Layer (auth, interceptors, circuit breakers, offline queues)
- `docs/issues/MileStone 2/Tier 3/TIER_3_OVERVIEW.md` — Feature Control & Configuration (feature flags, conditions, cohorts, A/B testing, config management)

Each tier's README files document architecture, integration points, and key design decisions.
