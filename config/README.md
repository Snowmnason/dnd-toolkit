# Config Module

Application configuration management providing environment-specific settings, validation, and runtime configuration. Handles config loading, validation, and environment detection. Pure configuration layer with no business logic.

## When to Use This Module

**Use this module for:**

- Loading application settings from files
- Environment-specific configuration
- Configuration validation
- Runtime config access
- Platform-specific overrides

**Don't use this module for:**

- Business logic configuration (belongs in lib modules)
- UI configuration (belongs in components)
- Dynamic config updates (belongs in lib modules)
- Config file generation (belongs in scripts)

## Architecture & Data Flow

```
Environment → Config Files → Validation → Runtime Config
                                       ↓
Platform Overrides → Merging → Cached Config
```

**Key Components:**

- **Config Loader**: Loads and merges config files
- **Validator**: Validates config structure
- **Platform Merger**: Applies platform-specific overrides
- **Cache**: Caches loaded configuration

## API Reference

### Config Loading

#### `getAppConfig(): AppSettings`

Get merged application configuration.

```typescript
import { getAppConfig } from '@/config';

const config = getAppConfig();
console.log(config.api.baseUrl);
```

#### `resetCachedConfig(): void`

Reset cached configuration.

```typescript
resetCachedConfig(); // Force reload on next access
```

### Environment Detection

#### `isDevelopment(): boolean`

Check if running in development.

```typescript
if (isDevelopment()) {
  // Development-only logic
}
```

#### `isProduction(): boolean`

Check if running in production.

```typescript
if (isProduction()) {
  // Production logic
}
```

## Dependencies

### External

- **None** – Pure configuration

### Internal

- **`lib/utils/logger`** – Config loading logging

## Error Handling & Edge Cases

### Missing Config Files

Falls back to defaults with warnings.

### Invalid Config

Validation errors with detailed messages.

### Environment Mismatch

Platform-specific fallbacks.

### Cache Corruption

Reloads config from files.

## Performance Notes

- **Caching**: Config loaded once and cached
- **Validation**: Fast schema validation
- **Merging**: Efficient deep merge operations
- **Memory**: Small config objects

## Related Modules

- **`lib/config`** – Business logic configuration
- **`system/Kernel`** – Bootstrap config loading
- **`lib/utils`** – Environment utilities

## File Breakdown

| File | Purpose |
| --- | --- |
| `core/loader.ts` | Main config loading logic |
| `core/validator.ts` | Config validation |
| `appsettings.json` | Production configuration |
| `appsettings.dev.json` | Development configuration |
| `index.ts` | Barrel export |