# Cache Versioning

Cache versioning prevents app breakage after deployments by validating stored data against expected schemas and handling version mismatches gracefully.

## Quick Start

```typescript
import { SecureStorage } from '@/lib/storage';
import { CacheSchema, CURRENT_CACHE_VERSION } from '@/lib/storage/cache-versioning';

// Define your data schema
const USER_PREFERENCES_SCHEMA: CacheSchema<UserPreferences> = {
  version: CURRENT_CACHE_VERSION,
  validate: (data: any) => {
    return (
      typeof data === 'object' &&
      data !== null &&
      typeof data.theme === 'string' &&
      typeof data.scale === 'number'
    );
  },
  migrate: (oldData: any, oldVersion: number) => {
    // Handle migrations from older versions
    if (oldVersion < CURRENT_CACHE_VERSION) {
      return {
        theme: oldData?.theme || 'default',
        scale: oldData?.scale || 1.0,
      };
    }
    return null; // Reset if migration fails
  },
};

// Store versioned data
await SecureStorage.setVersionedJSON(
  STORAGE_KEYS.USER_PREFERENCES,
  { theme: 'dark', scale: 1.2 },
  CURRENT_CACHE_VERSION
);

// Retrieve with automatic validation & migration
const prefs = await SecureStorage.getValidatedJSON(
  STORAGE_KEYS.USER_PREFERENCES,
  USER_PREFERENCES_SCHEMA
);
```

## API Reference

### CacheSchema<T>

Interface for defining versioned data structures.

```typescript
interface CacheSchema<T = any> {
  version: number;                    // Expected version number
  validate: (data: any) => boolean;   // Function to validate data structure
  migrate?: (oldData: any, oldVersion: number) => T | null; // Optional migration function
}
```

### SecureStorage Methods

#### setVersionedJSON<T>(key: string, value: T, version: number)

Stores data with version metadata.

```typescript
await SecureStorage.setVersionedJSON('my_key', data, CURRENT_CACHE_VERSION);
```

#### getValidatedJSON<T>(key: string, schema: CacheSchema<T>)

Retrieves data with automatic validation and migration.

```typescript
const data = await SecureStorage.getValidatedJSON('my_key', MY_SCHEMA);
// Returns T | null - null if validation/migration failed
```

### Constants

- `CURRENT_CACHE_VERSION`: Current cache version (increment on breaking changes)

## Adding Versioning to New Data Types

1. **Define Schema**: Create a `CacheSchema` with validation and optional migration logic.

```typescript
const MY_DATA_SCHEMA: CacheSchema<MyData> = {
  version: CURRENT_CACHE_VERSION,
  validate: (data: any) => {
    // Return true if data structure is valid
    return typeof data.field === 'string' && Array.isArray(data.items);
  },
  migrate: (oldData: any, oldVersion: number) => {
    // Transform old data to new format, or return null to reset
    if (oldVersion === 0) {
      return { field: oldData.field || '', items: oldData.items || [] };
    }
    return null;
  },
};
```

2. **Use Versioned Storage**: Replace `setJSON()`/`getJSON()` with versioned methods.

```typescript
// Instead of:
await SecureStorage.setJSON(key, data);
const data = await SecureStorage.getJSON(key);

// Use:
await SecureStorage.setVersionedJSON(key, data, CURRENT_CACHE_VERSION);
const data = await SecureStorage.getValidatedJSON(key, MY_SCHEMA);
```

3. **Handle Null Returns**: Always check for null when using `getValidatedJSON()`.

```typescript
const data = await SecureStorage.getValidatedJSON(key, schema);
if (data === null) {
  // Handle missing/invalid data (use defaults, show error, etc.)
  return getDefaultData();
}
```

## Migration Strategies

### Simple Field Addition

```typescript
migrate: (oldData: any, oldVersion: number) => {
  if (oldVersion < 2) {
    return {
      ...oldData,
      newField: 'default_value',
    };
  }
  return oldData;
},
```

### Data Structure Changes

```typescript
migrate: (oldData: any, oldVersion: number) => {
  if (oldVersion < 3) {
    // Transform old array format to new object format
    return {
      items: oldData.map(item => ({ id: item, value: item })),
    };
  }
  return oldData;
},
```

### Breaking Changes

```typescript
migrate: (oldData: any, oldVersion: number) => {
  if (oldVersion < 4) {
    // Complete rewrite - return null to reset
    return null;
  }
  return oldData;
},
```

## Troubleshooting

### Data Always Returns Null

- Check schema validation function - ensure it returns `true` for valid data
- Verify migration function handles all old versions
- Check logs for validation errors

### Migration Not Running

- Ensure `CURRENT_CACHE_VERSION` is incremented for breaking changes
- Verify stored data has a `version` field (legacy data without versioning will attempt migration)

### Performance Issues

- Migrations run synchronously on first access after update
- Consider lazy migration for large datasets
- Use background processing for non-critical migrations

## Best Practices

- **Increment Version**: Always increment `CURRENT_CACHE_VERSION` when changing data schemas
- **Test Migrations**: Test migration paths from all previous versions
- **Handle Null Safely**: Always check for null returns from `getValidatedJSON()`
- **Log Validation**: Use logger for debugging validation issues
- **Minimal Schemas**: Keep validation functions focused on required fields
- **Graceful Fallbacks**: Provide sensible defaults when data is invalid/reset
- **Version Comments**: Document what changed in each version increment

## Examples

### User Settings

```typescript
const USER_SETTINGS_SCHEMA: CacheSchema<UserSettings> = {
  version: CURRENT_CACHE_VERSION,
  validate: (data: any) => {
    return (
      typeof data === 'object' &&
      typeof data.notifications === 'boolean' &&
      typeof data.language === 'string'
    );
  },
  migrate: (oldData: any, oldVersion: number) => {
    if (oldVersion < 2) {
      return {
        notifications: oldData?.notifications ?? true,
        language: oldData?.language ?? 'en',
        theme: 'light', // New field added in v2
      };
    }
    return oldData;
  },
};
```

### Game State

```typescript
const GAME_STATE_SCHEMA: CacheSchema<GameState> = {
  version: CURRENT_CACHE_VERSION,
  validate: (data: any) => {
    return (
      typeof data.level === 'number' &&
      Array.isArray(data.inventory) &&
      typeof data.score === 'number'
    );
  },
  migrate: (oldData: any, oldVersion: number) => {
    if (oldVersion < 3) {
      // Migrate from old format where inventory was an object
      return {
        level: oldData.level || 1,
        inventory: Array.isArray(oldData.inventory)
          ? oldData.inventory
          : Object.values(oldData.inventory || {}),
        score: oldData.score || 0,
      };
    }
    return oldData;
  },
};
```