# lib/feature-flags

JSON-based feature flag system for development and testing with kind-based classification (free/premium/beta).

## When to Use This Module

**Use this module for:**

- **Feature Toggles**: Enable/disable features without code changes (config-driven)
- **Beta Testing**: Flag experimental features with automatic production warnings in console
- **A/B Testing Setup**: Foundation for rolling out features to subsets of users
- **Development Control**: Dev console access for runtime flag toggling without redeploy
- **Kind-Based Organization**: Classify flags by scope (free, premium, beta) in config
- **Graceful Degradation**: Disable features on older versions or during maintenance

**Do NOT use this module for:**

- **Runtime Feature Entitlement** (use [lib/premium's SubscriptionManager](../premium/README.md) for subscription-based access)
- **User Permission Checks** (use [lib/auth's AuthStateManager](../auth/README.md) or [lib/database](../database/README.md) roles for role/permission validation)
- **Build-Time Configuration** (use [lib/config](../config/README.md) for environment-specific settings instead)
- **Subscription Gating** (combine feature-flags with [lib/premium's SubscriptionManager](../premium/README.md) for premium features)
- **Analytics Events** (use [lib/analytics](../analytics/README.md) instead)

## Architecture & Data Flow

```
Config File (config/appsettings.*.json)
    ↓
FeatureFlagsManager.getAllFlags() [on init]
    ↓
Internal Map<flagName, FeatureFlag>
    ↓
Runtime Checks (isEnabled, getKind, toggle)
    ↓
React Hook (useFeatureFlag) or Direct Import (FeatureFlags)
    ↓
Component/Service Decision Logic
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

- `lib/config/loader.ts` – `getAppConfig()`, `isProduction()` (load flags + detect prod)
- `config/appsettings.*.json` – Flag definitions (dev + prod defaults)

### External

- None (vanilla TypeScript, no external dependencies)

## Error Handling & Edge Cases

### Known Limitations

1. **No Persistence**: Runtime toggles (`toggle()`, `toggleKind()`) are in-memory only. Page refresh resets to config values.

2. **No Remote Config Yet**: Flags are loaded from static config files. Future enhancement: fetch from Supabase/CDN for runtime updates without deploy.

3. **Kind Conflicts**: Flags can have multiple concerns (e.g., both `beta` and `premium`). Use separate flags if both qualities are needed:

   ```json
   {
     "experimentalPremium": { "kind": "beta" }, // Experimental version
     "stablePremium": { "kind": "premium" } // Stable version
   }
   ```

4. **Production Beta Warning**: Only logged to console on startup. No enforcement (beta flags CAN be enabled in production; it's just warned).

5. **No Rollout Targeting**: Flags are global (all or nothing). No per-user rollout yet.

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

- **lib/config** – Environment-aware configuration loading (used to load feature flags)
- **lib/premium** – Subscription/tier management (combine with flags for premium gating)
- **hooks/use-feature-flag** – React hook for re-rendering on flag changes
- **components/ui/FeatureGate** – React component wrapper for conditional rendering

## File Breakdown

| File             | Purpose                                          | Lines |
| ---------------- | ------------------------------------------------ | ----- |
| feature-flags.ts | FeatureFlagsManager class, exports, window setup | ~130  |
| index.ts         | Barrel export (public API)                       | 1     |
| README.md        | This file                                        | ~400  |

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

- **Telemetry** – Track which flags are used and performance impact
- **Flag Expiry** – Automatic removal after a set date (cleanup dead experiments)
- **Inheritance/Defaults** – Flag groups with shared defaults, override per-flag
