# How to Use Runtime Config Hot-Reload

## Overview

Runtime config hot-reload enables automatic reloading of `appsettings.dev.json` changes during development without requiring an app restart. This feature polls the config file for changes and reapplies the full config pipeline (load → migrate → merge → validate) when modifications are detected.

## When to Use

- **Development Only**: Hot-reload is automatically disabled in production builds
- **Config Testing**: Quickly test config changes without rebuilding the app
- **Feature Flag Development**: Iterate on feature flags and settings in real-time
- **Debugging**: See immediate effects of config changes on app behavior

## Prerequisites

- App must be running in development mode (`EXPO_PUBLIC_ENVIRONMENT=development`)
- `appsettings.dev.json` must exist and be valid JSON
- Hot-reload is initialized automatically during app startup

## Basic Usage

### Automatic Initialization

Hot-reload starts automatically when the app boots in development mode. No manual setup required.

```typescript
// Hot-reload is initialized in lib/kernel/app-kernel.ts
// No code changes needed in your components
```

### Checking Availability

```typescript
import { isHotReloadAvailable } from "@/lib/config";

if (isHotReloadAvailable()) {
  console.log("Hot-reload is active");
}
```

### Getting the Hot-Reload Instance

```typescript
import { getHotReload } from "@/lib/config";

const hotReload = getHotReload();
if (hotReload) {
  // Hot-reload is available
}
```

## Advanced Usage

### Subscribing to Config Changes

Subscribe to config updates to react to changes in your components:

```typescript
import { getHotReload } from "@/lib/config";

const hotReload = getHotReload();
if (hotReload) {
  const unsubscribe = hotReload.subscribe((newConfig) => {
    console.log("Config updated:", newConfig);
    // Update your component state or re-initialize features
  });

  // Don't forget to unsubscribe when component unmounts
  return unsubscribe;
}
```

### Manual Control

While hot-reload runs automatically, you can control it programmatically:

```typescript
import { getHotReload } from "@/lib/config";

const hotReload = getHotReload();
if (hotReload) {
  // Stop polling
  hotReload.stop();

  // Start polling again
  hotReload.start();

  // Force a reload check
  hotReload.checkForChanges();
}
```

## Integration Examples

### Feature Flag Component

```typescript
import React, { useEffect, useState } from "react";
import { getAppConfig, getHotReload } from "@/lib/config";

export const FeatureFlagDemo: React.FC = () => {
  const [config, setConfig] = useState(getAppConfig());

  useEffect(() => {
    const hotReload = getHotReload();
    if (!hotReload) return;

    const unsubscribe = hotReload.subscribe((newConfig) => {
      setConfig(newConfig);
    });

    return unsubscribe;
  }, []);

  return (
    <div>
      <p>Feature enabled: {config.featureFlags.someFeature?.enabled ? "Yes" : "No"}</p>
    </div>
  );
};
```

### Logger Category Updates

```typescript
import { getHotReload } from "@/lib/config";
import { logger } from "@/lib/utils/logger";

const hotReload = getHotReload();
if (hotReload) {
  hotReload.subscribe((newConfig) => {
    // Update logger categories dynamically
    logger.updateCategories(newConfig.featureFlags.loggerCategories?.categories || {});
  });
}
```

## Troubleshooting

### Hot-Reload Not Working

1. **Check Development Mode**: Ensure `EXPO_PUBLIC_ENVIRONMENT=development`
2. **Verify File Path**: Config file must be at `config/appsettings.dev.json`
3. **Check Console**: Look for hot-reload initialization logs in development console
4. **File Permissions**: Ensure the config file is writable and not locked by another process

### Config Changes Not Applying

1. **Save the File**: Changes are detected on file save/modification time changes
2. **Valid JSON**: Invalid JSON will log errors but won't apply changes
3. **Migration Issues**: If config version changes, ensure migrations are available
4. **Validation Failures**: Check console for validation errors that prevent config application

### Performance Issues

- **Polling Frequency**: Default 1-second polling; reduce if causing performance issues
- **Large Config Files**: Hot-reload processes the full pipeline on each change
- **Frequent Changes**: Consider manual reload for rapid successive changes

## Limitations

- **Development Only**: Disabled in production builds
- **File System Access**: Requires ability to read config files from disk
- **JSON Only**: Only supports JSON config files
- **No Rollback**: Changes are applied immediately; no undo mechanism
- **Single File**: Only watches `appsettings.dev.json`; platform overrides not hot-reloaded

## Best Practices

1. **Test in Development**: Always test config changes in dev mode first
2. **Version Control**: Commit config changes separately from code changes
3. **Documentation**: Document feature flags and their effects
4. **Validation**: Use strict validation to catch config errors early
5. **Performance**: Be mindful of subscribers; unsubscribe when not needed
6. **Error Handling**: Handle config update failures gracefully in subscribers