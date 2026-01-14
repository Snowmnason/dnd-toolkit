# Copilot instructions for dnd-toolkit

Purpose: Make high-quality, end-to-end edits quickly by following the repo’s real architecture, workflows, and conventions. Keep changes minimal, typed, and consistent with existing patterns.

## Big picture
- App type: React Native + Expo Router (web, iOS, Android). Entry at `index.tsx`; routing/layout in `app/_layout.tsx`.
- Root providers: `ThemeProvider` → `ScaleProvider` → `PlatformProvider` → `AppParamsProvider` (see `app/_layout.tsx`). Don’t move or reorder these casually.
- Bootstrap flow: `hooks/use-app-bootstrap.tsx` preloads fonts/images/themes and restores Supabase session. UI waits on `bootstrap.isReady`.
- Auth: `lib/auth/auth-state.ts` (`AuthStateManager`) provides authentication checks and world access verification. `lib/auth/useAuthGuard.ts` is the primary hook for protecting routes with tiered levels ('account-only', 'world-required'). Supabase is dynamically imported and guarded by `isSupabaseConfigured()` to support GH Pages/no-env scenarios. See `docs/implem guide.md` **Phase 6** for complete auth architecture.
- Navigation: Centralized in `lib/navigation/navigation-config.ts`. Each route's TopBar, back button, params, modals, and redirects are defined declaratively. Use `getRouteConfig(context)` instead of inline switch/case. See `docs\issues\MileStone 1\024 - Navigation\NAVIGATION_CONFIG.md`.
- Route params: Expo Router segments (`useSegments()`) + URL params merged into `AppParamsContext` (worldId/userRole).

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
- Navigation config: Routes are defined in `lib/navigation/navigation-config.ts` with TopBar title, back behavior, params, modals, redirects. When adding a route, add one config entry—no need to modify layouts.
- Legacy TopBar logic: `app/_layout.tsx` still has inline switch/case; migration to use config pending (see follow-up issue).
- URL params (e.g., `worldId`, `userRole`) are read via `useLocalSearchParams()` and merged into `AppParamsContext`. Don’t pass these deep as props; use the context.

## Data and services
- Supabase client/config under `lib/database/`. Always guard usage with `isSupabaseConfigured()` and prefer dynamic imports to avoid circular deps and to keep web fallback working.
- **Auth/Guards**: Use `useAuthGuard(bootstrapReady, level)` in protected `_layout.tsx` files with level='account-only' (needs auth) or 'world-required' (needs auth + world access). Use `AuthStateManager.isAuthenticated()` for runtime checks. See `docs/implem guide.md` Phase 3 for guard patterns.
- **World Access Verification**: `verifyWorldAccessWithDatabase(worldId)` implements cache-first verification (fresh <2h = instant, stale 2-4h = Supabase check). Use `forceVerification: true` option for sensitive pages (settings). See `docs/implem guide.md` Phase 4 for verification flow.
- **Storage**: Use `SecureStorage` from `@/lib/storage` for all persistent app data. All data is encrypted via AES-CTR on all platforms (web, iOS, Android, desktop). Never use direct `localStorage`, `sessionStorage`, or `EncryptedStorage`—always go through `SecureStorage`. Use `STORAGE_KEYS` constants, never hardcode keys. See `docs/issues/MileStone 1/082 - Central Storage/` for API docs and patterns.

## Cache Versioning
- **Version Updates**: Increment `CURRENT_CACHE_VERSION` in `lib/storage/cache-versioning.ts` when making breaking changes to stored data structures
- **Breaking Changes Include**: Schema changes (add/remove/rename fields), stricter validation rules, type changes, new required fields without defaults
- **Non-Breaking**: Optional fields with defaults, performance improvements, bug fixes, cosmetic changes
- **Process**: Update schema validation → update migration function → increment version → test migration
- **Location**: `lib/storage/cache-versioning.ts` (core logic), `docs/issues/MileStone 1/098 - Cache Versioning/CACHE_VERSIONING.md` (docs)

## Patterns and examples
- Import UI components:
  ```ts
  import { Button, Card, TextInput, AppModal, Snackbar, AppToast } from '@/components/ui'
  ```
- Apply themed backgrounds: `contentStyle: { backgroundColor: '$background' }` (as used in `app/_layout.tsx`).
- Prefer design tokens (colors, radius, spacing) over hard-coded values; escalate via theme tokens or `ElevatedView` variants.
- Typography/components: Use `Body`, `Title`, `Subtitle` heading components; do not use `AppText`. 
- For layout, use the provided view components (not `ViewCust`), and only use raw `View` as a simple container when necessary.

## Gotchas
- RN Web pointerEvents: avoid full-screen wrappers that block clicks; if needed, set pointer events via style and keep overlays minimal.
- Fonts on web: non-critical fonts are loaded in bootstrap; Eurostile/Cyberpunk is on-demand to avoid decode warnings.
- Notifications flicker: do not mount the old notification provider/container; use `AppToast`/`Snackbar` until the system is redesigned.

## Where to look
- Layout/routing: `app/_layout.tsx`
- Bootstrap: `hooks/use-app-bootstrap.tsx`
- Splash screen: `hooks/use-splash-screen.tsx`
- Feature flags: `config/appsettings.*.json` (`featureFlags`), `lib/feature-flags.ts` (kind helper + beta warning in prod)
- **Auth system**: `lib/auth/auth-state.ts` (AuthStateManager), `lib/auth/useAuthGuard.ts` (route guards), `lib/auth/useWorldRole.ts` (FUTURE: role checking)
- **Storage**: `lib/storage/SecureStorage.ts` (implementation), `lib/storage/index.ts` (exports + keys)
- **Image optimization**: `components/ui/LazyImage.tsx`, `hooks/use-viewport-tracking.tsx`, `hooks/use-image-cache.tsx`, `lib/utils/image-optimization.ts`. See `docs/issues/MileStone 1/030 - Optimize Image Loading/` for full guide.
- UI barrel: `components/ui/index.ts`
- Theme root: `theme/index.ts` (families, tokens, provider)
- Navigation config: `lib/navigation/navigation-config.ts`, URI helpers: `lib/navigation/uri-helpers.ts`
- Docs: `docs/COMPONENTS.md`, `docs/SCREENS.md`, `docs/FEATURE_FLAGS.md`, `docs/NOTIFICATIONS_USAGE.md`, `docs/NAVIGATION_CONFIG.md`, **`docs/issues/MileStone 1/082 - Central Storage/SECURE_STORAGE.md`**, **`docs/issues/MileStone 1/030 - Optimize Image Loading/IMAGE_OPTIMIZATION_GUIDE.md`**

## Documentation Rule
When creating feature documentation:
- Create docs in `docs/issues/MileStone X/NNN - Feature Name/` folder
- Include 1-2 docs max: one for "How to use" (with examples), one for architecture/implementation if complex
- Focus on feature functionality and usage, not implementation history or design decisions
- Omit benefits/why statements (assume reader knows why the feature exists)
- Include code examples, API reference, troubleshooting, and best practices
