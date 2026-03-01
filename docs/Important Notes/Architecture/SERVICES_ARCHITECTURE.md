# Services Architecture: Provider → Adapter → Reporter

## Overview

The services layer uses a three-tier pattern to separate external service dependencies from application logic. This enables service swapping, testing, and clean boundaries.

```
External Services (Sentry, Supabase, Firebase, etc.)
    ↓
Providers (Sentry-specific code, Supabase SDK calls)
    ↓
Adapters (Generic provider interfaces)
    ↓
Reporters (Single entry points in lib modules)
    ↓
Hooks/Components/Screens (Application layer)
```

---

## Tier 1: Providers — External Service Implementations

**Location:** `System/Services/[service]/` (e.g., `sentry/`, `supabase/`)

**Characteristics:**
- Contains **service-specific code and SDK calls** (Sentry SDK, Supabase client, etc.)
- Implements the adapter interface (provider contract)
- Completely **deletable** — when switching services, delete entire folder
- Never imported outside System/Services (except by initializers and adapters)
- Examples:
  - `System/Services/sentry/sentry-error-tracker.ts` → ErrorTrackerProvider impl
  - `System/Services/sentry/sentry-adapter.ts` → BreadcrumbProvider impl
  - `System/Services/supabase/supabase-auth-provider.ts` → AuthProvider impl
  - `System/Services/supabase/supabase-database-provider.ts` → DatabaseProvider impl

**When to add:** New service implementation for an existing adapter (e.g., Firebase auth provider)

**When to delete:** Entire service folder when switching backends (e.g., Sentry → DataDog)

---

## Tier 2: Adapters — Generic Provider Interfaces

**Location:** `System/Services/` (root level)

**Characteristics:**
- Contains **generic, service-agnostic interfaces** defining the contract
- Adapter-specific logic (translating between app code and provider implementations)
- **Minimal changes** when switching providers (update interface if needed)
- Examples:
  - `error-adapter.ts` → ErrorTrackerProvider interface + registration API
  - `auth-adapter.ts` → AuthProvider interface + registration API
  - `database-adapter.ts` → DatabaseProvider interface + query builder
  - `breadcrumb-adapter.ts` → BreadcrumbProvider interface + queue handling

**Key responsibility:** Map between app expectations and provider-specific implementations

**Exception:** Initializers (`*-service-initializer.ts`) — exception to naming scheme, live here

---

## Tier 3: Reporters — Single Entry Points to Adapters

**Location:** `lib/[module]/[module]-reporter.ts` (or similar)

**Characteristics:**
- Contains **static methods that never change** (no service-switching logic)
- **Single file per lib module** that imports from adapters
- All other files in lib/hooks/components import from reporter, never directly from adapters
- Examples:
  - `lib/error/error-reporter.ts`:
    ```ts
    import { getErrorAdapter } from '@/system/Services';
    export function reportError(err: Error) { getErrorAdapter().captureException(err); }
    ```
  - `lib/auth/auth-reporter.ts`:
    ```ts
    import { getAuthAdapter } from '@/system/Services';
    export async function signIn(email, password) { return getAuthAdapter().signIn(email, password); }
    ```
  - `lib/analytics/analytics-reporter.ts`:
    ```ts
    import { getAdapter as getBreadcrumbAdapter } from '@/system/Services';
    export function addBreadcrumb(crumb) { getBreadcrumbAdapter().sendBatch([crumb]); }
    ```

**Key benefits:**
- Services can be swapped with minimal changes (only reporters re-exported or logic updated)
- No adapter details leak to application layer
- Type-safe, single source of truth for each operation

---

## Import Rules

### ✅ ALLOWED

- `lib/error/error-reporter.ts` imports from `@/system/Services` (adapters only)
- `lib/auth/auth-reporter.ts` imports from `@/system/Services` (adapters only)
- `lib/database/[entity].ts` imports from `@/system/Services` (adapters only)
- `lib/analytics/exporters/*.ts` imports from `@/system/Services` (adapters only)
- **Any hook/component/screen** imports from `@/lib/[module]/[reporter]`

### ❌ NOT ALLOWED

- Hooks/components importing `getErrorAdapter()` directly from `@/system/Services`
- Hooks/components importing `getAuthAdapter()` directly
- Hooks/components importing from inside `System/Services/sentry/` or `System/Services/supabase/`

---

## Current State & Mapping

### Services Folder Structure

```
System/Services/
├── error-adapter.ts (was: error-tracker.ts) ← RENAME
├── auth-adapter.ts (was: auth-provider.ts) ← RENAME
├── database-adapter.ts ✓
├── breadcrumb-adapter.ts ✓
├── service-initializer.ts (EXCEPTION)
├── service-status.ts
├── service-validation.ts
├── sentry/
│   ├── sentry-error-tracker.ts (Provider) ✓
│   ├── sentry-adapter.ts (Provider) ✓
│   ├── sentry-analytics-exporter.ts (Provider) ✓
│   └── sentry-service-initializer.ts (Initializer) ✓
└── supabase/
    ├── supabase-auth-provider.ts (Provider) ✓
    ├── supabase-database-provider.ts (Provider) ✓
    ├── supabase-buckets-adapter.ts (Provider) ✓
    ├── supabase-rpc-adapter.ts (Provider) ✓
    ├── supabase-realtime-adapter.ts (Provider) ✓
    ├── supabase-error-translation.ts (Utility)
    ├── supabase-client.ts (Utility)
    ├── supabase-lazy.ts (Utility)
    └── supabase-initializer.ts (Initializer) ✓
```

### Lib Reporters Needed

```
lib/error/
├── error-reporter.ts (NEW) ← single entry point to error-adapter
└── (other error handling files)

lib/auth/
├── auth-reporter.ts (NEW or consolidate into existing pattern)
└── (other auth files)

lib/database/
├── database-reporter.ts (NEW or extend common.ts)
└── (other database files)

lib/analytics/
├── analytics-reporter.ts (NEW for breadcrumbs)
└── (other analytics files)
```

---

## Communication from Provider Failures Through Tiers

### Error Flow Example

```
Provider Layer (Sentry)
  ↓ throws SentryException
Adapter Layer (error-adapter)
  ↓ catches, normalizes to ErrorTrackerProvider contract
Reporter Layer (error-reporter)
  ↓ calls adapter, adds context
Application Layer (hook/component)
  ↓ calls reportError(error)
```

In real code:
1. Sentry SDK throws error
2. `sentry-error-tracker.ts` implements `captureException()` which calls Sentry SDK
3. `error-adapter.ts` provides `ErrorTrackerProvider` interface that guarantees these methods exist
4. `error-reporter.ts` exports `reportError(error)` that calls `getErrorAdapter().captureException(error)`
5. App calls `reportError(error)` from `@/lib/error` ← no visibility into adapter/provider

---

## Service Switching Example

### Scenario: Switch from Sentry to DataDog

**Before (with clean architecture):**
1. Delete `System/Services/sentry/` folder
2. Create `System/Services/datadog/` folder with:
   - `datadog-error-tracker.ts` (implements ErrorTrackerProvider)
   - `datadog-adapter.ts` (implements BreadcrumbProvider)
   - `datadog-analytics-exporter.ts`
   - `datadog-service-initializer.ts`
3. Update `System/Services/service-initializer.ts` to call `initializeDataDogErrorTracker()`
4. Update `System/Services/index.ts` to export `DataDogErrorTracker` instead of `SentryErrorTracker`
5. Update `service-validation.ts` to validate DataDog config
6. **Zero changes to lib/auth, lib/error, lib/database, lib/analytics, hooks, components, screens**

---

## Naming Exceptions

The following files are named exceptions and don't follow the Provider/Adapter/Reporter pattern:

- `*-service-initializer.ts` — Bootstrap coordination (exception to naming)
- `*-initializer.ts` — Provider-specific bootstrap (exception to naming)
- `service-status.ts` — System health tracking
- `service-validation.ts` — Configuration validation
- Utility files like `supabase-error-translation.ts`, `supabase-client.ts`

---

## Future Work

1. **Deferred service splits** (too early to separate now):
   - Offline state machine (when implemented)
   - Feature flag evaluation engine
   - Error classification system

2. **Analytics consolidation** (large refactor):
   - Currently has both `AnalyticsExporter` (outbound) and event emission (inbound)
   - Future: unified analytics pipeline with clear provider/adapter/reporter tiers

3. **Database optimization** (potential future improvement):
   - Consider pooling or read-replica routing logic in database-adapter
   - Reporter layer can remain simple

---

## Adding a New Service

### Example: Add Datadog Error Tracking alongside Sentry

1. **Create Provider** (full Datadog SDK integration):
   - `System/Services/datadog/datadog-error-tracker.ts`
   - Implements `ErrorTrackerProvider` interface
   - Uses Datadog SDK directly

2. **Register in Adapter**:
   - Adapter (`error-adapter.ts`) remains unchanged
   - Initializer (`service-initializer.ts`) adds `initializeDataDogErrorTracker()` before auth

3. **Update Service Validation**:
   - `service-validation.ts` adds `validateDatadogErrorConfig()`

4. **Update Index for Exports**:
   - `System/Services/index.ts` exports `DataDogErrorTracker` (for tests)

5. **Reporters remain unchanged**

---

## References

- **Provider Pattern:** Pluggable backends, service-specific implementation
- **Adapter Pattern:** Interface abstraction, consistent contract
- **Reporter Pattern:** Single entry point, static business logic
- **Dependency Inversion:** High-level modules don't depend on service-specific details

