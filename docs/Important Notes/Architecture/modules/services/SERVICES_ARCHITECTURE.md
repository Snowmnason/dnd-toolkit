# Services Architecture

Technical overview of the current `system/Services` layer and how service providers are initialized, registered, and consumed.

## Purpose

The services layer isolates third-party service details from the rest of the app.

In the current repo, this layer is responsible for:

- registering external-service providers
- exposing stable adapter contracts
- tracking service readiness
- validating service configuration
- giving bootstrap and runtime code one consistent import surface

## Current High-Level Shape

```text
Third-party SDKs / provider implementations
        ↓
system/Services/[provider folders]
        ↓
root adapters and registration APIs
        ↓
service initialization + status tracking
        ↓
system and higher layers consume through @/system/Services
```

The current repo is not using a separate reporter tier as the main organizing principle here. The important boundary today is provider implementation versus adapter contract versus bootstrap/runtime access.

## Current Folder Structure

The current `system/Services/` surface includes:

```text
system/Services/
├── analytics-adapter.ts
├── auth-adapter.ts
├── backend-availability.ts
├── database-adapter.ts
├── error-adapter.ts
├── index.ts
├── service-initializer.ts
├── service-status.ts
├── service-validation.ts
├── session-adapter.ts
├── sentry/
└── supabase/
```

## Provider Implementations

Provider-specific code lives in provider folders such as `sentry/` and `supabase/`.

Characteristics:

- SDK-specific logic lives here
- these files know the real provider APIs
- these folders are the main swap point when changing a backend or external service

Examples in the current repo:

- `supabase/supabase-auth-provider.ts`
- `supabase/supabase-database-provider.ts`
- `supabase/supabase-initializer.ts`
- `sentry/sentry-error-tracker.ts`
- `sentry/sentry-service-initializer.ts`

## Root Adapters

The root adapter files define the contracts and registration APIs consumed by the rest of the app.

### `auth-adapter.ts`

Owns:

- the `AuthProvider` contract
- auth registration and lookup
- validated-provider creation helpers
- shared auth error types

### `database-adapter.ts`

Owns:

- the `DatabaseProvider` contract
- provider registration and lookup
- query helpers and result types
- the no-op database fallback used in degraded startup

### `error-adapter.ts`

Owns:

- the `ErrorTrackerProvider` contract
- tracker registration and lookup
- no-op tracker fallback
- shared severity and breadcrumb types for direct error reporting

### `analytics-adapter.ts`

Owns:

- breadcrumb-oriented adapter registration
- provider lookup for queued analytics breadcrumb delivery
- shared breadcrumb send result types

### `session-adapter.ts`

Owns system-level persisted session save or restore behavior.

This matters because auth bootstrap and runtime session recovery depend on one place to read and write persisted session data.

## Bootstrap And Registration

### `service-initializer.ts`

This is the main bootstrap switchboard for the services layer.

Current responsibilities include:

- initialize the database provider first
- initialize repositories and auth provider in parallel once database setup is ready
- initialize the performance baseline service
- initialize the error tracker
- register the Sentry analytics exporter

This file is the main answer to where services come online during startup.

## Status And Validation

### `service-status.ts`

Tracks readiness state for registered services.

This gives bootstrap and health checks a consistent view of which services are ready, degraded, failed, or disabled.

### `service-validation.ts`

Owns config validation for service-specific startup requirements.

Examples include validating:

- Supabase database config
- Supabase auth config
- Sentry analytics config
- Sentry error-tracking config

### `backend-availability.ts`

Provides provider-agnostic backend availability helpers.

This separates general backend reachability checks from provider-specific API logic.

## Runtime Consumption Pattern

Higher layers should consume this module through `@/system/Services` or through the specific adapter surface when needed.

Examples from the current repo include:

- auth phase restoring a saved session through auth-provider access
- bootstrap code checking whether an auth provider is configured
- service initialization updating readiness state
- database and error-tracking registration during startup

The main point is that callers should depend on the adapter contract, not on provider-specific folders.

## Degraded And Fallback Behavior

The current services layer is designed to allow partial startup even when some providers are unavailable.

Examples:

- database can fall back to a no-op provider instead of crashing every caller immediately
- error tracking can fall back to a no-op tracker
- auth provider registration can be skipped if config is missing
- service status reflects failed, degraded, or disabled states for later decisions

This matters because service availability feeds into bootstrap decisions, degrade handling, and safe-mode escalation.

## Design Rules

- Put SDK-specific logic in provider folders, not in callers.
- Expose stable contracts from root adapter files.
- Centralize startup wiring in `service-initializer.ts`.
- Track readiness through `service-status.ts` instead of ad hoc booleans.
- Prefer consuming the `@/system/Services` surface over reaching into provider folders.

## Related Guides

- `../../KERNEL_ARCHITECTURE_ANALYSIS.md`
- `../../AUTH_AND_SYNC_FLOW.md`
- `../../Apps Response to Degraded Paths.md`