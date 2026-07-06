# Services

Provider-agnostic service adapters and registration utilities for authentication, database access, error tracking, analytics-style breadcrumbs, session persistence, and backend availability checks. This module is infrastructure-facing and is initialized during bootstrap.

## What Lives Here

- auth, database, error-tracker, and breadcrumb adapter contracts
- service registration and bootstrap wiring
- readiness and validation helpers
- provider-neutral backend availability helpers
- Supabase-backed implementations for the current app

## Key Responsibilities

- hide provider-specific SDK details behind stable interfaces
- register concrete adapters during bootstrap through `service-initializer.ts`
- expose sync and async access points for core providers
- track service readiness so higher layers can degrade or gate correctly
- keep backend-availability logic out of UI and orchestration layers

## Key Entry Points

- `initializeServices()` in `service-initializer.ts` — register default service adapters during bootstrap
- `registerAuthProvider()` and `getAuthProvider()` in `auth-adapter.ts`
- `registerDatabaseProvider()` and `getDatabaseProvider()` in `database-adapter.ts`
- `registerErrorTracker()` and `getErrorTracker()` in `error-adapter.ts`
- `registerAdapter()` and `getAdapter()` in `analytics-adapter.ts`
- `getBackendHealthUrl()` and `isBackendAvailable()` in `backend-availability.ts`
- `getServiceStatus()` and `areCriticalServicesReady()` in `service-status.ts`

## Related Modules

- `system/Kernel/README.md` — bootstrap and readiness orchestration
- `system/Network/README.md` — network detection and availability checks
- `system/API/README.md` — transport-facing API layer
- `lib/auth/README.md` — app auth flows that consume the registered auth provider
- `lib/error/README.md` — higher-layer error categorization and recovery

Route protection does not live here. Current route protection is owned by `config/routing-auth-config.ts`, `hooks/navigation/use-bootstrap-route-guard.ts`, and `lib/navigation/policyEngine.ts`.

## File Breakdown

| File | Purpose |
| --- | --- |
| `analytics-adapter.ts` | Breadcrumb provider contract and registration |
| `auth-adapter.ts` | Auth provider contract, normalized auth errors, and provider registration |
| `backend-availability.ts` | Backend URL resolution and lightweight health checks |
| `database-adapter.ts` | Database provider contract and registration |
| `error-adapter.ts` | Error tracker contract, fallback tracker, and registration |
| `session-adapter.ts` | System-level session persistence contract |
| `service-initializer.ts` | Bootstrap wiring for the default adapters |
| `service-status.ts` | Service readiness tracking and visibility helpers |
| `service-validation.ts` | Validation helpers for startup-time service checks |
| `supabase/` | Current Supabase-backed service implementations |
| `index.ts` | Public barrel for the module |
