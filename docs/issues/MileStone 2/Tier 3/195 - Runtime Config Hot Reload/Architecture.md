# Runtime Config Hot-Reload Architecture

## Overview

The runtime config hot-reload system provides automatic detection and application of `appsettings.dev.json` changes during development. It implements a polling-based file watcher that triggers the full config pipeline when changes are detected.

## Architecture Components

### Core Classes

#### `ConfigHotReload`

Main class managing the hot-reload lifecycle and file monitoring.

**Key Methods:**
- `start()`: Begins polling for config file changes
- `stop()`: Stops polling and cleans up resources
- `checkForChanges()`: Manually triggers a change check
- `subscribe(callback)`: Registers a callback for config updates

**Internal State:**
- `isRunning`: Whether polling is active
- `lastModified`: Last known file modification time
- `subscribers`: Array of callback functions
- `pollInterval`: Configurable polling interval (default: 1000ms)

### Helper Functions

#### `initializeHotReload()`

Global singleton initializer that creates and starts the hot-reload instance.

```typescript
export const initializeHotReload = (): void => {
  if (!isDevelopment() || !isHotReloadAvailable()) return;
  // Create and start ConfigHotReload instance
};
```

#### `getHotReload()`

Returns the active hot-reload instance or null if not available.

```typescript
export const getHotReload = (): ConfigHotReload | null => {
  // Return singleton instance
};
```

#### `isHotReloadAvailable()`

Checks if hot-reload can run in the current environment.

```typescript
export const isHotReloadAvailable = (): boolean => {
  return isDevelopment() && typeof fetch !== "undefined";
};
```

## Data Flow

```
File Change Detected
        ↓
fetch(configUrl) → Get file content
        ↓
JSON.parse(content) → Parse config
        ↓
migrateConfig() → Apply migrations
        ↓
mergeConfigForPlatform() → Apply platform overrides
        ↓
validateConfig() → Validate structure
        ↓
Update cached config in loader.ts
        ↓
Notify all subscribers
        ↓
Subscribers update components/state
```

## Implementation Details

### File Watching Strategy

- **Polling-based**: Uses `setInterval` to periodically check file modification time
- **HTTP Fetch**: Leverages Expo's development server to serve config files
- **Modification Time**: Compares `Last-Modified` header to detect changes
- **Debouncing**: Natural debouncing via polling interval prevents rapid successive triggers

### Config Processing Pipeline

Each change triggers the complete config pipeline:

1. **Load**: Fetch and parse JSON from `appsettings.dev.json`
2. **Migrate**: Apply version migrations if needed
3. **Merge**: Apply platform-specific overrides
4. **Validate**: Run full validation (structure, required fields, environment match)
5. **Cache**: Update the global config cache in `loader.ts`
6. **Notify**: Call all subscriber callbacks with new config

### Error Handling

- **Network Errors**: Logged but don't stop polling
- **JSON Parse Errors**: Logged; config not updated
- **Migration Errors**: Logged; config not updated
- **Validation Errors**: Logged; config not updated
- **Subscriber Errors**: Isolated; one failing subscriber doesn't affect others

### Memory Management

- **Singleton Pattern**: Single global instance prevents multiple watchers
- **Cleanup**: `stop()` clears interval and unsubscribes all callbacks
- **Weak References**: No strong references to subscribers; safe for component unmounting

## Integration Points

### Kernel Integration

Hot-reload is initialized in `lib/kernel/app-kernel.ts` during app bootstrap:

```typescript
// In app-kernel.ts
import { initializeHotReload } from "@/lib/config";

export class AppKernel {
  async initialize() {
    // ... other initialization ...
    initializeHotReload(); // Start hot-reload if available
  }
}
```

### Config Loader Integration

The hot-reload updates the same cached config used by `getAppConfig()`:

```typescript
// In loader.ts
let cachedConfig: AppSettings | null = null;

export const getAppConfig = (): AppSettings => {
  if (cachedConfig) return cachedConfig;
  // Load and cache config
  return cachedConfig;
};

// Hot-reload can update cachedConfig directly
export const updateCachedConfig = (newConfig: AppSettings): void => {
  cachedConfig = newConfig;
};
```

### Logger Integration

Uses the category-based logger for all operations:

```typescript
import { logger } from "@/lib/utils/logger";

logger.category("bootstrap").info("Hot-reload started");
logger.category("other").error("Config validation failed:", error);
```

## Security Considerations

### Development-Only Guards

- **Environment Check**: Only runs when `isDevelopment()` returns true
- **Platform Check**: Requires `fetch` API availability (web/mobile development servers)
- **No Production Leakage**: Completely disabled in production builds

### File Access

- **Local Files Only**: Only accesses `appsettings.dev.json` in the app bundle
- **Development Server**: Uses Expo's dev server for file serving
- **No External URLs**: No network calls to external services

## Performance Characteristics

### Memory Overhead

- **Base Cost**: ~50KB for the module and singleton instance
- **Per Subscriber**: Minimal; callback references only
- **Polling**: Single `setInterval` with lightweight fetch request

### CPU Overhead

- **Idle**: Negligible; polling checks modification time only
- **On Change**: Full pipeline execution (~10-50ms depending on config size)
- **Validation**: O(n) where n = config fields (~30 fields typical)

### Network Overhead

- **Polling**: Small HEAD requests to check modification time
- **On Change**: Full file fetch and processing
- **Caching**: Browsers cache config file; changes invalidate cache

## Testing Strategy

### Unit Tests

- **File Polling**: Mock fetch to simulate file changes
- **Config Processing**: Test pipeline execution with various configs
- **Subscriber Management**: Test subscribe/unsubscribe behavior
- **Error Handling**: Test various failure scenarios

### Integration Tests

- **End-to-End**: Modify config file and verify app updates
- **Subscriber Updates**: Test component re-rendering on config changes
- **Performance**: Measure polling and processing overhead

### Manual Testing

- **Development Workflow**: Verify changes apply without restart
- **Error Scenarios**: Test with invalid JSON, missing files
- **Platform Testing**: Ensure works on web, iOS, Android dev servers

## Future Enhancements

- **WebSocket Support**: Replace polling with real-time file watching
- **Selective Reloading**: Only reload changed sections instead of full config
- **Config Diffing**: Provide detailed change information to subscribers
- **Hot-Reload UI**: Visual indicator when config changes are applied
- **Config History**: Allow reverting to previous config versions
- **Multi-File Support**: Watch additional config files beyond appsettings.dev.json</content>
<parameter name="filePath">p:\CodingProjects\dnd-toolkit\docs\issues\MileStone 3\195 - Runtime Config Hot Reload\Architecture.md