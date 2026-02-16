# Config Versioning Implementation Guide

This guide documents the current implementation of AppSettings versioning and migration system.

## Architecture Overview

The config versioning system provides safe schema evolution for AppSettings with automatic migration on app startup.

### Core Components

1. **AppSettings Interface** (`lib/config/loader.ts`)
   - Defines current schema with `version: number` field
   - Type-safe configuration structure

2. **Migration Registry** (`lib/config/migrations.ts`)
   - `CURRENT_CONFIG_VERSION` constant
   - `MIGRATION_CHAIN` array of [targetVersion, migrationFn] pairs
   - `migrateConfig()` function for applying migrations

3. **Auto-Migration** (`lib/config/loader.ts`)
   - `getAppConfig()` detects version and applies migrations
   - Validates migrated config before caching
   - Clear error messages for migration failures

## Current Implementation

### Version 1 (Baseline)

**Schema:**
```typescript
export interface AppSettings {
  version: number; // Added for versioning
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
  // ... additional sections (backgroundJobs, network, api, etc.)
  featureFlags: Record<string, {
    enabled: boolean;
    description?: string;
    kind?: "free" | "premium" | "beta";
  } & Record<string, any>>;
}
```

**Config Files:**
- `config/appsettings.json` - Production settings
- `config/appsettings.dev.json` - Development settings
- Both include `"version": 1`

### Migration System

**Current State:**
- `CURRENT_CONFIG_VERSION = 1`
- `MIGRATION_CHAIN = []` (empty - no migrations yet)
- `migrateV1ToV2()` placeholder function exists but unused

**Migration Function Signature:**
```typescript
export const migrateV1ToV2 = (config: any): any => {
  // Transform config from v1 to v2 schema
  return config; // Currently no-op
};
```

**Migration Chain Structure:**
```typescript
const MIGRATION_CHAIN = [
  // [targetVersion, migrationFunction]
  [2, migrateV1ToV2],
  // Future: [3, migrateV2ToV3],
] as const;
```

### Auto-Migration Flow

**In `getAppConfig()`:**

```typescript
export function getAppConfig(): AppSettings {
  // 1. Load raw config (any type)
  let config: any = require("../../config/appsettings.json");

  // 2. Extract and validate version
  const detectedVersion = config.version;
  if (typeof detectedVersion !== 'number') {
    throw new Error(`Config version must be a number`);
  }

  // 3. Apply migrations if needed
  const { migrateConfig, CURRENT_CONFIG_VERSION } = require("./migrations");
  config = migrateConfig(config, detectedVersion, CURRENT_CONFIG_VERSION);

  // 4. Validate migrated config
  if (!config.version || !config.environment || /* ... */) {
    throw new Error(`Validation failed after migration`);
  }

  // 5. Cache and return
  cachedConfig = config as AppSettings;
  return cachedConfig;
}
```

### Error Handling

**Version Validation:**
```typescript
const detectedVersion = config.version;
if (typeof detectedVersion !== 'number') {
  throw new Error(
    `[AppConfig] Config version field must be a number. Got: ${typeof detectedVersion}. ` +
    `File: ${environment === 'development' ? 'config/appsettings.dev.json' : 'config/appsettings.json'}`
  );
}
```

**Migration Failures:**
```typescript
try {
  config = migrateConfig(config, detectedVersion, CURRENT_CONFIG_VERSION);
} catch (err) {
  const migrationFailMsg = `[AppConfig] Configuration migration failed (v${detectedVersion}). ` +
    `File: ${configFile}. Error: ${errorMessage}`;
  console.error(migrationFailMsg);
  throw new Error(migrationFailMsg);
}
```

**Post-Migration Validation:**
```typescript
if (!config.version || !config.environment || !config.features || !config.overrides || !config.devTools) {
  const missingFields = [];
  if (!config.version) missingFields.push("version");
  // ... check other required fields
  throw new Error(`Validation failed after migration. Missing: ${missingFields.join(", ")}`);
}
```

## File Structure

```
lib/config/
├── loader.ts           # AppSettings interface, getAppConfig(), auto-migration
├── migrations.ts       # Migration registry, migrateConfig() function
├── config-validator.ts # Validation logic (separate from versioning)
├── dev-only.ts         # Dev utilities
├── index.ts           # Public exports
└── README.md          # Complete documentation

config/
├── appsettings.json      # Production config (version: 1)
└── appsettings.dev.json  # Development config (version: 1)
```

## Test Coverage

**Updated Test Mocks:**
- All `getAppConfig` mocks now include `version: 1`
- Tests in: `app-kernel-safe-mode.test.ts`, `circuit-breaker.test.ts`, etc.
- Added mock to `app-kernel-integration.test.ts` to prevent real config loading

**Test Files Updated:**
- `__tests__/kernel/app-kernel-safe-mode.test.ts`
- `__tests__/api/circuit-breaker.test.ts`
- `__tests__/api/request-manager-circuit-breaker.test.ts`
- `__tests__/api/request-manager-offline-queue.test.ts`
- `__tests__/kernel/app-kernel-integration.test.ts`

## Future Extensions

### Phase 2: Unit Tests

**Planned test coverage:**
- Version detection logic
- Migration chain execution
- Error handling for invalid versions
- Validation post-migration
- Backward compatibility scenarios

**Test file:** `docs/A Testing Guide/config-versioning-testing.md`

### Phase 3: Zod Validation

**Optional enhancement:**
- Runtime type validation with Zod schemas
- Per-version schema definitions
- CLI validation tool

## Migration Examples

### Adding New Required Field

**Scenario:** Add required `analytics.enabled` field in v2

**Interface Update:**
```typescript
export interface AppSettings {
  version: number; // → 2
  analytics: {
    enabled: boolean;
  };
  // ... rest
}
```

**Migration Function:**
```typescript
export const migrateV1ToV2 = (config: any): any => ({
  ...config,
  analytics: {
    enabled: config.analytics?.enabled ?? false, // Default: disabled
  },
});
```

**Registry Update:**
```typescript
export const CURRENT_CONFIG_VERSION = 2;
const MIGRATION_CHAIN = [
  [2, migrateV1ToV2],
] as const;
```

**Config Files:**
```json
{
  "version": 2,
  "analytics": {
    "enabled": true
  }
}
```

## Performance Characteristics

- **First Call:** O(n) JSON parsing + O(m) migration cost
- **Subsequent Calls:** O(1) cached access
- **Migration Cost:** Linear in number of migrations applied
- **Memory:** Single cached config object
- **Startup Impact:** Minimal (< 10ms typical)

## Security Considerations

- **No Secrets:** Config versioning only handles app settings, not secrets
- **Validation:** Strict type checking prevents runtime errors
- **Fail-Safe:** Invalid configs block startup (security over availability)
- **Logging:** Migration errors logged for debugging

## Dependencies

**Internal:**
- `lib/config/loader.ts` - Core config loading
- `lib/config/config-validator.ts` - Validation logic

**External:**
- None (pure TypeScript/JavaScript)

## Maintenance Notes

**Version Numbering:**
- Simple integers only (1, 2, 3...)
- No semantic versioning
- Sequential increments

**Migration Functions:**
- Must handle `any` input defensively
- Should provide sensible defaults
- Must not mutate input (immutable)
- Should be tested thoroughly

**Config Files:**
- Both `appsettings.json` and `appsettings.dev.json` must be updated
- Version field required in both
- JSON syntax must be valid

## Related Files

- [Config Versioning Usage Guide](./USAGE_GUIDE.md) - How to use the system
- [lib/config/README.md](../../../../../lib/config/README.md) - Complete config system docs
- [AppSettings Interface](../../../../../lib/config/loader.ts) - Type definitions
- [Migration Registry](../../../../../lib/config/migrations.ts) - Migration functions