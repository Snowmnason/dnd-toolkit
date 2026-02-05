# lib

**Core application library with utilities, services, and cross-cutting concerns.**

Organized into focused modules, each with a barrel export (`index.ts`) for clean imports. All modules follow consistent patterns for configuration, error handling, and type safety.

---

## Quick Start

### Import from main barrel

```tsx
import {
  logger,
  AppKernel,
  useAuthGuard,
  SecureStorage,
  STORAGE_KEYS,
} from "@/lib";
```

### Import from specific module

```tsx
import { SecureStorage, STORAGE_KEYS, CacheVersioning } from "@/lib/storage";
import { useAuthGuard, SignUpResult } from "@/lib/auth";
import { logger } from "@/lib/utils";
```

---

## Module Overview

### Analytics (`analytics/`)

**Purpose:** Event tracking, user analytics, and performance metrics.

**Exports:** `Analytics`, `sessionManager`, `trackEvent()`, `trackPageView()`

```tsx
import { Analytics, trackEvent } from "@/lib/analytics";

trackEvent("world_created", { worldId: "123", templateId: "fantasy" });
```

---

### API (`api/`)

**Purpose:** HTTP request management, API client setup, error handling.

**Exports:** `RequestManager`, `createAPIClient()`, `APIError`

```tsx
import { RequestManager } from "@/lib/api";

const response = await RequestManager.get("/users/me");
```

---

### Auth (`auth/`)

**Purpose:** Authentication, authorization, session management, validation.

**Key exports:**

- `AuthStateManager` – Current auth state with world verification
- `useAuthGuard()` – Route protection hook
- `signUpUser()`, `signInUser()` – Auth functions
- `validateEmail()`, `validatePassword()` – Validators

```tsx
import { useAuthGuard, signUpUser } from "@/lib/auth";

// Protect route
const kernel = useAppKernel();
useAuthGuard(kernel.phases.appReady, "account-only");

// Sign up
const result = await signUpUser({ email, password, username });
```

---

### Cache (`cache/`)

**Purpose:** In-memory query caching with TTL and invalidation.

**Exports:** `QueryCache`, `CacheKey`, `invalidateTag()`

```tsx
import { QueryCache } from "@/lib/cache";

QueryCache.set("worlds:all", worlds, { ttl: 60000, tags: ["worlds"] });
QueryCache.invalidateTag("worlds"); // Invalidate all related
```

---

### Config (`config/`)

**Purpose:** Application configuration, feature flags, environment settings.

**Exports:** `getAppConfig()`, `FeatureFlags`

```tsx
import { getAppConfig } from "@/lib/config";

const config = getAppConfig();
console.log(config.features.sentryEnabled);
```

---

### Database (`database/`)

**Purpose:** Supabase client, query builders, schema definitions.

**Exports:** `getSupabaseClient()`, `fetchWorlds()`, `fetchUsers()`, `checkEmailExists()`

```tsx
import { fetchWorlds, getSupabaseClient } from "@/lib/database";

const worlds = await fetchWorlds(userId);
const client = getSupabaseClient();
```

---

### Error (`error/`)

**Purpose:** Standardized error types, error handlers, error boundaries.

**Exports:** `AppError`, `ErrorBoundary`, `handleError()`

```tsx
import { AppError, ErrorBoundary } from "@/lib/error";

throw new AppError("World not found", { code: "WORLD_NOT_FOUND", status: 404 });
```

---

### Feature Flags (`feature-flags/`)

**Purpose:** Dual-mode feature toggles: legacy config-driven flags + server-synced runtime flags/entitlements.

**Exports:** `FeatureFlags`, `useFeatureFlag()`, `FeatureFlagsManager`, `useFeatureFlags()`, `useEntitlement()`

```tsx
import { useFeatureFlag, useFeatureFlags, useEntitlement } from "@/hooks";

// Legacy config-driven flags
const isNewUIEnabled = useFeatureFlag("newUI");

// Server-synced flags
const flagsData = useFeatureFlags();

// Premium entitlements with clock safety
const { granted, expiresAt } = useEntitlement("premium");
```

**Key features:**
- Config-driven toggles for dev/testing (no network)
- Server-synced entitlements for production (with AuthLayer, circuit breaker, offline caching)
- Clock manipulation detection for fail-secure premium gating
- ETag/304 caching optimization
- Integration with `lib/api` (AuthLayer, CircuitBreaker) and `lib/storage` (SecureStorage, FastCache)

---

### Kernel (`kernel/`)

**Purpose:** App bootstrap, initialization phases, kernel readiness state.

**Exports:** `AppKernel`, `AppKernelProvider`, `useAppKernel()`, `KernelPhase`

```tsx
import { useAppKernel } from "@/lib/kernel";

const kernel = useAppKernel();
if (!kernel.phases.appReady) return <LoadingScreen />;
```

---

### Navigation (`navigation/`)

**Purpose:** Route configuration, navigation helpers, URI building.

**Key exports:**

- `navigationConfig` – Route definitions (TopBar, back, params, modals)
- `buildNavigationTarget()` – Build URLs with params
- `getRouteConfig()` – Get config for specific route

```tsx
import { buildNavigationTarget, getRouteConfig } from "@/lib/navigation";

const target = buildNavigationTarget("/main/worlds", { worldId: "123" });
const config = getRouteConfig(context);
```

---

### Network (`network/`)

**Purpose:** Network detection, connectivity status, offline support.

**Exports:** `NetworkDetection`, `NetworkStatus`, `useNetworkStatus()`

```tsx
import { NetworkDetection, useNetworkStatus } from "@/lib/network";

if (!NetworkDetection.getStatus().isOnline) return <OfflineMessage />;
```

---

### Offline (`offline/`)

**Purpose:** Offline data sync, background sync, queue management.

**Exports:** `OfflineSyncManager`, `queueMutation()`

```tsx
import { OfflineSyncManager } from "@/lib/offline";

await OfflineSyncManager.sync();
```

---

### Premium (`premium/`)

**Purpose:** Subscription management, premium features, entitlements.

**Exports:** `SubscriptionManager`, `checkFeatureEntitlement()`, `isPremiumTier()`

```tsx
import { checkFeatureEntitlement } from "@/lib/premium";

const hasAccess = await checkFeatureEntitlement("advanced_features");
```

---

### Routing (`routing/`)

**Purpose:** Route authentication configuration, access control.

**Exports:** `AUTH_CONFIG`, `isRouteProtected()`

```tsx
import { AUTH_CONFIG } from "@/lib/routing";

const requiresAuth = AUTH_CONFIG["/main/settings"]?.requiresAuth;
```

---

### Schemas (`schemas/`)

**Purpose:** Data validation, TypeScript schemas, runtime type checking.

**Exports:** `WorldSchema`, `UserSchema`, `validate()`

```tsx
import { WorldSchema } from "@/lib/schemas";

const validated = WorldSchema.parse(data);
```

---

### Settings (`settings/`)

**Purpose:** User account settings, preferences, deletion, sign out.

**Exports:** `signOut()`, `deleteAccount()`, `updateUsername()`

```tsx
import { signOut, deleteAccount } from "@/lib/settings";

await signOut();
```

---

### Storage (`storage/`)

**Purpose:** Secure encrypted storage, cache versioning, persistence.

**Key exports:**

- `SecureStorage` – Encrypted storage API
- `STORAGE_KEYS` – Constants for all storage keys
- `CacheVersioning` – Cache migration and versioning

```tsx
import { SecureStorage, STORAGE_KEYS, CacheVersioning } from "@/lib/storage";

// Store encrypted data
await SecureStorage.setJSON(STORAGE_KEYS.USER_PREFS, { theme: "dark" });

// Load with version check
const data = await CacheVersioning.loadWithMigration(STORAGE_KEYS.WORLDS);
```

**Note:** All data is encrypted via AES-CTR on all platforms (web, iOS, Android, desktop). Never use direct `localStorage`—always use `SecureStorage`.

---

### Utils (`utils/`)

**Purpose:** General utilities: logging, versioning, performance tracking, image optimization.

**Key exports:**

- `logger` – Category-based logging system
- `APP_VERSION` – Current app version
- `lazyLoadInBackground()` – Defer expensive imports
- `preloadImages()` – Image optimization

```tsx
import { logger, APP_VERSION, preloadImages } from "@/lib/utils";

logger.info("auth", `App v${APP_VERSION} loading...`);
preloadImages(["/hero.png", "/icon.png"]);
```

---

## Module Import Patterns

### ✅ Recommended

```tsx
// Use barrel exports
import { logger, AppKernel } from "@/lib";
import { SecureStorage, STORAGE_KEYS } from "@/lib/storage";
import { useAuthGuard, SignUpResult } from "@/lib/auth";
```

### ❌ Avoid

```tsx
// Don't import from nested files
import { logger } from "@/lib/utils/logger";
import { SecureStorage } from "@/lib/storage/SecureStorage";

// Don't mix patterns
import { logger } from "@/lib";
import { storage } from "@/lib/storage/storage";
```

---

## Best Practices

### ✅ Do

- Import from barrel exports (cleaner, more maintainable)
- Use specific module imports for better tree-shaking
- Check module READMEs for detailed API documentation
- Use `logger.category()` for categorized logging
- Always use `SecureStorage` for persistent data
- Guard Supabase usage with `isSupabaseConfigured()`

### ❌ Don't

- Import from nested files (breaks encapsulation)
- Mix import patterns in the same file
- Use `localStorage` directly (use `SecureStorage`)
- Ignore error handling (wrap async calls with try/catch)
- Create circular dependencies between modules

---

## File Structure

```
lib/
├── index.ts                      # Main barrel export (exports all modules)
├── analytics/                    # Event tracking & metrics
│   ├── index.ts                  # Barrel export
│   └── ...
├── api/                          # HTTP client & request management
│   ├── index.ts                  # Barrel export
│   └── ...
├── auth/                         # Authentication & authorization
│   ├── index.ts                  # Barrel export
│   └── ...
├── cache/                        # Query caching with TTL
│   ├── index.ts                  # Barrel export
│   └── ...
├── config/                       # Configuration & feature flags
│   ├── index.ts                  # Barrel export
│   └── ...
├── database/                     # Supabase client & queries
│   ├── index.ts                  # Barrel export
│   └── ...
├── error/                        # Error handling & boundaries
│   ├── index.ts                  # Barrel export
│   └── ...
├── feature-flags/                # Runtime feature toggles
│   ├── index.ts                  # Barrel export
│   └── ...
├── kernel/                       # App bootstrap & lifecycle
│   ├── index.ts                  # Barrel export
│   └── ...
├── navigation/                   # Route config & URI helpers
│   ├── index.ts                  # Barrel export
│   └── ...
├── network/                      # Network detection
│   ├── index.ts                  # Barrel export
│   └── ...
├── offline/                      # Offline sync & queuing
│   ├── index.ts                  # Barrel export
│   └── ...
├── premium/                      # Subscriptions & entitlements
│   ├── index.ts                  # Barrel export
│   └── ...
├── routing/                      # Route authentication config
│   ├── index.ts                  # Barrel export
│   └── ...
├── schemas/                      # Data validation & types
│   ├── index.ts                  # Barrel export
│   └── ...
├── settings/                     # User settings & account
│   ├── index.ts                  # Barrel export
│   └── ...
├── storage/                      # Secure encrypted storage
│   ├── index.ts                  # Barrel export
│   └── ...
└── utils/                        # Logging, version, performance
    ├── index.ts                  # Barrel export
    └── ...
```

---

## Related

- [hooks/](../hooks/) – Custom React hooks
- [providers/](../providers/) – Context providers
- [components/ui/](../components/ui/) – UI component library
- [docs/](../docs/) – Architecture & implementation guides
