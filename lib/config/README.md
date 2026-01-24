# lib/config

## When to Use This Module

This module provides **environment-aware configuration management** for applications that require different settings across development and production builds. Use `lib/config` when you need to:

- Load environment-specific settings (development vs. production)
- Gate dev-only features (console logging, bypass modes, mock data) with compile-time separation
- Validate critical configuration at app startup (environment variables, required fields, feature flags)
- Gate feature flags with optional metadata (description, tier: free/premium/beta)
- Prevent dev features from leaking into production builds
- Provide safe no-op versions of dev utilities in production (minimal overhead)

**Do NOT use this module for:**

- Runtime user preferences (use `lib/storage` instead)
- Feature flags that change frequently at runtime (consider a remote config service)
- Sensitive secrets that should never be committed (use environment variables or CI/CD injection)
- Non-development-specific conditional logic (use feature flags in `appsettings.json`)

## Architecture & Data Flow

```
Development Build:
  EXPO_PUBLIC_ENVIRONMENT=development
  ↓
  getAppConfig() → loads appsettings.dev.json
  ↓
  Config cached (after first call)
  ↓
  isDevelopment() → true, dev utilities return real implementations
  ↓
  App runs with full logging, dev tools, mock data if enabled

Production Build:
  EXPO_PUBLIC_ENVIRONMENT not set (defaults to production)
  ↓
  getAppConfig() → loads appsettings.json
  ↓
  Config cached (after first call)
  ↓
  isDevelopment() → false, dev utilities return no-ops
  ↓
  App runs optimized: no console logging overhead, dev tools disabled
```

### Configuration Structure

All configuration is centralized in two JSON files (`appsettings.json` and `appsettings.dev.json`) loaded based on `EXPO_PUBLIC_ENVIRONMENT`:

- **environment**: `"production" | "development"` - Must match env var
- **features**: Compile-time toggles (consoleLogging, devBypass, mockData, performanceMonitoring, sentryEnabled)
- **overrides**: Runtime overrides (mockSupabase, verboseErrorMessages)
- **devTools**: Development utilities (enableConsoleLogger, enableNetworkLogger, enablePerformanceLogger, enableReduxDevTools, enableReactDevTools)
- **featureFlags**: Dynamic flags with metadata (enabled, description, kind, optional categories for logger)
- **thresholds**: Performance thresholds (slowScreenMs, slowRequestMs)

### Validation Flow

At app startup (kernel Phase 0), validation runs in two stages:

1. **Environment Variables**: Required env vars (EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY in production)
2. **App Settings**: Structure, required fields, feature flags, environment mismatch detection

Validation blocks app startup on error; warnings are logged but allow continuation. Production dev features (devBypass, mockData) are fatal errors.

## API Reference

### Loader (`loader.ts`)

#### `getAppConfig(): AppSettings`

Load and cache application settings. Respects `EXPO_PUBLIC_ENVIRONMENT`; defaults to production for safety.

```typescript
import { getAppConfig } from "@/lib/config";

const config = getAppConfig();
console.log(config.environment); // 'development' or 'production'
console.log(config.features.consoleLogging); // boolean
console.log(config.featureFlags.splashScreen.enabled); // boolean
```

**Returns:** `AppSettings` object (cached after first call)

**Throws:** If required `appsettings.json` or `appsettings.dev.json` is missing, malformed, or missing required fields

**Performance:** O(1) after first call (cached); first call is O(n) where n = JSON parsing

#### `isDevelopment(): boolean`

Check if running in development mode. Use this for compile-time guards.

```typescript
import { isDevelopment } from "@/lib/config";

if (isDevelopment()) {
  enableDebugLogging();
}
```

#### `isProduction(): boolean`

Check if running in production mode. Use this to gate production-safe code paths.

```typescript
import { isProduction } from "@/lib/config";

if (isProduction()) {
  initializeSentryErrorTracking();
}
```

### Validator (`config-validator.ts`)

#### `validateConfig(config: AppSettings): ConfigValidationResult`

Validate complete app configuration. Called during kernel initialization.

```typescript
import { validateConfig, logValidationResults } from "@/lib/config";

const config = getAppConfig();
const result = validateConfig(config);

if (!result.valid) {
  console.error("Config validation failed:", result.errors);
  // App startup is blocked by kernel
}
```

**Parameters:**

- `config`: `AppSettings` object to validate

**Returns:** `ConfigValidationResult`

```typescript
interface ConfigValidationResult {
  valid: boolean;
  errors: string[]; // Blocks startup
  warnings: string[]; // Logged only
}
```

**Validation Rules:**

- All required environment variables present (Supabase in production)
- Config file environment matches `EXPO_PUBLIC_ENVIRONMENT` (if set)
- All required fields in features, overrides, devTools objects
- All required feature flags present with `enabled` field
- Logger categories contain required 11 categories (auth, navigation, api, performance, storage, ui, analytics, security, bootstrap, error, other)
- Production safety: devBypass and mockData must be false (fatal error if true)
- Structure: All sections must be objects (not null), never undefined

#### `logValidationResults(result: ConfigValidationResult): void`

Log validation results using the logger system with appropriate severity.

```typescript
import { logValidationResults } from "@/lib/config";

logValidationResults(result);
// Logs errors with ❌ prefix, warnings with ⚠️ prefix, or ✅ if valid
```

### Dev-Only Utilities (`dev-only.ts`)

#### `useDevConsole(scope: string): DevLogger`

Scoped console logger that returns no-op methods in production. Respects `devTools.enableConsoleLogger` setting.

```typescript
import { useDevConsole } from "@/lib/config";

const devLogger = useDevConsole("MyModule");
devLogger.log("Debug info"); // Only logs in dev + enableConsoleLogger true
devLogger.warn("Warning"); // No-op in production
devLogger.error("Error"); // No-op in production
```

**Returns:**

```typescript
interface DevLogger {
  log(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
}
```

**Performance (Production):** O(1) no-op; nil overhead

#### `isDevBypassEnabled(): boolean`

Check if dev bypass mode is active (allows skipping auth, gates, etc. during testing). Always false in production.

```typescript
import { isDevBypassEnabled } from "@/lib/config";

if (isDevBypassEnabled()) {
  // Skip authentication for testing
  skipAuthFlow();
}
```

#### `devAssert(condition: boolean, message: string): void`

Assert condition in development; throw with verbose message if false. No-op in production.

```typescript
import { devAssert } from "@/lib/config";

devAssert(userId !== null, "userId should never be null here");
```

**Throws (Dev Only):** `Error` if `condition` is false and `overrides.verboseErrorMessages` is true

#### `createDevTimer(label: string): DevTimer`

Create a performance timer that logs elapsed time. Returns no-op timer in production.

```typescript
import { createDevTimer } from "@/lib/config";

const timer = createDevTimer("DataFetch");
await fetchData();
timer.end(); // Logs "[PERF] DataFetch: 245ms" in dev (if enablePerformanceLogger true)
```

**Returns:**

```typescript
interface DevTimer {
  end(): void;
}
```

**Performance (Production):** O(1) no-op; nil overhead

### Type Definitions

#### `AppSettings`

Complete configuration schema. Loaded from `appsettings.json` or `appsettings.dev.json`.

```typescript
interface AppSettings {
  description: string;
  environment: "development" | "production";

  features: {
    consoleLogging: boolean;
    devBypass: boolean;
    mockData: boolean;
    performanceMonitoring: boolean;
    sentryEnabled: boolean;
  };

  overrides: {
    mockSupabase: boolean;
    verboseErrorMessages: boolean;
  };

  devTools: {
    enableConsoleLogger: boolean;
    enableNetworkLogger: boolean;
    enablePerformanceLogger: boolean;
    enableReduxDevTools: boolean;
    enableReactDevTools: boolean;
  };

  thresholds?: {
    slowScreenMs?: number;
    slowRequestMs?: number;
  };

  featureFlags: Record<
    string,
    {
      enabled: boolean;
      description?: string;
      kind?: "free" | "premium" | "beta";
      categories?: Record<string, boolean>; // For loggerCategories flag
    }
  >;
}
```

## Dependencies

### External Packages

- `expo-constants` - Access embedded secrets from `app.json` (Supabase credentials in export builds)

### Internal lib/ Dependencies

- `lib/utils/logger` (config-validator.ts) - Bootstrap-category logging for validation results

### Platform Dependencies

- Environment variables (EXPO*PUBLIC_ENVIRONMENT, EXPO_PUBLIC_SENTRY_DSN, EXPO_PUBLIC_SUPABASE*\*)
- `app.json` extra fields (for Supabase credentials in Expo export builds)

## Error Handling & Edge Cases

### Missing Configuration Files

**Problem:** `appsettings.dev.json` or `appsettings.json` not found at build time

**Resolution:**

- Check that both files exist in `config/` directory
- If building development: ensure `appsettings.dev.json` exists
- If building production: ensure `appsettings.json` exists
- Error message indicates which file is missing and common causes (syntax error, incorrect strip-dev-appsettings cleanup)

### Environment Variable Mismatch

**Problem:** `EXPO_PUBLIC_ENVIRONMENT=development` but `appsettings.json` has `environment: "production"`

**Resolution:**

- Ensure loaded config file matches environment variable
- If not explicitly set, defaults to production for safety
- Error indicates which mismatch occurred

### Invalid JSON Structure

**Problem:** Config file is missing required fields (features, overrides, devTools, featureFlags)

**Resolution:**

- Validator logs each missing field
- Error lists all missing fields; add them to match `AppSettings` interface
- Dev features (devBypass, mockData) enabled in production produce fatal errors

### Production Dev Features Enabled

**Problem:** `features.devBypass: true` or `features.mockData: true` in production build

**Resolution:**

- ALWAYS false in `appsettings.json`
- These are fatal validation errors (block startup)
- Security risk: devBypass allows unauthenticated access; mockData serves incorrect game data
- If accidentally deployed: rollback immediately

### Missing Environment Variables

**Problem:** Required env vars (EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY) not set in production built with git pages

**Resolution:**

- Set in CI/CD environment during build
- Or embed in `app.json` extra fields (for `expo export` builds)
- Validator checks both `process.env` AND `Constants.expoConfig.extra`
- Dev mode has no required env vars (optional for graceful degradation)

### Feature Flag Validation

**Problem:** Missing required feature flag or missing `enabled` field

**Resolution:**

- Add all required flags: splashScreen, debugLogs, loggerCategories
- Ensure each flag has `{ enabled: boolean, ... }`
- For loggerCategories: must contain all 11 required categories

## Performance Notes

### Caching

- Config is loaded once and cached globally; subsequent `getAppConfig()` calls return cached object (O(1))
- First call incurs JSON parsing cost (typically <10ms for config files)
- Safe to call `getAppConfig()` anywhere in the app without performance penalty

### Dev-Only No-Ops

- In production, all dev utilities (`useDevConsole`, `createDevTimer`, `isDevBypassEnabled`) are no-op functions with negligible overhead
- Dev utilities are safe to call anywhere; they provide no-op returns in production rather than adding compilation burden
- No tree-shaking needed; production bundle includes dev utilities but they're effectively inlined as empty functions

### Validation Cost

- Validation runs once at app startup (kernel Phase 0, before UI rendering)
- Validator iterates through config structure once: O(n) where n = total config fields (~30 fields typical)
- Validation cost <5ms; blocking startup is acceptable for critical config verification

### Environment Variable Access

- `EXPO_PUBLIC_*` variables are bundled at compile time (Expo CLI replaces with values during build)
- `process.env` access at runtime has no performance penalty
- `Constants.expoConfig.extra` access is cached by Expo (no cost)

## Related Modules

- **lib/utils/logger** - Used for config validation logging (bootstrap category)
- **lib/feature-flags.ts** - Higher-level feature flag utility (wraps config.featureFlags)
- **lib/auth** - Uses config.features.mockSupabase to support mock auth in development
- **lib/analytics** - Uses config.features.sentryEnabled to conditionally initialize error tracking
- **lib/kernel** - Calls validateConfig during Phase 0 (critical startup validation)

## File Breakdown

| File                  | Purpose                                                      | Exports                                                                      |
| --------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `loader.ts`           | Environment-aware config loading and caching                 | `getAppConfig()`, `isDevelopment()`, `isProduction()`, `AppSettings`         |
| `config-validator.ts` | Startup validation of app settings and environment variables | `validateConfig()`, `logValidationResults()`, `ConfigValidationResult`       |
| `dev-only.ts`         | Safe dev-only utilities with no-op production versions       | `useDevConsole()`, `isDevBypassEnabled()`, `devAssert()`, `createDevTimer()` |
| `index.ts`            | Barrel export for public API                                 | All exports from loader, validator, dev-only                                 |

## Testing

### Manual Testing

#### Development Mode

1. Set `EXPO_PUBLIC_ENVIRONMENT=development`
2. Run app: `npm run start`
3. Verify console logging works (if enableConsoleLogger true in appsettings.dev.json)
4. Call `useDevConsole('Test')` and verify logs appear
5. Call `createDevTimer('TestTimer')` and verify "[PERF]" logs appear

#### Production Mode

1. Unset `EXPO_PUBLIC_ENVIRONMENT` (defaults to production)
2. Build: `npm run predeploy` (Expo export)
3. Verify no console logging appears (even if dev code calls useDevConsole)
4. Verify no performance timers log
5. Verify config validation passes (✅ in console)

#### Config Validation

1. Intentionally break appsettings.json (remove a required field)
2. Start app and verify validation error blocks startup
3. Restore file and verify app boots normally

#### Environment Variable Validation

1. Unset EXPO_PUBLIC_SUPABASE_URL in production build
2. Verify validation error about missing Supabase URL
3. Set variable and verify validation passes

### Automated Tests

Add test cases to a test guide in `docs/A Testing Guide/config-testing-guide.md`:

- Config loading with different EXPO_PUBLIC_ENVIRONMENT values
- Caching behavior (multiple getAppConfig calls return same object)
- Validation of all required fields
- Dev utility no-op behavior in production
- Feature flag schema validation
- Logger category validation

## Future Enhancements

- **Config Encryption** - Encrypt sensitive fields in config files (though env vars are recommended for secrets)
