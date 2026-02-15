# lib/feature-flags

**Triple-mode feature flag system:** config-driven toggles for development + server-driven runtime flags + premium entitlements + percentage-based rollouts.

This module provides three complementary systems:

1. **Legacy (Config-Driven):** `FeatureFlags` for dev/testing toggles from `appsettings.*.json`
2. **Server-Sync (Runtime):** `FeatureFlagsManager` for production entitlements and feature gates synced from Supabase Edge Function
3. **Rollout System:** Deterministic percentage-based user bucketing for gradual feature deployment and A/B testing

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
- **Percentage-Based Rollouts** (new): Gradual feature deployment with deterministic user bucketing
- **Route Variants**: A/B testing for UI components and user flows

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

### New Server-Driven Path (FeatureFlagsManager, Phase 1 ✅ Complete)

**Development Mode:**

- Uses `appsettings.dev.json` as source of truth (no remote fetch)
- No remote overrides (dev environment has no QA testers)
- Fast startup, full local control

**Production Mode:**

- ✅ **Fetched ONCE** at app startup (non-blocking)
- Server values **OVERWRITE** hardcoded config
- **Per-User Remote Overrides** (Phase 1a): Admin-controlled per-user flag toggles override server values
- Used throughout app lifecycle without re-fetching
- **Storage Strategy**: Persisted to `SecureStorage` for offline access. One-time bootstrap simplifies logic and reduces points of failure.
- Offline: Uses last startup values from `SecureStorage` (including cached overrides)

**Entitlements:**

- ✅ **Fetched FRESH** on each check (real-time verification)
- Expiry checking: `expires_at` field automatically evaluated
- **Storage Strategy**: Persisted to `SecureStorage` (encrypted)
- Offline: Caches last known values with expiry metadata
- Clock manipulation detection: Denies access if device time is invalid

```
AppKernel Startup (Phase 3: appReady)
    ↓
FeatureFlagsManager.initialize(supabaseClient, userId)
FeatureFlagsManager.verifyDeviceClock()
FeatureFlagsManager.bootstrapFlags() [fetch flags + user overrides, ONE-TIME, non-blocking]
    ↓
Supabase REST API → feature_flags table + feature_flag_overrides table (per-user)
    ↓
SecureStorage: Store flags + overrides + timestamp (encrypted)
    ↓
Bridge Phase (automatic, in AppKernel):
  FeatureFlags.syncFromServer(serverFlags)  → Legacy system sees server values
  logger.reconfigure(debugLogsEnabled)       → Logger respects remote debugLogs flag
    ↓
Runtime Checks (getFlag, getEntitlement)
    ↓
Components/Services use hooks: useFeatureFlags(), useFeatureFlag(), useEntitlement()
```

### Merge Priority (Override > Entitlement > Flag)

**Feature Flag Resolution:**

1. **Remote Override** (highest) – Per-user admin-controlled override (can enable/disable any flag)
2. **Local Override** – In-memory admin testing override (for debugging)
3. **Server Flag** – Global feature flag (applies to all users)
4. **Hardcoded Default** – Fallback from `appsettings.*.json`

**Entitlement Resolution:**

1. **Override** (if set) – Admin override (rarely needed)
2. **Fresh Server Check** – Real-time entitlement fetch from `entitlements` table
3. **Cached Value** – Last known value (when offline or on error)
4. **Default: Denied** – Fail-secure

**Example:** If admin sets a remote override for user "admin-controlled-flag" to `enabled: true`, all checks for that flag will return `true` regardless of the global flag state.

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

#### Server Sync Bridge

**`syncFromServer(serverFlags: Record<string, { enabled: boolean; kind?: string; description?: string }>): void`**

Bulk-updates the legacy flag map from server-synced values and notifies listeners once.
Called automatically by `AppKernel` after `FeatureFlagsManager.bootstrapFlags()` so that components using the `useFeatureFlag` hook see server-resolved values.

```typescript
// Typically called automatically in the kernel—no manual invocation needed.
const serverFlags = FeatureFlagsManager.getAllFlags();
FeatureFlags.syncFromServer(serverFlags);
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

**`async initialize(supabaseClient: SupabaseClient, userId?: string): Promise<void>`**

Initializes the manager with a Supabase client and optional user ID. Called automatically by `AppKernel` during Phase 3 (appReady).

User ID is used to fetch per-user remote overrides during `bootstrapFlags()`.

```typescript
import { FeatureFlagsManager } from "@/lib/feature-flags";
const { getSupabaseClient } = await import("@/lib/database/supabase");

// With user ID (recommended for authenticated users)
await FeatureFlagsManager.initialize(getSupabaseClient(), userId);

// Without user ID (anonymous)
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

Fetches feature flags **and per-user remote overrides** from server **once** at app startup. Server values overwrite hardcoded config. Remote overrides take precedence over server values. Non-blocking; logs errors but never throws.

Overrides are automatically filtered for:

- `revoked = false` – Active overrides only
- `expires_at IS NULL OR expires_at > now()` – Not expired

```typescript
// Called automatically by AppKernel, but can be called manually for refresh
await FeatureFlagsManager.bootstrapFlags();
```

**`getFlag(name: string, fallback?: boolean): boolean`**

Synchronous check of a feature flag. Returns cached value from bootstrap, or fallback if not found.

**Priority (merge logic):** Remote Override → Local Override → Server Flag → Hardcoded → Fallback

- Remote Override takes precedence for admin-controlled per-user feature toggling
- Server Flag is the global default (applies to all users)

```typescript
const enabled = FeatureFlagsManager.getFlag("darkModeV2", false);
if (enabled) {
  // Use new dark mode (either via remote override or server value)
}
```

**`isEnabledWithContext(flagName: string, context?: FlagContext): boolean`** ✨ **Phase 1 New**

Synchronous check of a feature flag with **conditions** (platform, environment, userRole) and **dependencies** (soft flag dependencies). Returns `true` only if:

1. Flag is enabled in current state
2. **All conditions match** (AND logic: platform, environment, and userRole all must pass)
3. **All dependencies are enabled** (recursively evaluated with same context)

**Parameters:**

- `flagName`: Name of the flag to check
- `context`: Optional runtime context with `platform`, `environment`, `userRole`

**When to use:**

- **Platform-specific features** (e.g., gesture controls on touch devices only)
- **Environment-gated features** (e.g., debug panel in development only)
- **Role-based features** (e.g., admin-only tools)
- **Feature dependencies** (e.g., advanced maps requires map engine)
- **Combinations** of the above (e.g., premium admin tools on web production only)

**Examples:**

```typescript
// Platform-specific: gesture controls only on mobile
const gesturesEnabled = FeatureFlagsManager.isEnabledWithContext('gestureControls', {
  platform: 'ios' // or getPlatformName()
});

// Environment-specific: debug panel in development only
const debugEnabled = FeatureFlagsManager.isEnabledWithContext('debugPanel', {
  environment: 'development' // or getAppConfig().environment
});

// Role-based: admin tools for admins only
const adminTools = FeatureFlagsManager.isEnabledWithContext('adminPanel', {
  userRole: 'admin'
});

// Combined: advanced maps (requires map engine, web only, production only)
const advancedMapsEnabled = FeatureFlagsManager.isEnabledWithContext('advancedMaps', {
  platform: 'web',
  environment: 'production',
  userRole: currentUserRole
});

// If no context provided, uses defaults from config/platform detection
const defaultContextResult = FeatureFlagsManager.isEnabledWithContext('simpleFeature', {});
```

**Config schema (appsettings.*.json):**

```json
{
  "featureFlags": {
    "gestureControls": {
      "enabled": true,
      "description": "Swipe and pinch gesture support",
      "conditions": {
        "platform": "ios"
      }
    },
    "advancedMaps": {
      "enabled": true,
      "description": "Advanced map features",
      "dependsOn": ["mapEngine"],
      "conditions": {
        "platform": "web",
        "environment": "production"
      }
    },
    "adminPanel": {
      "enabled": true,
      "description": "Admin tools",
      "conditions": {
        "userRole": "admin"
      }
    }
  }
}
```

**Startup validation:**

- ✅ Detects **missing dependencies** at bootstrap (soft warn, doesn't crash)
- ✅ Detects **circular dependencies** and logs warning (e.g., A→B→A)
- ✅ Non-blocking: all checks are soft (warnings only)

**Performance:**

- Synchronous, fast (memoized within single call to avoid redundant work)
- Depends are cached at startup
- Recommended: use in selectors/computed values, not per-render (like any flag check)
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

### Phase 2: Cache & Entitlements API

✨ **New in Phase 2**

**`getCachedUserRole(): string`**

Returns the current user's role from cached entitlements. Useful for role-based feature flag conditions when the context doesn't explicitly provide a role.

**How it works:**

1. Queries cached entitlements (populated at bootstrap) for known role keys: `admin`, `moderator`, `premium_user`, `vip`
2. Skips expired entitlements (checks `expires_at`)
3. Returns the first matching active role, or `"unknown"` if none found

**When to use:**

- In role-based flag conditions when you want to use cached role data
- Combined with `isEnabledWithContext()` for automatic role detection
- As a fallback when `userRole` is not explicitly provided in context

**Example:**

```typescript
// Get cached user role from entitlements
const userRole = FeatureFlagsManager.getCachedUserRole();
console.log(`User role: ${userRole}`); // "admin", "premium_user", or "unknown"

// Use in flag evaluation without explicitly passing role
const advancedEnabled = FeatureFlagsManager.isEnabledWithContext('advancedFeature', {
  platform: 'web',
  environment: 'production'
  // userRole will be auto-detected via getCachedUserRole() if not provided
});

// Or explicitly use the cached role
const hasAdminTools = FeatureFlagsManager.isEnabledWithContext('adminPanel', {
  userRole: FeatureFlagsManager.getCachedUserRole()
});
```

**`invalidateFlagCache(flagName: string): void`**

Invalidate all cache entries for a specific flag. Call this when a flag's configuration changes on the server.

**When to call:**

- After receiving a server update for a flag
- When flag conditions or dependencies change
- During config hot-reload scenarios

**Example:**

```typescript
// Admin updates flag config on server
FeatureFlagsManager.invalidateFlagCache('advancedMaps');

// Next flag check will re-evaluate conditions
const result = FeatureFlagsManager.isEnabledWithContext('advancedMaps', context);
```

**`invalidateRoleCache(userRole: string): void`**

Invalidate all cache entries for a specific user role. Call this when a user's role or entitlements change.

**When to call:**

- User role changes (e.g., promotion, subscription activated)
- New entitlements are granted to a role
- After refreshing entitlements from server

**Example:**

```typescript
// User upgraded to premium
const newRole = 'premium_user';
FeatureFlagsManager.invalidateRoleCache('free_user'); // Invalidate old role
FeatureFlagsManager.invalidateRoleCache(newRole); // Invalidate new role

// Or invalidate current role
FeatureFlagsManager.invalidateRoleCache(FeatureFlagsManager.getCachedUserRole());
```

**`clearEvaluationCache(): void`**

Clear all cached evaluation results. Use sparingly — typically only on user logout or major app resets.

**When to call:**

- User logs out (clear all cached role-based flags)
- Major app state change or reset
- After changing multiple flag configs at once

**Example:**

```typescript
// On user logout
async function handleLogout() {
  await logout();
  FeatureFlagsManager.clearEvaluationCache(); // Clear all role-based caches
  // Navigate to login screen
}
```

**`getEvaluationCacheStats(): CacheStats`**

Get cache statistics for monitoring and debugging.

**Returned stats:**

```typescript
interface CacheStats {
  size: number;           // Current number of entries
  maxSize: number;        // Maximum allowed entries
  loadFactor: number;     // size / maxSize (0.0 to 1.0)
  ttlMs: number;          // Time-to-live in milliseconds
  hits: number;           // Total cache hits
  misses: number;         // Total cache misses
  hitRate: number;        // hits / (hits + misses)
}
```

**Example:**

```typescript
const stats = FeatureFlagsManager.getEvaluationCacheStats();

console.log(`Cache hit rate: ${(stats.hitRate * 100).toFixed(1)}%`); // e.g., "72.5%"
console.log(`Cache fullness: ${(stats.loadFactor * 100).toFixed(1)}%`); // e.g., "45.3%"  
console.log(`Cache entries: ${stats.size}/${stats.maxSize}`); // e.g., "116/256"

// Use for monitoring/alerting
if (stats.hitRate < 0.5) {
  logger.warn("feature_flags", "Low cache hit rate detected");
}
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

- `lib/database/feature-flags.ts` – `fetchFeatureFlags()` REST query helper
- `lib/database/entitlements.ts` – `fetchEntitlementsByUserId()`, `hasEntitlement()` REST query helpers
- `lib/storage/SecureStorage` – Encrypted persistence for flags and entitlements (single storage layer, versioned)
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

6. **Rollout Targeting**: ✅ **Implemented** - Use `evaluateRollout()` for percentage-based user bucketing. Deterministic hashing ensures same user always sees same variant.

## Cohorts (Phase 1) — 🆕 **NEW**

Cohorts are named user groups for feature targeting and gradual rollouts. They enable safe, staged feature deployment without redeployment.

### What are Cohorts?

A cohort is a logical grouping of users defined by:
- **Deterministic bucketing** (Phase 1): Users are automatically assigned to cohorts using FNV-hash bucketing based on their user ID
- **Explicit membership** (Phase 2): Admins can manually assign users to cohorts via database entries
- **Safe rebalancing** (seed parameter): Change rollout percentage without re-bucketing existing users

### Recommended Cohorts

```typescript
import { RECOMMENDED_COHORTS, type CohortDef } from '@/lib/feature-flags';

// Pre-configured cohorts suitable for most rollout scenarios
const betaTesters = RECOMMENDED_COHORTS.beta_testers;    // 20% deterministic
const enterprise = RECOMMENDED_COHORTS.enterprise;        // 100% of users
const internal = RECOMMENDED_COHORTS.internal;            // 100% dogfooding
const mobileFirst = RECOMMENDED_COHORTS.mobile_first;     // 100% (use with platform condition)
const desktopFirst = RECOMMENDED_COHORTS.desktop_first;   // 100% (use with platform condition)
```

### Cohort Definition

```typescript
interface CohortDef {
  slug: string;         // Public cohort identifier (e.g., "beta_testers")
  name: string;         // Display name (e.g., "Beta Testers")
  description?: string; // Human-readable description
  percentage?: number;  // 0-100; ~X% of users in cohort (undefined = 100%)
  seed?: string;        // Optional seed for rebalancing (null/undefined = default)
  metadata?: object;    // Arbitrary metadata (Phase 2+)
}

> Note: `CohortDef.slug` is the client-facing identifier used by the SDK and
> deterministic bucketing (hashing). The database also stores an internal
> UUID `id` for relations (`cohorts.id`). Client APIs and examples below use
> the `slug` string (stable and human-readable). Server-side code and DB
> relations use the UUID `id` where appropriate.
```

### Phase 1: Using Cohorts with Deterministic Bucketing

In Phase 1, cohorts are **local-only** (no database required). Users are bucketed deterministically based on their user ID:

```typescript
import { isUserInCohort, RECOMMENDED_COHORTS } from '@/lib/feature-flags';

export function MyComponent() {
  const userId = useUserId();
  
  // Check if user is in beta_testers cohort (~20% of users)
  const isBetaTester = isUserInCohort(
    userId,
    "beta_testers",
    RECOMMENDED_COHORTS.beta_testers
  );

  return isBetaTester ? <BetaFeature /> : <StableFeature />;
}
```

**Important:** Same user always gets same result. Deterministic bucketing uses FNV-hash(userId + cohortId + seed) % 100 < percentage.

### Phase 1 Example: Gradual Rollout with Rebalancing

Safe rollout pattern using seed field (percentage increases without losing existing users):

```typescript
// Day 1: Roll out to 10% of users
const day1Cohort: CohortDef = {
  id: "advanced_maps",
  percentage: 10,
  seed: "v1"  // Seed for rebalancing
};

// Existing users in 10% cohort still in cohort (same seed)
const user1InCohort = isUserInCohort(userId1, "advanced_maps", day1Cohort); // ✅ Still true

// Day 2: Expand to 50% (same seed keeps existing users)
const day2Cohort: CohortDef = {
  id: "advanced_maps",
  percentage: 50,
  seed: "v1"  // Same seed = existing users keep same status
};

// Existing users not re-bucketed
const user1StillInCohort = isUserInCohort(userId1, "advanced_maps", day2Cohort); // ✅ Still true

// Day 3: Full rollout
const day3Cohort: CohortDef = {
  id: "advanced_maps",
  percentage: 100,
  seed: "v1"
};

const user1FullyRolled = isUserInCohort(userId1, "advanced_maps", day3Cohort); // ✅ True
```

### Phase 2: Explicit Admin Overrides

In Phase 2 (when database migration is applied), you can override deterministic bucketing:

```typescript
// Phase 2: Future API
const explicitMemberships = ["qa_special", "beta_testers"]; // From user_cohort_memberships table
const adminOverride = isUserInCohort(
  userId,
  "qa_special",
  cohortDef,
  explicitMemberships  // Explicit memberships have highest priority
);

// Admin assigned this user to qa_special cohort → always true (overrides deterministic)
```

### Combining Cohorts with Conditions (Phase 3)

In Phase 3, you can combine cohort membership with advanced conditions:

```json
{
  "featureFlags": {
    "advancedMaps": {
      "enabled": true,
      "conditionLogic": {
        "operator": "AND",
        "conditions": [
          { "type": "cohort", "value": "beta_testers" },
          { "type": "platform", "value": "web" }
        ]
      }
    }
  }
}
```

This flag is enabled only if BOTH:
- User is in "beta_testers" cohort (20% of users via bucketing), AND
- Platform is "web"

### API Reference: Cohorts

**`isUserInCohort(userId, cohortId, cohortDef, explicitMemberships?): boolean`**

Evaluate if a user is in a cohort.

```typescript
import { isUserInCohort } from '@/lib/feature-flags';

const inCohort = isUserInCohort(
  "user-123",
  "beta_testers",
  { slug: "beta_testers", percentage: 20 }
);

if (inCohort) {
  // User is in beta_testers cohort
}
```

**`RECOMMENDED_COHORTS`**

Pre-configured cohort definitions:

```typescript
import { RECOMMENDED_COHORTS } from '@/lib/feature-flags';

const cohorts = [
  RECOMMENDED_COHORTS.beta_testers,   // 20%
  RECOMMENDED_COHORTS.enterprise,     // 100%
  RECOMMENDED_COHORTS.internal,       // 100%
  RECOMMENDED_COHORTS.mobile_first,   // 100%
  RECOMMENDED_COHORTS.desktop_first   // 100%
];
```

### Seed Rebalancing Pattern

✨ **Key Feature:** Safe percentage increases without user churn

**How It Works:**

```
Bucket range: 0-99

Day 1 (10% cohort, seed="v1"):
hash(userId + "advanced_maps" + "v1") % 100 → [0-9] ✅ In cohort

Day 2 (50% cohort, same seed="v1"):
hash(userId + "advanced_maps" + "v1") % 100 → [0-49] ✅ Still in cohort
New users [10-49] are added to cohort

Day 3 (100% cohort):
hash(...) → [0-99] ✅ All users in cohort

If seed changes (e.g., "v1" → "v2"):
hash(userId + "advanced_maps" + "v2") % 100 → Different bucket
Users may move to different cohort → ⚠️ Be careful!
```

**Best Practice:** Change seed only when you want to re-bucket users (e.g., rebalance test group).

### Testing Cohorts

**Unit Test Example:**

```typescript
import { isUserInCohort } from '@/lib/feature-flags';

describe('Cohorts', () => {
  it('should bucket users deterministically', () => {
    const cohort = { slug: "test", percentage: 50 };
    const userId = "user-123";

    const result1 = isUserInCohort(userId, "test", cohort);
    const result2 = isUserInCohort(userId, "test", cohort);

    expect(result1).toBe(result2); // Same result every time
  });

  it('should keep users in cohort when percentage increases', () => {
    const userId = "user-123";
    const seed = "v1";

    const cohort10 = { slug: "test", percentage: 10, seed };
    const cohort50 = { slug: "test", percentage: 50, seed };

    const inSmall = isUserInCohort(userId, "test", cohort10);
    if (inSmall) {
      const inLarge = isUserInCohort(userId, "test", cohort50);
      expect(inLarge).toBe(true); // Still in larger cohort
    }
  });

  it('should allow admin overrides', () => {
    const cohort = { slug: "test", percentage: 0 }; // 0% via bucketing
    const explicitMemberships = ["test"];

    const result = isUserInCohort(
      "user-123",
      "test",
      cohort,
      explicitMemberships
    );

    expect(result).toBe(true); // Override forces membership
  });
});
```

### Common Patterns

**Pattern 1: Canary Release (1% → 10% → 100%)**

```typescript
// Day 1
const canary: CohortDef = { slug: "feature", percentage: 1, seed: "release" };

// Day 2
const earlyAdopt: CohortDef = { slug: "feature", percentage: 10, seed: "release" };

// Day 3
const fullRelease: CohortDef = { slug: "feature", percentage: 100, seed: "release" };

// Same seed ensures no user churn
```

**Pattern 2: A/B Testing (50/50 Split)**

```typescript
const variantA: CohortDef = { slug: "ui_variant_a", percentage: 50, seed: "experiment_1" };
const variantB: CohortDef = { slug: "ui_variant_b", percentage: 50, seed: "experiment_1" };

const isVariantA = isUserInCohort(userId, "ui_variant_a", variantA);
const isVariantB = isUserInCohort(userId, "ui_variant_b", variantB);

// ~50% users in each variant (deterministic split)
```

**Pattern 3: Platform-Specific Features**

```typescript
const mobileFeature: CohortDef = { slug: "mobile_feature", percentage: 100 };
const desktopFeature: CohortDef = { slug: "desktop_feature", percentage: 100 };

// Combined with condition (Phase 3):
// isEnabled IF (cohort=mobile_feature AND platform=ios/android)
```

### Security Considerations

- **No Secrets**: Cohort IDs are shared with client. Never use cohort IDs to distribute secrets.
- **Deterministic**: Same user always gets same bucketing (not random). Use for gradual rollouts, not security gates.
- **Admin Overrides Only**: Explicit membership can only be set by admins (via database RLS in Phase 2).
- **Server-Side Validation**: Always validate cohort membership on backend if used for premium features.

### Performance Notes

- **Bucketing**: O(1) — FNV hash computation is fast, memoized by default
- **Cohort Checks**: ~0.1ms per check (after memoization)
- **Memory**: Negligible (cohort definitions are small objects)

### Security Considerations

- **No Secrets**: Feature flags are config-driven and visible in client code. Never store secrets in flag definitions.
- **Server-Side Gating**: Always validate feature access on the backend as well (flags alone are insufficient for security).
- **Premium Flags**: Combine with `SubscriptionManager` verification for actual payment gating (flags alone don't enforce).

## Performance Notes

- **Startup**: O(1) for flag checks after initialization (Map-based lookup)
- **Memory**: Negligible (flags typically 10-50 keys, each a few bytes)
- **React Re-Renders**: `useFeatureFlag` hook adds subscription listener; optimize with memoization if called many times
- **No Network**: Config is loaded at build-time; zero runtime network calls

### Phase 2: LRU Cache for `isEnabledWithContext` Results

✨ **New in Phase 2:** Results from `isEnabledWithContext()` are automatically cached using a lightweight LRU cache with TTL support.

**Why Cache?**

- Repeated checks of the same flag with the same context (platform, environment, role) no longer re-evaluate conditions and dependencies
- Conditions and dependencies can be expensive (role lookups, tree traversal)
- Cache hit rate typically 70-90% in production apps

**How It Works:**

```typescript
import { FeatureFlagsManager } from "@/lib/feature-flags";

// First call: misses cache, evaluates all conditions
const result1 = FeatureFlagsManager.isEnabledWithContext('advancedMaps', {
  platform: 'web',
  environment: 'production',
  userRole: 'admin'
});

// Second call (same context): hits cache, instant return
const result2 = FeatureFlagsManager.isEnabledWithContext('advancedMaps', {
  platform: 'web',
  environment: 'production',
  userRole: 'admin'
}); // Returns cached result

// Different context: misses cache, new evaluation
const result3 = FeatureFlagsManager.isEnabledWithContext('advancedMaps', {
  platform: 'ios', // Different platform
  environment: 'production',
  userRole: 'admin'
}); // Not cached, evaluates fresh
```

**Cache Configuration:**

- **Size Limit**: 256 entries by default (configurable)
- **TTL**: 1 hour (3600 seconds, configurable)
- **Eviction**: LRU (least recently used entries removed when full)
- **Storage**: In-memory only (no persistence)

**Cache Key Signature:** `"flagName::platform::environment::userRole"`

Example keys:
- `"advancedMaps::web::production::admin"`
- `"gestureControls::ios::production::unknown"`

**Cache Invalidation:**

Manually invalidate cache when needed (e.g., after server updates, user role changes, or config changes):

```typescript
// Invalidate all cache entries for a flag (when flag definition changes)
FeatureFlagsManager.invalidateFlagCache('advancedMaps');

// Invalidate all entries for a user role (when role changes or new entitlements granted)
FeatureFlagsManager.invalidateRoleCache('admin');

// Clear ALL cache entries (use sparingly)
FeatureFlagsManager.clearEvaluationCache();

// Get cache statistics for monitoring
const stats = FeatureFlagsManager.getEvaluationCacheStats();
console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
console.log(`Entries: ${stats.size}/${stats.maxSize}`);
```

**When to Invalidate:**

- User role changes (subscription upgrade, admin promotion): `invalidateRoleCache(oldRole)`
- Flag config changes from server: `invalidateFlagCache(flagName)`
- User logout: `clearEvaluationCache()`
- Major app state change: `clearEvaluationCache()`

**Performance Impact:**

- **Cache Hit**: ~0.1ms (O(1) map lookup)
- **Cache Miss**: depends on conditions/dependencies (typically 1-5ms)
- **Invalidation**: O(n) where n = number of cache entries (but runs infrequently)

## Related Modules

- **lib/config** – Environment-aware configuration loading (used to load legacy feature flags)
- **lib/premium** – Subscription/tier management (combine with flags for premium gating)
- **lib/cache/QueryCache** – Request deduplication (Phase 2 enhancement)
- **lib/storage/SecureStorage** – Encrypted persistence for both flags (bootstrap only) and entitlements
- **lib/kernel/app-kernel** – Bootstrap clock verification and manager initialization
- **hooks/use-feature-flag** – Legacy hook for config-driven flags
- **hooks/use-feature-flags** – Server-synced flags hook
- **hooks/use-entitlements** – Premium entitlement status hook

## Phase 3: Advanced Conditions & Tooling ✨ **NEW**

Phase 3 adds expressive condition logic, a plugin system for custom evaluators, and comprehensive admin tooling.

### Advanced Condition Logic

Conditions now support nested logical operators (AND, OR, NOT) instead of just AND:

**Simple Conditions (Phase 1):**

```json
{
  "featureFlags": {
    "advancedMaps": {
      "enabled": true,
      "conditions": {
        "platform": "web",
        "environment": "production"
      }
    }
  }
}
```

**Advanced Conditions (Phase 3):**

```json
{
  "featureFlags": {
    "advancedMaps": {
      "enabled": true,
      "conditionLogic": {
        "operator": "AND",
        "conditions": [
          { "type": "platform", "value": "web" },
          {
            "operator": "OR",
            "conditions": [
              { "type": "userRole", "value": "admin" },
              { "type": "userRole", "value": "premium_user" }
            ]
          },
          {
            "type": "time",
            "config": {
              "dayOfWeek": [1, 2, 3, 4, 5],
              "hour": [9, 17]
            }
          }
        ]
      }
    }
  }
}
```

**Supported Operators:**

- `AND`: All conditions must be true (short-circuit on first false)
- `OR`: At least one condition must be true (short-circuit on first true)
- `NOT`: Condition must be false (unary operator)

**Supported Built-In Conditions:**

- `platform`: 'web' | 'ios' | 'android' | 'desktop'
- `environment`: 'development' | 'production'
- `userRole`: String (matches cached entitlements)
- `time`: Date/time-based with params: `hour`, `dayOfWeek`, `startDate`, `endDate`
- `custom`: Plugin-based evaluator (see Plugin System below)

**Time Condition Examples:**

```json
{
  "type": "time",
  "config": {
    "hour": 14        // Exact hour (2 PM)
  }
}
```

```json
{
  "type": "time",
  "config": {
    "hour": [9, 17]   // Range: 9 AM to 5 PM
  }
}
```

```json
{
  "type": "time",
  "config": {
    "dayOfWeek": [1, 2, 3, 4, 5],  // Monday-Friday
    "hour": [9, 17]
  }
}
```

```json
{
  "type": "time",
  "config": {
    "startDate": "2024-12-25T00:00:00Z",
    "endDate": "2024-12-31T23:59:59Z"   // Holiday period
  }
}
```

### Plugin System for Custom Evaluators

Register custom condition evaluators for domain-specific logic:

```typescript
import { pluginRegistry } from "@/lib/feature-flags/advanced-conditions";

// Register a plugin for user attributes
pluginRegistry.register({
  name: "userAttribute:department",
  matcher: (type, evaluator) => 
    type === "custom" && evaluator === "userAttribute:department",
  evaluate: (condition, context) => {
    const userDept = getUserDepartment(); // Your logic
    return userDept === condition.config?.value;
  }
});

// Now use in config:
{
  "conditionLogic": {
    "operator": "AND",
    "conditions": [
      {
        "type": "custom",
        "evaluator": "userAttribute:department",
        "config": { "value": "engineering" }
      }
    ]
  }
}
```

**Registering Plugins at Bootstrap:**

```typescript
// In lib/kernel/app-kernel.ts or during AppKernelProvider setup

import { pluginRegistry } from "@/lib/feature-flags/advanced-conditions";

export function registerFeatureFlagPlugins() {
  // Example: Time zone-based condition
  pluginRegistry.register({
    name: "timeZone",
    matcher: (type, evaluator) => type === "custom" && evaluator === "timeZone",
    evaluate: (condition, context) => {
      const userTz = getUserTimeZone();
      const allowedTzs = condition.config?.allowedTzs ?? [];
      return allowedTzs.includes(userTz);
    }
  });

  // Example: Feature percentage rollout (beyond simple rollouts)
  pluginRegistry.register({
    name: "percentageRollout",
    matcher: (type, evaluator) => type === "custom" && evaluator === "percentageRollout",
    evaluate: (condition, context) => {
      const percentage = condition.config?.percentage ?? 0;
      return Math.random() * 100 < percentage;
    }
  });
}
```

### Admin Tooling

Phase 3 includes comprehensive admin tools for debugging and monitoring:

**Config Validation:**

```typescript
import { validateFlagConfig } from "@/lib/feature-flags/admin-tooling";

const issues = validateFlagConfig();
// Returns array of:
// - Errors (missing dependencies, invalid syntax)
// - Warnings (naming conventions, performance concerns)
// - Info (unused flags, complexity notes)

for (const issue of issues) {
  console.log(`[${issue.type}] ${issue.flag}: ${issue.message}`);
  if (issue.suggestion) {
    console.log(`  Suggestion: ${issue.suggestion}`);
  }
}
```

**Dependency Graph Visualization:**

```typescript
import { visualizeDependencyGraph } from "@/lib/feature-flags/admin-tooling";

const graph = visualizeDependencyGraph(maxDepth = 5);
console.log(graph);
// Output:
// Feature Flag Dependency Graph
// ===========================
//
// Depth 0:
//   ✅ mapEngine [free]
//   ❌ advancedUI [premium] 🔧
//     depends on: mapEngine
//
// Depth 1:
//   ✅ advancedMaps [premium]
//     depends on: mapEngine
```

**Context Simulation & Testing:**

```typescript
import { simulateContexts } from "@/lib/feature-flags/admin-tooling";

const contexts = [
  { platform: "web", environment: "production", userRole: "admin" },
  { platform: "ios", environment: "production", userRole: "user" },
  { platform: "web", environment: "development" },
];

const results = simulateContexts("advancedMaps", contexts);
for (const result of results) {
  console.log(`${result.flag}: ${result.enabled ? "✅" : "❌"}`);
  console.log(`  Reason: ${result.reason}`);
  console.log(`  Eval time: ${result.evaluationMs.toFixed(2)}ms`);
}
```

**Flag Impact Analysis:**

```typescript
import { analyzeFlagImpact } from "@/lib/feature-flags/admin-tooling";

const analysis = analyzeFlagImpact("mapEngine");
console.log(`Flag: ${analysis.flag}`);
console.log(`Complexity: ${analysis.complexity}`); // simple | moderate | complex
console.log(`Affected flags: ${analysis.affectedFlags.join(", ")}`);
console.log(`Risk: ${analysis.riskOfDisabling}`);
```

### Telemetry & Monitoring

Track condition evaluations, cache performance, and flag usage:

```typescript
import { featureFlagsTelemetry, performHealthCheck } from "@/lib/feature-flags/telemetry";

// Telemetry is automatically collected during normal operation
// Access stats anytime:

const stats = featureFlagsTelemetry.getFlagStats("advancedMaps");
console.log(`Evaluations: ${stats.conditionEvaluations}`);
console.log(`Avg time: ${stats.avgEvaluationTimeMs.toFixed(2)}ms`);
console.log(`Failure rate: ${(stats.failureRate * 100).toFixed(1)}%`);

// Cache stats:
const cacheStats = featureFlagsTelemetry.getCacheStats();
console.log(`Hit rate: ${(cacheStats.hitRate * 100).toFixed(1)}%`);

// Health check:
const health = performHealthCheck();
if (!health.healthy) {
  console.warn("Issues detected:", health.issues);
  console.log("Suggestions:", health.suggestions);
}

// Export for monitoring services:
const report = featureFlagsTelemetry.generateReport();
console.log(JSON.stringify(report, null, 2));
```

### Validation & Safety

Phase 3 validates advanced conditions at config load time:

- **Syntax validation**: Ensures operators, conditions, and nesting are valid
- **Circular ref detection**: Prevents infinite recursion in nested expressions
- **Depth limiting**: Max default recursion depth is 10 (configurable for testing)
- **Unknown condition handling**: Defaults to false if condition type unknown
- **Plugin failure handling**: Plugins that can't evaluate default to false (fail-secure)

All validation is logged via the `feature_flags` logger category.

## File Breakdown

| File                      | Purpose                                          | Exported | Lines |
| ------------------------- | ------------------------------------------------ | -------- | ----- |
| feature-flags.ts          | Legacy `FeatureFlags` class, config toggles     | ✅ | ~130  |
| server-sync.ts            | `FeatureFlagsManager`, entitlements, overrides  | ✅ | ~1700 |
| rollout.ts                | Percentage-based rollouts                       | ✅ | ~100  |
| cohorts.ts                | Cohort types & deterministic bucketing (Phase 1)| ✅ | ~300  |
| conditions.ts             | Phase 1: Simple condition evaluators (internal) | ❌ | ~144  |
| advanced-conditions.ts    | Phase 3: Logic operators, plugins (internal)   | ❌ | ~360  |
| cache.ts                  | Phase 2: LRU evaluation cache (internal)        | ❌ | ~280  |
| admin-tooling.ts          | Phase 3: Validation, graphs, simulation         | ❌ | ~380  |
| telemetry.ts              | Phase 3: Monitoring, health checks, metrics     | ❌ | ~370  |
| index.ts                  | Public API barrel export                        | — | 20    |
| README.md                 | This file                                        | — | ~1600 |

**Public Exports from index.ts:**
- `FeatureFlags`, `FeatureFlag`, `FeatureFlagKind`, `FeatureFlagName`
- `FeatureFlagsManager`, `EntitlementState`, `FeatureFlagState`, `FlagsSubscriber`
- `bucketPercent`, `clearBucketCache`, `getBucketMemoized`, `isInRollout`, `isInRolloutMemoized`, `RolloutConfig`
- `isUserInCohort`, `RECOMMENDED_COHORTS`, `CohortDef`, `CohortRow`, `CohortFlagAssignmentRow`, `UserCohortMembershipRow`

**Internal Modules** (not exported; used internally by manager and hooks):
- `conditions.ts` – Used by `FeatureFlagsManager._resolveFlag()`
- `advanced-conditions.ts` – Used by condition evaluation pipeline
- `cache.ts` – Used by `FeatureFlagsManager` for LRU evaluation caching
- `admin-tooling.ts` – Used by admin debug tools and simulation utilities
- `telemetry.ts` – Used by `FeatureFlagsManager` for monitoring

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
- ✅ Simple condition evaluators (platform, environment, userRole)
- ✅ Dependency resolver with circular reference detection

**Phase 2** — ✅ **COMPLETE**

- ✅ LRU evaluation result caching for performance
- ✅ Cache invalidation on flag updates and role changes
- ✅ Cached entitlements lookup (getCachedUserRole)
- ✅ Cache statistics and monitoring (hit rates, size tracking)
- ✅ Graceful memory management (max 1000 cached results per category)

**Phase 3** — ✅ **COMPLETE**

- ✅ Advanced condition logic (nested AND/OR/NOT operators)
- ✅ Plugin system for custom condition evaluators
- ✅ Time-based conditions (hour, dayOfWeek, date ranges)
- ✅ Admin tooling suite (validation, dependency graphs, simulation)
- ✅ Context simulation for testing flag behavior
- ✅ Flag impact analysis (affectedFlags, complexity, risk)
- ✅ Dependency graph visualization for debugging
- ✅ Comprehensive telemetry system (condition evals, cache ops, usage tracking)
- ✅ Health checks and performance monitoring
- ✅ Safe evaluation (recursion depth limits, validation at bootstrap)

## Cohorts vs. Conditions vs. Rollouts — Decision Guide

### Quick Comparison Table

| Feature | **Conditions** | **Cohorts** | **Rollouts** |
|---------|---|---|---|
| **What it does** | Matches context (platform, environment, role) | Targets user groups by membership or percentage | Percentage-based gradual deployment |
| **Use case** | "Only on web" / "Only for admins" | "Only beta testers" / "Enterprise only" | "Roll out to 10%, 50%, then 100%" |
| **Requires userId** | ❌ No | ✅ Yes | ✅ Yes |
| **Deterministic** | ✅ Yes (same context = same result) | ✅ Yes (same user = same result) | ✅ Yes (same user = same result) |
| **Admin override** | ❌ No | ✅ Yes (explicit membership) | ❌ No (percentage-based) |
| **Multiple values** | ❌ No (AND logic) | ✅ Yes (OR logic, user in ANY) | ❌ No (single percentage) |
| **Config** | `conditions: { platform, environment, userRole }` | `cohorts: ["beta_testers", "enterprise"]` | % via cohort or rollout |
| **Scalability** | High (fast context match) | High (cached, RLS-filtered) | High (deterministic hash) |

### Decision Tree: Which Should I Use?

```
┌─ Does the flag depend on REQUEST CONTEXT?
│  (platform, environment, role, feature flags, entitlements)
│  
│  YES → Use CONDITIONS
│  ├─ Example: "advancedMaps only on web, for premium users"
│  │ conditions: { platform: "web", userRole: "premium" }
│  │
│  └─ Combine with cohorts for targeting:
│     "advancedMaps for web + premium users in beta cohort"
│     conditions: { platform: "web", userRole: "premium" }
│     cohorts: ["beta_testers"]
│  
│  NO → Continue...
│
└─ Does the flag target specific NAMED USER GROUPS?
   (beta testers, enterprise tier, internal staff, regions)
   
   YES → Use COHORTS
   ├─ Example: "betaFeature only for beta testers"
   │ cohorts: ["beta_testers"]
   │
   ├─ Multiple cohorts (user in ANY):
   │ "advancedMaps for beta OR enterprise customers"
   │ cohorts: ["beta_testers", "enterprise"]
   │
   └─ With gradual rollout + seed:
      "Roll out to 10% of beta testers, then 50%, then 100%"
      cohorts: ["gradual_rollout"] with percentage + seed
   
   NO → Continue...

└─ Are you doing a GRADUAL ROLLOUT by percentage?
   (Start with 10%, expand to 50%, then 100%)
   
   YES → Use COHORTS with SEED parameter
   ├─ Day 1: { slug: "feature", percentage: 10, seed: "v1" }
   ├─ Day 2: { slug: "feature", percentage: 50, seed: "v1" }
   └─ Day 3: { slug: "feature", percentage: 100, seed: "v1" }
   
   NO → Feature is GLOBALLY ENABLED
   └─ Don't add cohorts or conditions
       enabled: true
```

### Detailed Guidance

#### When to Use CONDITIONS

**✅ Use conditions when:**
- Feature depends on context (current platform, environment, user role, entitlements)
- You need to gate features by permission/tier
- You want fast, context-based toggles without user data

**Example: Role-Based Feature**
```json
{
  "featureFlags": {
    "advancedSettings": {
      "enabled": true,
      "conditions": {
        "platform": "web",
        "userRole": "admin"
      }
    }
  }
}
```

**Example: Premium + Regional**
```typescript
const enabled = FeatureFlagsManager.isEnabledWithContext("premiumFeature", {
  platform: "web",
  environment: "production",
  userRole: "premium_subscriber"
});
```

#### When to Use COHORTS

**✅ Use cohorts when:**
- You want to gate features by named user groups (beta testers, enterprise, internal)
- You need admin-controlled explicit membership overrides
- You want deterministic bucketing without permissions/roles
- You're doing gradual rollouts to subsets of users

**Example: Beta Testers Only**
```json
{
  "featureFlags": {
    "betaFeature": {
      "enabled": true,
      "cohorts": ["beta_testers"]
    }
  }
}
```

**Example: Multiple Cohorts (OR logic)**
```json
{
  "featureFlags": {
    "advancedMaps": {
      "enabled": true,
      "cohorts": ["beta_testers", "enterprise"]
    }
  }
}
```
User qualifies if in beta_testers OR enterprise.

**Example: Gradual Rollout**
```typescript
// Day 1: 10% of internal staff
const cohort = {
  slug: "internal_staff",
  percentage: 10,
  seed: "rollout_v1"
};

// Day 2: Expand to 50% (same users stay in)
const cohort = {
  slug: "internal_staff",
  percentage: 50,
  seed: "rollout_v1"  // Same seed = consistent
};
```

#### When to Use BOTH (Conditions + Cohorts)

**✅ Use both when:**
- Feature needs context matching AND user group targeting
- Example: "Advanced maps for web users in beta cohort"
- Example: "Enterprise-only feature on iOS and Android"

**Example: Web + Beta Testers**
```json
{
  "featureFlags": {
    "advancedMaps": {
      "enabled": true,
      "conditions": {
        "platform": "web"
      },
      "cohorts": ["beta_testers"]
    }
  }
}
```

**Example: Mobile + Enterprise**
```json
{
  "featureFlags": {
    "mobilePay": {
      "enabled": true,
      "conditions": {
        "platform": "ios|android"
      },
      "cohorts": ["enterprise"]
    }
  }
}
```

**Resolution (AND logic):**
User must match:
- ✅ Enabled flag
- ✅ Platform condition (web)
- ✅ Cohort membership (in beta_testers)

All three must be true for flag to enabled.

**Future Opportunities:**

- **Recurring Sync** – Background job to refresh flags/entitlements at configurable intervals (24h default)
- **UI Hooks Enhanced** – Better error handling and loading states in hooks
- **Admin Debug Screen** – Built-in UI to view cached flags, trigger refresh, inspect clock state
- **Per-User Rollout** – Gradual rollout of flags to user segments via percentage rollouts
- **A/B Testing Integration** – Link flag variants to user cohorts
- **Remote Condition Plugins** – Load custom evaluators from server (for non-dev platforms)
- **Condition Performance Profiling** – Identify slow conditions/plugins in production

