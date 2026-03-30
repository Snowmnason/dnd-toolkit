# Feature Flags Module

Triple-mode feature flag system: config-driven toggles for development, server-driven runtime flags for production, percentage-based rollouts for gradual deployment, and premium entitlements with clock safety.

## When to Use This Module

**Use this module for:**

- Development toggles (dev/test features via config without redeploy)
- Beta testing (flag experimental features; console warning in production)
- A/B testing and gradual rollouts (deterministic user bucketing)
- Premium entitlements (gate features by subscription tier)
- Runtime permission gates (disable features with server overrides)
- Graceful degradation (feature disable during maintenance)

**Do NOT use this module for:**

- User permission checks (use `lib/auth` or `lib/database` roles instead)
- Build-time configuration (use `lib/config` instead)
- Analytics events (use `lib/analytics` instead)

## Architecture & Data Flow

Three complementary subsystems:

### 1. Legacy Config-Driven (FeatureFlags)

```
appsettings.json/dev.json
        ↓
FeatureFlags.getAllFlags() [on init]
        ↓
In-memory map + runtime toggles
        ↓
Components check: isEnabled(), getKind(), toggle()
```

### 2. Server-Driven Runtime (FeatureFlagsManager)

```
Kernel FEATURE_FLAGS Phase
        ↓
FeatureFlagsManager.initialize(userId)
        ↓
verifyDeviceClock() [detect manipulation]
        ↓
bootstrapFlags() [fetch once at startup, cache with freshness]
        ↓
Timeout race: block briefly, continue in background if needed
        ↓
SecureStorage: persist flags + overrides + fetchedAt timestamp
        ↓
Bridge: syncFromServer(flags) → FeatureFlags [so legacy hooks see server values]
        ↓
Runtime checks: getFlag(), isEnabledWithContext()
```

**Freshness Model:** `fetchedAt` timestamp drives cache validity based on configured thresholds in `config/appsettings*.json` (`featureFlags.freshnessDays`, `featureFlags.staleDays`).
- fresh: fetched within `freshnessDays` (default 4 days) → use cached flags without delay
- stale: fetched between `freshnessDays` and `staleDays` (default 30 days) → attempt refresh, but continue with cached data if needed
- dead: fetched older than `staleDays` → fallback to hardcoded defaults + clear companion caches

**Merge Priority:** Per-User Override > Local Override > Server Flag > Hardcoded Default

### 3. Rollout System (Deterministic Bucketing)

```
User ID + Flag Name + Seed (hash)
        ↓
Deterministic hash bucket [0-100]
        ↓
Compare to rollout percentage
        ↓
User consistently in/out (same seed = same bucket always)
```

## API Reference

### FeatureFlags (Singleton, All Environments)

#### `isEnabled(name: string): boolean`

Check if flag is enabled.

```typescript
if (FeatureFlags.isEnabled("splashScreen")) { /* ... */ }
```

#### `getKind(name: string): 'free' | 'premium' | 'beta' | undefined`

Get flag classification.

```typescript
const kind = FeatureFlags.getKind("campaignsBeta");
// 'beta', 'premium', etc.
```

#### `getAllFlags(): Record<string, FeatureFlag>`

Get all flags as object.

```typescript
const flags = FeatureFlags.getAllFlags();
```

#### `toggle(name: string, enabled: boolean): void`

Runtime toggle (in-memory only, dev/testing). Does NOT persist.

```typescript
FeatureFlags.toggle("splashScreen", false);
```

#### `toggleKind(kind: string, enabled: boolean): void`

Toggle all flags of a kind.

```typescript
FeatureFlags.toggleKind("beta", false); // Disable all beta
```

#### `syncFromServer(serverFlags: Record<string, any>): void`

Bulk-update from server. Called automatically by AppKernel after bootstrap.

```typescript
// Called automatically - no manual invocation needed
```

### FeatureFlagsManager (Server-Driven, Production)

Fetches flags once at startup; entitlements fetched fresh on each call. Server values override hardcoded defaults. Expired entitlements automatically denied. Clock manipulation detected. Supabase client is obtained lazily—no provider parameter needed.

#### `async initialize(userId?: string): Promise<void>`

Initialize manager with optional user ID. Called automatically by AppKernel.
Supabase client (if configured) is obtained lazily only when setting up Realtime subscriptions.

```typescript
await FeatureFlagsManager.initialize(userId);
```

#### `async bootstrapFlags(): Promise<void>`

Fetch feature flags and per-user overrides once at startup. Non-blocking; logs errors, never throws.

```typescript
// Called automatically by AppKernel, but can call manually to refresh
await FeatureFlagsManager.bootstrapFlags();
```

#### `async verifyDeviceClock(): Promise<boolean>`

Check device clock against server time (±60s tolerance). Returns true if safe. Called at startup.

```typescript
const clockValid = await FeatureFlagsManager.verifyDeviceClock();
```

#### `getFlag(name: string, fallback?: boolean): boolean`

Synchronous check of cached flag value.

```typescript
const enabled = FeatureFlagsManager.getFlag("darkModeV2", false);
```

#### `isEnabledWithContext(name: string, context?: FlagContext): boolean`

Check flag with conditions and dependencies. Returns true only if flag enabled AND all conditions match AND all dependencies enabled.

```typescript
// Platform-specific
FeatureFlagsManager.isEnabledWithContext("gestureControls", {
  platform: "ios"
});

// Combined: web + production + admin
FeatureFlagsManager.isEnabledWithContext("adminTools", {
  platform: "web",
  environment: "production",
  userRole: "admin"
});
```

**Condition types:** platform (web/ios/android/desktop), environment (development/production), userRole (admin/user/guest)

#### `async getEntitlement(key: string): Promise<boolean>`

Fresh entitlement check (real-time verification from server). Automatically handles expiry.

```typescript
const isPremium = await FeatureFlagsManager.getEntitlement("premium");
```

### Cohorts & Rollouts

#### `isUserInCohort(userId: string, cohortName: string): boolean`

Check if user is in named cohort (deterministic hash-based).

```typescript
if (isUserInCohort(userId, "beta_testers")) {
  // User is in beta cohort
}
```

#### `isInRollout(userId: string, flagName: string, percentage: number, seed?: string): boolean`

Deterministic percentage-based rollout. Same user always gets same result for same seed.

```typescript
// 20% rollout of new feature
const enabled = isInRollout(userId, "newFeature", 20, "v1");
```

**Use cases:**
- Canary releases: 1% → 10% → 50% → 100% (same seed keeps same users)
- A/B testing: Compare feature enabled (20%) vs disabled (80%) for same percentage of users

## Dependencies

### External

- **`@supabase/supabase-js`** – Supabase client (lazy-loaded, optional)
- **React** – For hooks (useFeatureFlag, useEntitlement)

### Internal

- **`lib/kernel`** – Initialization via AppKernel Phase 3
- **`lib/storage` (SecureStorage)** – Encrypted flag and entitlement caching
- **`lib/config`** – Hardcoded config defaults (appsettings.json)
- **`lib/utils/logger`** – Bootstrap logging

## Error Handling & Edge Cases

### Server Unavailable

Bootstrap fails gracefully; falls back to hardcoded defaults. Logs warning, continues with local config.

### Clock Manipulation

`verifyDeviceClock()` detects tampering (±60s tolerance). Entitlements denied if clock invalid. User prompted to fix system time.

### Entitlement Expiry

Expired entitlements return false immediately. No caching of expired values.

### Network Failures

Entitlement checks fail open (return false) on network errors. Feature disabled rather than crash.

### Invalid Flag Names

Unknown flags return false (disabled). Logged as warning in development.

## Performance Notes

- **Bootstrap once at startup** – Flags fetched once, cached in memory + SecureStorage
- **Synchronous checks** – `getFlag()`, `isEnabledWithContext()` are instant (cached)
- **Lazy entitlement fetches** – Premium checks hit server only when needed
- **Deterministic hashing** – Rollout calculations are fast (no network, no storage)
- **Minimal re-renders** – Hooks use stable references, avoid unnecessary updates

## Related Modules

- **`lib/config`** – Hardcoded feature flag defaults (appsettings.json/dev.json)
- **`lib/kernel`** – Bootstrap initialization on Phase 3 (appReady)
- **`lib/storage`** – Persistent flag/entitlement caching via SecureStorage
- **`lib/premium`** – SubscriptionManager uses entitlements for tier checks
- **`lib/database`** – Fetches feature flags and entitlements from Supabase tables
- **`lib/analytics`** – Tracks feature usage (optional telemetry)

## File Breakdown

| File | Purpose |
| --- | --- |
| `feature-flags.ts` (266 lines) | Legacy FeatureFlags singleton (config-driven toggles, runtime toggle, subscriptions) |
| `server-sync.ts` | FeatureFlagsManager initialization, bootstrap, and server sync logic |
| `entitlements.ts` | Entitlement queries and freshness checks (premium features, clock safety) |
| `rollout.ts` | Deterministic bucketing for percentage-based rollouts (A/B, canary) |
| `cohorts.ts` | Named user group membership (semantic groups like "beta_testers", "enterprise") |
| `conditions.ts` | Flag condition evaluation (platform, environment, userRole matching) |
| `advanced-conditions.ts` | Advanced condition plugins (custom evaluators for non-dev platforms) |
| `cache.ts` | In-memory caching for flag/entitlement lookups |
| `telemetry.ts` | Feature usage tracking (optional analytics integration) |
| `admin-tooling.ts` | Dev tools (flag inspection, bootstrap refresh, clock state debug) |
| `index.ts` | Barrel export of public API |

