# Copilot instructions for dnd-toolkit

Purpose: Make high-quality, end-to-end edits quickly by following the repo’s real architecture, workflows, and conventions. Keep changes minimal, typed, and consistent with existing patterns.

## Big picture

- App type: React Native + Expo Router (web, iOS, Android). Entry at `index.tsx`; routing/layout in `app/_layout.tsx`.
- Root providers: `AppKernelProvider` → `ThemeProvider` → `ScaleProvider` → `PlatformProvider` → `SubscriptionProvider` → `AppParamsStableProvider` + `AppParamsVolatileProvider` (see `app/_layout.tsx`). Don't move or reorder these casually.
- Kernel flow: `lib/kernel/use-app-kernel.tsx` preloads fonts/images/themes, initializes network, and restores Supabase session where appropriate. UI waits on `kernel.phases.appReady` or specific phase flags.
- Auth: `lib/auth/auth-state.ts` (`AuthStateManager`) provides authentication checks and world access verification. `lib/auth/useAuthGuard.ts` is the primary hook for protecting routes with tiered levels ('account-only', 'world-required'). Supabase is dynamically imported and guarded by `isSupabaseConfigured()` to support GH Pages/no-env scenarios. See `docs/implem guide.md` **Phase 6** for complete auth architecture.
- Navigation: Centralized in `lib/navigation/navigation-config.ts`. Each route's TopBar, back button, params, modals, and redirects are defined declaratively. Use `getRouteConfig(context)` instead of inline switch/case. See `docs/issues/MileStone 1/107 - Updated Nav/NAVIGATION_CONFIG.md`.
- Route params: Expo Router segments (`useSegments()`) + URL params merged into split contexts (`AppParamsStableContext` for userId/connectedWorlds, `AppParamsVolatileContext` for worldId/userRole). Use selector hooks (`useWorldId()`, `useUserId()`, `useConnectedWorlds()`, `useUserRole()`) instead of full context consumers to minimize re-renders.

## UI system

- Components live in `components/ui` and are exported via `components/ui/index.ts` (barrel). Import only from this barrel.
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
- **Auth/Guards**: Use `useAuthGuard(kernel.phases.appReady, level)` in protected `_layout.tsx` files with level='account-only' (needs auth) or 'world-required' (needs auth + world access). Use `AuthStateManager.isAuthenticated()` for runtime checks. See `docs/implem guide.md` Phase 3 for guard patterns.
- **World Access Verification**: `verifyWorldAccessWithDatabase(worldId)` implements cache-first verification (fresh <2h = instant, stale 2-4h = Supabase check). Use `forceVerification: true` option for sensitive pages (settings). See `docs/implem guide.md` Phase 4 for verification flow.
- **Storage**: Use `SecureStorage` from `@/lib/storage` for all persistent app data. All data is encrypted via AES-CTR on all platforms (web, iOS, Android, desktop). Never use direct `localStorage`, `sessionStorage`, or `EncryptedStorage`—always go through `SecureStorage`. Use `STORAGE_KEYS` constants, never hardcode keys. See `docs/issues/MileStone 1/082 - Central Storage/` for API docs and patterns.
- **Query Cache**: Use `QueryCache` from `@/lib/cache` for in-memory caching of API responses. Follow hierarchical key naming (`domain:entity:action:identifier`). Use tags for invalidation. See `docs/issues/MileStone 1/101 - Query Cache/CACHE_STRATEGY.md`.
- **Context Optimization**: Use granular selector hooks (`useWorldId()`, `useUserId()`, etc.) instead of consuming full contexts. This prevents unnecessary re-renders. See `docs/issues/MileStone 1/100 - Context Optimization/USAGE_GUIDE.md`.

## Cache Versioning

- **Version Updates**: Increment `CURRENT_CACHE_VERSION` in `lib/storage/cache-versioning.ts` when making breaking changes to stored data structures
- **Breaking Changes Include**: Schema changes (add/remove/rename fields), stricter validation rules, type changes, new required fields without defaults
- **Non-Breaking**: Optional fields with defaults, performance improvements, bug fixes, cosmetic changes
- **Process**: Update schema validation → update migration function → increment version → test migration
- **Location**: `lib/storage/cache-versioning.ts` (core logic), `docs/issues/MileStone 1/098 - Cache Versioning/CACHE_VERSIONING.md` (docs)

## Logger System

- Use category-based logging: `logger.category('auth').info('message')` or `logger.info('auth', 'message')`
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

- Layout/routing: `app/_layout.tsx`
- **Kernel/Bootstrap**: `lib/kernel/app-kernel.ts` (AppKernel singleton), `lib/kernel/use-app-kernel.tsx` (AppKernelProvider + hooks). See **`lib/kernel/README.md`** for full documentation.
- Splash screen: `hooks/use-splash-screen.tsx`
- **Feature Flags System (Tier 3)**: `lib/feature-flags/` (core system), `supabase/migrations/003_feature_flags_schema.sql` (schema), `supabase/functions/get_feature_flags/` (edge funtion). See **`lib/feature-flags/README.md`** for full architecture and integration guide.
- **Auth system**: `lib/auth/auth-state.ts` (AuthStateManager), `lib/auth/useAuthGuard.ts` (route guards), `lib/auth/useWorldRole.ts` (FUTURE: role checking)
- **Storage**: `lib/storage/SecureStorage.ts` (implementation), `lib/storage/index.ts` (exports + keys)
- **Image optimization**: `components/ui/LazyImage.tsx`, `hooks/use-viewport-tracking.tsx`, `hooks/use-image-cache.tsx`, `lib/utils/image-optimization.ts`. See `docs/issues/MileStone 1/030 - Optimize Image Loading/` for full guide.
- UI barrel: `components/ui/index.ts`
- Theme root: `theme/index.ts` (families, tokens, provider)
- **Navigation**: `lib/navigation/README.md` (central reference), `lib/navigation/navigation-config.ts` (route matching), `lib/navigation/routes/` (app-specific configs by area), `lib/navigation/uri-helpers.ts` (URL building)
- Docs: `docs/COMPONENTS.md`, `docs/SCREENS.md`, `docs/FEATURE_FLAGS.md`, `docs/NOTIFICATIONS_USAGE.md`, **`lib/navigation/README.md`** (route config, TopBar, back button), **`lib/navigation/routes/README.md`** (how to add routes), **`docs/issues/MileStone 1/082 - Central Storage/SECURE_STORAGE.md`**, **`docs/issues/MileStone 1/030 - Optimize Image Loading/IMAGE_OPTIMIZATION_GUIDE.md`**, **`lib/kernel/README.md`** (app bootstrap phases, app readiness gating)

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
