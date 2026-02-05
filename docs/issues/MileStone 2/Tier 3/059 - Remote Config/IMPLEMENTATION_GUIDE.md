# Phase 1 Implementation Guide — Server-Driven Feature Flags & Entitlements

This document explains what we implemented for Phase 1 (RFC #59), why we changed it, and key design decisions.

## TL;DR

- Feature flags are fetched once at app startup and cached.
- Entitlements are checked fresh on each access, with expiry handling.
- Server values overwrite hardcoded defaults.
- Offline uses cached values; expired entitlements are denied.
- Device clock manipulation is detected and denies entitlements (fail-secure).

## What changed (high-level)

- Removed Edge Function client and remote.ts; replaced with direct Supabase REST queries.
- Added `FeatureFlagsManager` in `lib/feature-flags/server-sync.ts` implementing the priority model:
  - Flags: override → bootstrapped server state → hardcoded → fallback
  - Entitlements: override → fresh server check → cached value → deny
- Database helpers added/updated:
  - `lib/database/feature-flags.ts` — `fetchFeatureFlagsByEnv(supabase)`
  - `lib/database/entitlements.ts` — `fetchEntitlementsByUserId(...)`, `hasEntitlement(...)` (with `expires_at` check)
- Hooks updated:
  - `hooks/feature/use-feature-flags.ts` — synchronous access to bootstrapped flags
  - `hooks/feature/use-entitlements.ts` — async entitlement checks (requires `userId`)
- Kernel integration: `lib/kernel/app-kernel.ts` calls `FeatureFlagsManager.initialize()`, `verifyDeviceClock()`, then `bootstrapFlags()` during startup (Phase 3 / appReady).

## Key files modified/added

- `lib/feature-flags/server-sync.ts` — Complete rewrite: manager, caching, overrides, clock checks, cache serialization
- `lib/feature-flags/index.ts` — exports (removed `remote` export)
- `lib/database/feature-flags.ts` — REST query helper
- `lib/database/entitlements.ts` — REST query helper, `expires_at` handling
- `hooks/feature/*` — hook APIs adjusted to reflect sync/async nature
- `docs/issues/.../PHASE_1_COMPLETE.md` — summary created/updated

## Design decisions and rationale

- Flags vs Entitlements mental model
  - Flags = "traffic cones": temporary, one-time startup decisions used synchronously by components.
  - Entitlements = "traffic lights": authoritative, time-bound decisions checked fresh for correctness.

- Why server values overwrite hardcoded
  - Allows ops to disable/enable features without a new build and ensures server is source-of-truth for production.

- Use of Maps for runtime flag storage
  - Replaced plain objects with `Map<string, FeatureFlagState>` to avoid prototype pollution and security linter warnings (Generic Object Injection Sink).

- Expiry handling
  - `entitlements.expires_at` is respected. `NULL` means never expires. Expired entitlements are denied even from cache.

- Clock validation (fail-secure)
  - Detect backward clock skew > 60s; mark device clock invalid and deny entitlements until corrected.

## Storage & persistence

- SecureStorage keys used:
  - `STORAGE_KEYS.FEATURE_FLAGS` — persisted bootstrapped flags (object form)
  - `STORAGE_KEYS.ENTITLEMENTS` — cached entitlements per user+key with expiry metadata
  - `STORAGE_KEYS.CLOCK_INVALID` — clock manipulation marker

- Serialization: `Map` ↔ object conversion done on persist/load via `Object.fromEntries()` / `new Map(Object.entries(...))`.

## Security & hardening

- Avoided dynamic bracket-access on plain objects; used Maps and `Object.prototype.hasOwnProperty.call()` where necessary.
- Kept server-side verification recommended for sensitive operations — client-side entitlements are convenience checks and must be validated server-side for enforcement.

## Testing & verification

- Unit tests updated and run — all tests pass (319/319).
- Manual checklist in `lib/feature-flags/README.md` updated for verification steps (toggle, entitlement expiry, clock skew).

## Notes for reviewers

- Look at `lib/feature-flags/server-sync.ts` for the authoritative implementation.
- Database schema includes `feature_flags` and `entitlements` tables (see `docs/Important Notes/Database/SCHEMA.md`). Ensure `entitlements.expires_at` column exists (NULL allowed).

---

End of Implementation Guide
