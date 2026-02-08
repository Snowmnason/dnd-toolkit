# Config Versioning Usage Guide

This guide explains how to use the AppSettings versioning system for safe schema evolution.

## Overview

AppSettings uses simple integer versioning to safely evolve configuration schema over time. The system automatically migrates old config files to the current version on app startup.

## Current Version

- **Version**: 1
- **Status**: Initial versioned release
- **Breaking Changes**: None yet (this is the baseline)

## How Versioning Works

### Automatic Migration Flow

```
App Startup → Load config file → Detect version → Auto-migrate → Validate → Cache
```

1. **Load**: `require("../../config/appsettings.json")` loads raw JSON
2. **Detect**: Extract `config.version` (required field)
3. **Migrate**: Apply migration chain v1→v2→v3... to current version
4. **Validate**: Ensure migrated config matches `AppSettings` interface
5. **Cache**: Store migrated config for app use

### Migration Chain

Migrations are applied sequentially:
- v1 → v2 (migrateV1ToV2)
- v2 → v3 (migrateV2ToV3)
- etc.

Each migration transforms `any` input to the next version's schema.

## Adding a New Version

### Step 1: Update AppSettings Interface

```typescript
// lib/config/loader.ts
export interface AppSettings {
  version: number; // Increment this
  // Add new required field
  newFeature?: { enabled: boolean };
}
```

### Step 2: Create Migration Function

```typescript
// lib/config/migrations.ts
export const migrateV1ToV2 = (config: any): any => ({
  ...config,
  newFeature: {
    enabled: config.newFeature?.enabled ?? false, // Default value
  },
});
```

### Step 3: Register Migration

```typescript
// lib/config/migrations.ts
export const CURRENT_CONFIG_VERSION = 2;

const MIGRATION_CHAIN = [
  [2, migrateV1ToV2], // Add new entry
] as const;
```

### Step 4: Update Config Files

```json
// config/appsettings.json & config/appsettings.dev.json
{
  "version": 2,
  "newFeature": {
    "enabled": true
  }
}
```

### Step 5: Test Migration

- Start app with old config (version 1)
- Verify migration succeeds
- Verify new features work
- Check console for migration logs

## When to Bump Version

### Bump Required (Breaking Changes)

- ✅ Add new **required** field
- ✅ Remove existing field
- ✅ Change field type
- ✅ Rename field
- ✅ Change field behavior

### No Bump Needed (Non-Breaking)

- ❌ Add optional field with default
- ❌ Add new feature flag
- ❌ Performance tuning
- ❌ Documentation changes

## Error Handling

### Migration Failures

If migration fails, app startup blocks with clear error:

```
[AppConfig] Configuration migration failed (v1).
File: config/appsettings.json.
Error: [ConfigMigration] Failed to migrate from v1 to v2: ...
```

**Resolution:**
- Check config file JSON syntax
- Verify required fields exist for target version
- If downgrading, ensure old migrations still work

### Version Validation

If `version` field is missing or not a number:

```
[AppConfig] Config version field must be a number. Got: undefined.
File: config/appsettings.json
```

**Resolution:**
- Add `"version": 1` to config file
- Ensure version is a valid integer

## Best Practices

### Migration Functions

- **Defensive**: Accept `any` input, handle missing fields
- **Immutable**: Return new object, don't mutate input
- **Defaults**: Provide sensible defaults for new required fields
- **Validation**: Let validation catch issues after migration

### Version Numbers

- **Simple integers**: 1, 2, 3 (no semantic versioning)
- **Sequential**: Each version increments by 1
- **No gaps**: Don't skip numbers

### Testing

- Test migration with old config files
- Verify new features work after migration
- Check console logs for migration success
- Test error cases (invalid config, missing fields)

## Examples

### Adding Optional Field (No Version Bump)

```typescript
// Add to AppSettings interface
export interface AppSettings {
  // ... existing fields
  analytics?: {
    enabled: boolean;
    sampleRate?: number;
  };
}

// No migration needed - field is optional
// Update config files with new field if desired
```

### Adding Required Field (Version Bump)

```typescript
// Update interface
export interface AppSettings {
  version: number; // Increment to 2
  // ... existing fields
  analytics: { // Now required
    enabled: boolean;
    sampleRate?: number;
  };
}

// Create migration
export const migrateV1ToV2 = (config: any): any => ({
  ...config,
  analytics: {
    enabled: config.analytics?.enabled ?? false,
    sampleRate: config.analytics?.sampleRate ?? 1.0,
  },
});

// Register migration
export const CURRENT_CONFIG_VERSION = 2;
const MIGRATION_CHAIN = [
  [2, migrateV1ToV2],
] as const;

// Update config files
{
  "version": 2,
  "analytics": {
    "enabled": true,
    "sampleRate": 1.0
  }
}
```

## Troubleshooting

### App Won't Start

**Check console logs** for migration errors:
- `[AppConfig] Configuration migration failed`
- `[AppConfig] Config version field must be a number`

**Common fixes:**
- Add missing `version` field
- Fix JSON syntax errors
- Ensure required fields exist for target version

### Migration Not Applied

**Check version detection:**
- Config file must have `"version": N` field
- Version must be a number
- Version must be < `CURRENT_CONFIG_VERSION`

**Check migration chain:**
- Migrations must be registered in `MIGRATION_CHAIN`
- Migration functions must be exported
- Functions must handle `any` input defensively

### New Features Not Working

**After migration:**
- Verify config was migrated (check cached config)
- Ensure new fields have correct values
- Test feature with migrated config

## Related Documentation

- [Config Versioning Implementation Guide](./CONFIG_VERSIONING_IMPLEMENTATION.md) - Technical details
- [lib/config/README.md](../../lib/config/README.md) - Complete config system docs
- [AppSettings Interface](../../lib/config/loader.ts) - Type definitions</content>
<parameter name="filePath">p:\CodingProjects\dnd-toolkit\docs\issues\MileStone 2\Tier 3\CONFIG_VERSIONING_USAGE_GUIDE.md