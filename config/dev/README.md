# Config Module

Environment-aware configuration management with compile-time development/production separation. Loads `appsettings.json` (production) or `appsettings.dev.json` (development) based on `EXPO_PUBLIC_ENVIRONMENT`, validates settings at app startup, supports config versioning with auto-migrations, and provides dev-only utilities with zero-overhead production no-ops.

## When to Use This Module

**Use this module if you need to:**

- Load environment-specific settings (development vs. production)
- Gate dev-only features (console logging, bypass modes) with compile-time separation
- Validate critical configuration at app startup (environment variables, required fields)
- Provide dev utilities with zero overhead in production (no-ops)
- Support config evolution with versioning and automatic migrations
- Detect schema drift between dev and prod configs

**Do NOT use this module for:**

- Runtime user preferences (use `lib/storage` instead)
- Secrets (use environment variables or CI/CD injection instead)

## Architecture & Data Flow

```
APP STARTUP
        ↓
getAppConfig()
        ├─ Check EXPO_PUBLIC_ENVIRONMENT
        │  ├─ 'development' → load appsettings.dev.json
        │  └─ unset/production → load appsettings.json
        ↓
Migrate Config (version compatibility)
        ↓
Validate Config (required fields, env vars, security checks)
        ↓
Cache globally
        ↓
Return AppSettings

DEV UTILITIES
  isDevelopment() → true/false (static per build)
  createDevConsole(), createDevTimer(), isDevBypassEnabled()
        → Real implementations in dev
        → No-ops in production (O(1), nil overhead)
```

## Configuration Structure

Two JSON files, both following `AppSettings` schema:

- **appsettings.json** - Production defaults (committed to repo)
- **appsettings.dev.json** - Development overrides (committed, not stripped)

**Top-level fields:**

| Field | Purpose |
| --- | --- |
| `version` | Schema version for migrations |
| `environment` | `"production"` or `"development"` |
| `features` | Boolean toggles: consoleLogging, devBypass, mockData, performanceMonitoring |
| `overrides` | Runtime flags: mockSupabase, verboseErrorMessages |
| `devTools` | Dev-only: enableConsoleLogger, enableNetworkLogger, etc. |
| `featureFlags` | Flags with `{ enabled, description, kind }` |
| `thresholds` | Performance thresholds: slowScreenMs, slowRequestMs |

## Versioning & Migrations

Config schema uses simple integer versioning for safe evolution:

- **Current version**: 1
- **Strategy**: When breaking changes needed (add required field, remove/rename field, change type), increment version and create migration function
- **Auto-migration**: `getAppConfig()` automatically applies migrations on load
- **Rollback**: Keep all old migrations indefinitely (supports rollback)

See [lib/config/migrations.ts](migrations.ts) for migration chain. When adding a version:

1. Update `AppSettings` interface in `loader.ts`
2. Create migration function (e.g., `migrateV1ToV2`)
3. Register in migration chain + increment `CURRENT_CONFIG_VERSION`
4. Update both `appsettings.json` and `appsettings.dev.json`

## Validation

At app startup (kernel Phase 0):

1. Load config file (appsettings.json or appsettings.dev.json)
2. Migrate version if needed
3. Validate structure:
   - Required environment variables (Supabase URL/key in production)
   - Required config fields (features, overrides, devTools, featureFlags)
   - Environment mismatch detection
   - **Production safety**: devBypass and mockData MUST be false (fatal error if true)

Validation errors block startup; warnings logged but allow continuation.

## API Reference

### Loader

#### `getAppConfig(): AppSettings`

Load and cache application settings. Respects `EXPO_PUBLIC_ENVIRONMENT`; defaults to production for safety.

```typescript
const config = getAppConfig();
console.log(config.environment); // 'development' or 'production'
console.log(config.features.devBypass); // boolean
```

**Performance:** O(1) after first call (cached); first call ~5-10ms (JSON parsing)

**Throws:** If config file missing, malformed, or validation fails

#### `isDevelopment(): boolean`

Returns true if `EXPO_PUBLIC_ENVIRONMENT=development`.

#### `isProduction(): boolean`

Returns true if `EXPO_PUBLIC_ENVIRONMENT` unset or "production".

#### `CURRENT_CONFIG_VERSION: number`

Current schema version. Increment on breaking changes; migrations applied automatically by `getAppConfig()`.

### Migrations

#### `migrateConfig(config: unknown, detectedVersion: number, targetVersion?: number): AppSettings`

Migrate config from one version to another. Called automatically by `getAppConfig()`.

**Returns:** Migrated `AppSettings` object

**Throws:** If version unsupported (<1) or migration fails

### Validator

#### `validateConfig(config: AppSettings): ConfigValidationResult`

Validate config structure, required fields, and environment variables. Called at app startup.

```typescript
const result = validateConfig(config);
if (!result.valid) {
  console.error(result.errors); // Blocks startup
}
```

**Returns:** `{valid: boolean, errors: string[], warnings: string[]}`

**Checks:**
- Required environment variables (Supabase in production)
- Config file environment matches `EXPO_PUBLIC_ENVIRONMENT`
- Required config fields present
- Production safety: devBypass and mockData must be false

### Dev-Only Utilities

#### `createDevConsole(scope: string): DevLogger`

Factory function for scoped logger. No-op in production.

```typescript
const logger = createDevConsole("MyModule");
logger.log("Debug"); // Only in dev + enableConsoleLogger true
```

#### `isDevBypassEnabled(): boolean`

Returns true if dev bypass mode active (always false in production).

#### `createDevTimer(label: string): DevTimer`

Performance timer. No-op in production.

```typescript
const timer = createDevTimer("DataFetch");
await fetchData();
timer.end(); // Logs "[PERF] DataFetch: 245ms" in dev
```

### Hot-Reload

#### `initializeHotReload(): void`

Start config hot-reload for development. Called automatically at app startup. No-op in production.

#### `getHotReload(): ConfigHotReload | null`

Get active hot-reload instance (or null if not available).

#### `isHotReloadAvailable(): boolean`

Check if hot-reload can run (development mode + fetch API available).

#### `ConfigHotReload` Class

```typescript
interface ConfigHotReload {
  start(): void;           // Start polling appsettings.dev.json
  stop(): void;            // Stop polling and cleanup
  checkForChanges(): void; // Manually trigger change check
  subscribe(callback: (config: AppSettings) => void): () => void;
}
```

Polls every 1000ms, applies full pipeline (load → migrate → validate), updates global cache, notifies subscribers.

## Dependencies

### External Packages

- **`expo-constants`** – Reads Supabase credentials from `app.json` extra fields (Expo export builds)

### Internal Dependencies

- **`lib/utils/logger`** – Validation result logging (bootstrap category)

### Environment Variables

- **`EXPO_PUBLIC_ENVIRONMENT`** – Set to `"development"` for dev builds; unset or `"production"` for production
- **`EXPO_PUBLIC_SUPABASE_URL`**, **`EXPO_PUBLIC_SUPABASE_ANON_KEY`** – Required in production

## Error Handling & Edge Cases

### Missing Configuration Files

**Problem:** `appsettings.dev.json` or `appsettings.json` not found

**Resolution:**
- Check both files exist in `config/` directory
- Ensure file names match exactly (case-sensitive on some systems)
- Error message indicates which file is missing

### Environment Variable Mismatch

**Problem:** `EXPO_PUBLIC_ENVIRONMENT=development` but `appsettings.json` has `environment: "production"`

**Resolution:**
- Ensure loaded config file matches environment variable
- If not explicitly set, defaults to production for safety

### Invalid JSON or Missing Fields

**Problem:** Config file is missing required fields (features, overrides, devTools, featureFlags)

**Resolution:**
- Validator logs each missing field with description
- Add missing fields to match `AppSettings` interface
- Dev features (devBypass, mockData) enabled in production = fatal error

### Production Dev Features Enabled

**Problem:** `features.devBypass: true` or `features.mockData: true` in production

**Resolution:**
- ALWAYS false in `appsettings.json` (security risk)
- Block startup immediately (fatal validation error)
- If accidentally deployed: rollback immediately

## Performance Notes

### Caching

- Config cached after first call; subsequent `getAppConfig()` calls are O(1)
- First call parses JSON: ~5-10ms for typical config
- Safe to call `getAppConfig()` anywhere

### Dev Utilities

- In production: `createDevConsole()`, `createDevTimer()`, `isDevBypassEnabled()` are no-op functions with O(1), nil overhead
- Safe to call anywhere; return early in production

### Validation

- Runs once at app startup (kernel Phase 0, before UI)
- O(n) where n = config fields (~30 typical); <5ms total
- Blocks startup on errors (acceptable for critical validation)

### Environment Variable Access

- `EXPO_PUBLIC_*` variables bundled at compile-time by Expo CLI
- No runtime access cost

## Related Modules

- **`lib/utils/logger`** – Validation logging (bootstrap category)
- **`lib/kernel`** – Calls `validateConfig()` during Phase 0, `initializeHotReload()` during bootstrap
- **`lib/auth`** – Uses `config.features.mockSupabase` for mock auth in dev
- **`lib/analytics`** – Uses `config.services.errorProvider.enabled` or `config.services.analytics.enabled` to gate Sentry SDK initialization

## File Breakdown

| File | Purpose |
| --- | --- |
| `loader.ts` (368 lines) | Load config based on `EXPO_PUBLIC_ENVIRONMENT`, cache, auto-migrate |
| `config-validator.ts` (446 lines) | Validate config structure, required fields, env vars at startup |
| `dev-only.ts` (99 lines) | Dev utilities (console logger, timer, bypass) with no-op production versions |
| `hot-reload.ts` | Dev-only hot-reload of `appsettings.dev.json`; subscribe to changes |
| `migrations.ts` | Version migration chain (v1→v2, etc.) |
| `platform-config.ts` | Platform detection (`web`, `ios`, `android`, `desktop`) and config merging |
| `tools/` (submodule) | Schema drift detection (config-diff.ts, expected-differences.json); run via `npm run config:validate` |
| `index.ts` | Barrel export of public API |
