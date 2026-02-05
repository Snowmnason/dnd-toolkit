# lib/feature-flags

**Dual-mode feature flag system:** config-driven toggles for development + server-driven runtime flags + premium entitlements.

This module provides two complementary systems:

1. **Legacy (Config-Driven):** `FeatureFlags` for dev/testing toggles from `appsettings.*.json`
2. **Server-Sync (Runtime):** `FeatureFlagsManager` for production entitlements and feature gates synced from Supabase Edge Function

## When to Use This Module

**Use this module for:**

- **Config-Driven Toggles** (legacy `FeatureFlags`): Enable/disable features without code changes during dev/testing
- **Beta Testing**: Flag experimental features with automatic production warnings in console
- **A/B Testing Setup**: Foundation for rolling out features to subsets of users
- **Development Control**: Dev console access for runtime flag toggling without redeploy
- **Kind-Based Organization**: Classify flags by scope (free, premium, beta) in config
- **Graceful Degradation**: Disable features on older versions or during maintenance
- **Runtime Premium Gates** (new `FeatureFlagsManager`): Fetch entitlements from server, enforce clock safety, stale-while-revalidate offline fallback
- **Feature Entitlements**: Gate premium features with expiry checks and device clock manipulation detection

**Do NOT use this module for:**

- **User Permission Checks** (use [lib/auth's AuthStateManager](../auth/README.md) or [lib/database](../database/README.md) roles for role/permission validation)
- **Build-Time Configuration** (use [lib/config](../config/README.md) for environment-specific settings instead)
- **Analytics Events** (use [lib/analytics](../analytics/README.md) instead)

## Architecture & Data Flow

### Legacy Config-Driven Path

```
Config File (config/appsettings.*.json)
    ↓
FeatureFlags.getAllFlags() [on init]
    ↓
Internal Map<flagName, FeatureFlag>
    ↓
Runtime Checks (isEnabled, getKind, toggle) or Dev Console
    ↓
Component/Service Decision Logic
```

### New Server-Driven Path (FeatureFlagsManager, Phase 1)

**Feature Flags:**

- ✅ **Fetched ONCE** at app startup (non-blocking)
- Server values **OVERWRITE** hardcoded config
- Used throughout app lifecycle without re-fetching
- Offline: Uses last startup values from `SecureStorage`

**Entitlements:**

- ✅ **Fetched FRESH** on each check (real-time verification)
- Expiry checking: `expires_at` field automatically evaluated
- Offline: Caches last known values with expiry metadata
- Clock manipulation detection: Denies access if device time is invalid

```
AppKernel Startup (Phase 3: appReady)
    ↓
FeatureFlagsManager.initialize(supabaseClient)
FeatureFlagsManager.verifyDeviceClock()
FeatureFlagsManager.bootstrapFlags() [ONE-TIME, non-blocking]
    ↓
Supabase REST API → feature_flags table (env-specific)
    ↓
SecureStorage: Store flags + timestamp
    ↓
Runtime Checks (getFlag, getEntitlement)
    ↓
Components/Services use hooks: useFeatureFlags(), useEntitlement()
```

### Key Patterns

**Kind Classification**: Each flag can be tagged:

- `free` – Available to all users (safe in production)
- `premium` – Requires paid tier (when combined with SubscriptionManager)
- `beta` – Experimental/testing (logged if enabled in production)

**Runtime Toggle Support**: `FeatureFlags.toggle(flagName, enabled)` allows dev console access without config changes. Changes are in-memory only and don't persist across page refreshes.

**Production Beta Warning**: If a flag with `kind: 'beta'` is enabled during production build startup, a console warning is logged (detected via `isProduction()` check).

## API Reference

### `FeatureFlags` (Singleton Manager)

#### Checking Flags

**`isEnabled(flagName: FeatureFlagName): boolean`**

Returns whether a flag is enabled in the current config.

```typescript
import { FeatureFlags } from "@/lib/feature-flags";

if (FeatureFlags.isEnabled("splashScreen")) {
  // Show splash screen
}
```

**`getKind(flagName: FeatureFlagName): FeatureFlagKind | undefined`**

Returns the flag's classification ('free', 'premium', 'beta').

```typescript
const kind = FeatureFlags.getKind("campaignsBeta");
// Returns 'beta' if set, undefined otherwise
```

**`getDescription(flagName: FeatureFlagName): string | undefined`**

Returns the flag's description from config.

```typescript
const desc = FeatureFlags.getDescription("advancedMaps");
// Returns "Advanced map features for premium users"
```

**`getAllFlags(): Record<string, FeatureFlag>`**

Returns all flags as an object. Useful for UI/admin panels showing all available flags.

```typescript
const allFlags = FeatureFlags.getAllFlags();
// { splashScreen: {...}, debugLogs: {...}, campaignsBeta: {...} }
```

**`getByKind(kind: FeatureFlagKind): Record<string, FeatureFlag>`**

Returns all flags matching a specific kind.

```typescript
const betaFlags = FeatureFlags.getByKind("beta");
// Only flags with kind: 'beta'

const premiumFlags = FeatureFlags.getByKind("premium");
// Only flags with kind: 'premium'
```

#### Runtime Modifications (Development Only)

**`toggle(flagName: FeatureFlagName, enabled: boolean): void`**

Toggles a single flag at runtime. Changes are in-memory and don't persist.

```typescript
// Via dev console (exposed to window.FeatureFlags)
FeatureFlags.toggle("splashScreen", false);
// splashScreen now disabled until page refresh

// Via code (not recommended for production)
FeatureFlags.toggle("debugLogs", true);
```

**`toggleKind(kind: FeatureFlagKind, enabled: boolean): void`**

Toggles all flags of a specific kind at once.

```typescript
// Via dev console
FeatureFlags.toggleKind("beta", true);
// All beta flags now enabled

FeatureFlags.toggleKind("premium", false);
// All premium flags now disabled
```

#### Subscribing to Changes

**`subscribe(callback: FlagChangeCallback): () => void`**

Registers a callback to be notified when flags change (used internally by `useFeatureFlag` hook).

```typescript
const unsubscribe = FeatureFlags.subscribe((flagName, kind) => {
  if (flagName === null) {
    console.log("Multiple flags changed (kind:", kind, ")");
  } else {
    console.log("Flag changed:", flagName);
  }
});

// Later: unsubscribe()
```

### `FeatureFlagsManager` (Server-Driven, Phase 1 ✅ Complete)

**Runtime manager for premium entitlements and server-synced feature gates.**

**How it works:**

- Feature flags are fetched **once** at app startup and cached
- Entitlements are fetched **fresh** on each call (real-time verification)
- Server values override hardcoded defaults
- Expired entitlements are automatically denied
- Device clock manipulation is detected and blocks access

Initialized automatically by `AppKernel` on startup; no manual initialization typically needed.

#### Methods

**`async initialize(supabaseClient: SupabaseClient): Promise<void>`**

Initializes the manager with a Supabase client. Called automatically by `AppKernel` during Phase 3 (appReady).

```typescript
import { FeatureFlagsManager } from "@/lib/feature-flags";
const { getSupabaseClient } = await import("@/lib/database/supabase");

await FeatureFlagsManager.initialize(getSupabaseClient());
```

**`async verifyDeviceClock(): Promise<boolean>`**

Performs a clock skew check against server time. Returns `true` if device clock is safe (within 60 seconds tolerance). Called at startup to detect device time manipulation.

```typescript
const clockValid = await FeatureFlagsManager.verifyDeviceClock();
if (!clockValid) {
  logger.warn("Device clock invalid - denying premium access");
}
```

**`async bootstrapFlags(): Promise<void>`**

Fetches feature flags from server **once** at app startup. Server values overwrite hardcoded config. Non-blocking; logs errors but never throws.

```typescript
// Called automatically by AppKernel, but can be called manually for refresh
await FeatureFlagsManager.bootstrapFlags();
```

**`getFlag(name: string, fallback?: boolean): boolean`**

Synchronous check of a feature flag. Returns cached value from bootstrap, or fallback if not found.

**Priority:** Override → Server (bootstrapped) → Hardcoded → Fallback

```typescript
const enabled = FeatureFlagsManager.getFlag("darkModeV2", false);
if (enabled) {
  // Use new dark mode
}
```

**`async getEntitlement(name: string, userId: string): Promise<{ granted: boolean; source: string }>`**

Fetches entitlement **fresh** on each call (real-time verification). Checks expiry automatically.

**Priority:** Override → Fresh Server Check → Cached Value

- `expires_at = null` → Never expires (always granted)
- `expires_at > now()` → Currently valid (granted)
- `expires_at <= now()` → Expired (denied)
- Device clock invalid → Denied (fail-secure)

```typescript
const { granted } = await FeatureFlagsManager.getEntitlement("premium", userId);
if (granted) {
  // User has premium access
}
```

**`subscribe(callback: (flags: Record<string, FeatureFlagState>) => void): () => void`**

Subscribes to flag updates (fires when bootstrapFlags completes). Callback receives all flags.

```typescript
const unsubscribe = FeatureFlagsManager.subscribe((flags) => {
  console.log("Flags updated:", flags);
});
// Later: unsubscribe();
```

**`setOverride(key: string, value: boolean): void`**

Set admin override for testing. Key format:

- Flag override: `"flagName"`
- Entitlement override: `"userId:entitlementKey"`

```typescript
// Override a feature flag for testing
FeatureFlagsManager.setOverride("darkModeV2", true);

// Override an entitlement for a user
FeatureFlagsManager.setOverride("user-123:premium", true);
```

**`clearOverride(key: string): void` / `clearAllOverrides(): void`**

Clear specific override or all overrides.

```typescript
FeatureFlagsManager.clearOverride("darkModeV2");
FeatureFlagsManager.clearAllOverrides(); // Clear all when testing done
```

## Interfaces

### `FeatureFlag`

```typescript
interface FeatureFlag {
  enabled: boolean; // Whether the flag is currently enabled
  description?: string; // Human-readable description
  kind?: "free" | "premium" | "beta"; // Classification
}
```

### `FeatureFlagName`

```typescript
// Type: keyof typeof appSettingsProd.featureFlags
// Auto-inferred from config/appsettings.json
// Provides IDE autocomplete for all defined flags
```

### `FeatureFlagKind`

```typescript
type FeatureFlagKind = "free" | "premium" | "beta";
```

## Configuration

### Setting Flags in Config

Edit `config/appsettings.dev.json` (local development) and `config/appsettings.json` (production defaults):

```json
{
  "featureFlags": {
    "splashScreen": {
      "enabled": true,
      "description": "Show splash screen on app load",
      "kind": "free"
    },
    "advancedMaps": {
      "enabled": false,
      "description": "Advanced map features",
      "kind": "premium"
    },
    "campaignsBeta": {
      "enabled": false,
      "description": "Beta campaign management system",
      "kind": "beta"
    },
    "debugLogs": {
      "enabled": false,
      "description": "Enable verbose debug logging"
    }
  }
}
```

### Flag Categories

| Kind      | Use Case                   | Production Behavior                         |
| --------- | -------------------------- | ------------------------------------------- |
| `free`    | Features available to all  | Safe to enable                              |
| `premium` | Requires paid subscription | Combine with SubscriptionManager for gating |
| `beta`    | Experimental features      | Console warning if enabled in prod build    |
| (none)    | Miscellaneous toggles      | No special handling                         |

## Usage Examples

### Basic Feature Toggle

```typescript
import { FeatureFlags } from '@/lib/feature-flags';

export function MaybeShowFeature() {
  if (!FeatureFlags.isEnabled('myFeature')) {
    return null;
  }
  return <MyNewFeature />;
}
```

### React Hook Integration

```typescript
import { useFeatureFlag } from '@/hooks/use-feature-flag';

export function ComponentWithToggle() {
  const isEnabled = useFeatureFlag('splashScreen');

  return <div>{isEnabled ? <SplashScreen /> : <MainContent />}</div>;
}
```

### Server-Synced Flags & Entitlements (React Hooks)

```typescript
import { useFeatureFlags, useEntitlement } from '@/hooks';

export function PremiumFeature() {
  // Feature flags are checked synchronously (bootstrapped at startup)
  const { enabled: hasDarkModeV2 } = useFeatureFlags("darkModeV2");

  // Check premium entitlement (fresh check, async)
  const { granted: isPremium, loading } = useEntitlement("premium", userId);

  if (loading) return <div>Checking access...</div>;
  if (!isPremium) return <PaywallModal />;

  return <PremiumContent useDarkMode={hasDarkModeV2} />;
}
```

**Key Differences:**

- `useFeatureFlags()` - Synchronous, cached from bootstrap
- `useEntitlement()` - Asynchronous, always fresh from server (or cached if offline)

### Dev Console Runtime Toggle

Open browser dev console and run:

```javascript
// Toggle a single flag
FeatureFlags.toggle("splashScreen", false);

// Toggle all beta flags
FeatureFlags.toggleKind("beta", true);

// View current state
FeatureFlags.getAllFlags();
console.log(FeatureFlags.isEnabled("splashScreen")); // true/false
```

### Combining with Subscription (Premium Gating)

```typescript
import { FeatureFlags } from "@/lib/feature-flags";
import { SubscriptionManager } from "@/lib/premium";

export async function checkPremiumFeature(featureKey: string) {
  // Feature must be flagged AND premium
  const flagEnabled = FeatureFlags.isEnabled("advancedMaps");
  const hasAccess = await SubscriptionManager.hasFeature(featureKey);

  return flagEnabled && hasAccess;
}
```

## Dependencies

### Internal

**Legacy (Config-Driven):**

- `lib/config/loader.ts` – `getAppConfig()`, `isProduction()` (load flags + detect prod)
- `config/appsettings.*.json` – Flag definitions (dev + prod defaults)

**Server-Driven (FeatureFlagsManager):**

- `lib/database/feature-flags.ts` – `fetchFeatureFlagsByEnv()` REST query helper
- `lib/database/entitlements.ts` – `fetchEntitlementsByUserId()`, `hasEntitlement()` REST query helpers
- `lib/storage` – `SecureStorage`, `STORAGE_KEYS` (encrypted persistence, versioned)
- `lib/config` – `getAppConfig()` (environment detection, hardcoded defaults)
- `lib/kernel` – `AppKernel` (automatic initialization on startup, clock verification)
- `lib/utils/logger.ts` – Logging with categories

### External

- None (vanilla TypeScript, no external dependencies)

## Error Handling & Edge Cases

### Known Limitations

1. **No Remote Config for Feature Flags**: Flags are loaded once at startup from Supabase REST API. To update flags, you must restart the app (no hot-reload).

2. **Clock Skew Detection**: Device time manipulation (>60 seconds backward) denies all entitlements. Check `FeatureFlagsManager.verifyDeviceClock()` before relying on premium features.

3. **Entitlement Expiry**: Requires `expires_at` to be set in database. Missing `expires_at` means the entitlement never expires.

4. **Offline Access**: While offline, cached entitlements are used but expiry is still checked locally (cached `expiresAt` timestamp).

5. **Admin Overrides**: `setOverride()` is in-memory only. Overrides are cleared when app reloads or on logout.

6. **No Rollout Targeting**: Flags are global (all or nothing). No per-user rollout yet (Phase 2 feature).

### Security Considerations

- **No Secrets**: Feature flags are config-driven and visible in client code. Never store secrets in flag definitions.
- **Server-Side Gating**: Always validate feature access on the backend as well (flags alone are insufficient for security).
- **Premium Flags**: Combine with `SubscriptionManager` verification for actual payment gating (flags alone don't enforce).

## Performance Notes

- **Startup**: O(1) for flag checks after initialization (Map-based lookup)
- **Memory**: Negligible (flags typically 10-50 keys, each a few bytes)
- **React Re-Renders**: `useFeatureFlag` hook adds subscription listener; optimize with memoization if called many times
- **No Network**: Config is loaded at build-time; zero runtime network calls

## Related Modules

- **lib/config** – Environment-aware configuration loading (used to load legacy feature flags)
- **lib/premium** – Subscription/tier management (combine with flags for premium gating)
- **lib/api/auth-layer** – Token injection for Edge Function calls (`FeatureFlagsManager`)
- **lib/api/circuit-breaker** – Circuit breaker state for preventing retry storms
- **lib/cache/QueryCache** – Request deduplication (Phase 2 enhancement)
- **lib/storage/SecureStorage** – Encrypted entitlements persistence
- **lib/storage/FastCache** – Unencrypted flag caching
- **lib/network/state-machine** – Network state transitions triggering flag refresh
- **lib/api/network-recovery** – Hooks for flag refresh on network recovery
- **lib/kernel/app-kernel** – Bootstrap clock verification and manager initialization
- **hooks/use-feature-flag** – Legacy hook for config-driven flags
- **hooks/use-feature-flags** – Server-synced flags hook
- **hooks/use-entitlements** – Premium entitlement status hook

## File Breakdown

| File             | Purpose                                                          | Lines |
| ---------------- | ---------------------------------------------------------------- | ----- |
| feature-flags.ts | Legacy `FeatureFlags` class, config-driven toggles, window setup | ~130  |
| server-sync.ts   | `FeatureFlagsManager`, server-sync, entitlements, clock checks   | ~350  |
| remote.ts        | Edge Function client, ETag/304 handling, AuthLayer token inject  | ~114  |
| index.ts         | Barrel export (legacy + new manager + hooks)                     | 10    |
| README.md        | This file                                                        | ~520  |

## Testing

### Manual Testing Checklist

- [ ] Test `isEnabled(flag)` for enabled flag (returns true)
- [ ] Test `isEnabled(flag)` for disabled flag (returns false)
- [ ] Test `isEnabled(nonexistent)` (returns false)
- [ ] Test `getKind()` for each kind (free, premium, beta, undefined)
- [ ] Test `toggle()` from dev console – verify in-memory change
- [ ] Test page refresh after `toggle()` – verify reset to config value
- [ ] Test `toggleKind('beta', true)` – verify all beta flags enabled
- [ ] Test production build with beta flag enabled – verify console warning
- [ ] Test `useFeatureFlag()` hook – verify re-render on toggle
- [ ] Test `subscribe()` callback – verify called on flag change

### Dev Console Testing

```javascript
// Verify all APIs are accessible
console.log(FeatureFlags.getAllFlags());
FeatureFlags.toggle("splashScreen", false);
console.log(FeatureFlags.isEnabled("splashScreen")); // Should be false
FeatureFlags.toggleKind("beta", true);
console.log(FeatureFlags.getByKind("beta")); // All beta flags enabled
```

## Future Enhancements

**Phase 1** — ✅ **COMPLETE**

- ✅ Server-driven feature flags (bootstrap at startup)
- ✅ Premium entitlements with expiry checking
- ✅ Device clock manipulation detection
- ✅ Offline caching with fallback
- ✅ Admin override support for testing
- ✅ Security hardening (Map-based access, no object injection)

**Phase 2 (Planned):**

- **Recurring Sync** – Background job to refresh flags/entitlements at configurable intervals (24h default)
- **UI Hooks Enhanced** – Better error handling and loading states in hooks
- **Admin Debug Screen** – Built-in UI to view cached flags, trigger refresh, inspect clock state
- **Telemetry** – Track flag check counts and entitlement denials for analytics
- **Per-User Rollout** – Gradual rollout of flags to user segments
- **A/B Testing Integration** – Link flag variants to user cohorts
