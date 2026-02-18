# lib

Core application library: utilities, services, and cross-cutting modules used across the app.

Each folder is a focused module with a barrel export (`index.ts`) for clean imports. Modules follow consistent patterns for configuration, error handling, and type safety.

## Quick start

Import commonly-used symbols from the main barrel:

```ts
import { logger, AppKernel, useAuthGuard, SecureStorage } from "@/lib";
```

For module-specific APIs import from the module barrel:

```ts
import { SecureStorage, STORAGE_KEYS } from "@/lib/storage";
import { useAuthGuard } from "@/lib/auth";
```

## Modules (at-a-glance)

- **analytics/** — Event tracking & performance (`Analytics`, `trackEvent`).
- **api/** — HTTP client & request management (`RequestManager`).
- **auth/** — Authentication, session management, route guards (`AuthStateManager`, `useAuthGuard`).
- **cache/** — In-memory query cache with TTL (`QueryCache`, `invalidateTag`).
- **config/** — App configuration and feature flags (`getAppConfig`).
- **database/** — Supabase client and queries (`getSupabaseClient`, `fetchWorlds`).
- **error/** — Standardized error types and boundaries (`AppError`, `ErrorBoundary`).
- **feature-flags/** — Config-driven and server-synced flags (`useFeatureFlag`, `useFeatureFlags`).
- **kernel/** — App bootstrap and kernel phases (`AppKernel`, `useAppKernel`).
- **navigation/** — Route definitions and URI helpers (`navigationConfig`, `buildNavigationTarget`).
- **network/** — Connectivity detection and helpers (`NetworkDetection`, `useNetworkStatus`).
- **offline/** — Offline sync and mutation queue (`OfflineSyncManager`).
- **premium/** — Subscription management and entitlements (`SubscriptionManager`).
- **routing/** — Route auth config (`AUTH_CONFIG`).
- **schemas/** — Zod schemas and runtime validation (`WorldSchema`, `UserSchema`).
- **settings/** — Account operations (sign out, delete, update username).
- **storage/** — Secure, encrypted storage and cache versioning (`SecureStorage`, `STORAGE_KEYS`).
- **utils/** — Logging, versioning, image helpers (`logger`, `APP_VERSION`).

## Recommended import patterns

Use barrel exports for clarity and tree-shaking:

```ts
// Good
import { logger, AppKernel } from "@/lib";

// Avoid deep imports
// import { logger } from "@/lib/utils/logger";
```

## Best practices

- Prefer module barrels over nested file imports.
- Keep provider and global state minimal; use specific hooks where provided (e.g. `useScale()`).
- Always persist sensitive data through `SecureStorage` (do not access `localStorage` directly).
- Guard Supabase usage with `isSupabaseConfigured()`.
- Wrap async operations in try/catch and surface user-friendly errors.

## File layout (short)

```
lib/
├── analytics/
├── api/
├── auth/
├── cache/
├── config/
├── database/
├── error/
├── feature-flags/
├── kernel/
├── navigation/
├── network/
├── offline/
├── premium/
├── routing/
├── schemas/
├── settings/
├── storage/
└── utils/
```

## Related

- `hooks/` — Custom React hooks
- `providers/` — Context providers
- `components/ui/` — UI components
- `docs/` — Architecture & implementation guides
