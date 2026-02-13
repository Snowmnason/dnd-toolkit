# Platform-Specific Configuration System

## Overview

The platform-specific configuration system allows you to define partial App Settings overrides for each platform (web, iOS, Android, desktop). This enables tuning infrastructure settings (thresholds, timeouts, network intervals) per platform without duplicating the entire config.

**Key Points:**
- Platform detection happens automatically at app startup
- Merge is applied once in `getAppConfig()` and cached
- No runtime overhead; all merging done during initialization
- Full TypeScript support; platform sections are `Partial<AppSettings>`
- Validator ensures platform names and values are valid

## How It Works

### 1. Platform Detection

The system detects the current platform via `getPlatformName()` in `lib/config/platform-config.ts`:
- **Electron** → `"desktop"`
- **React Native on iOS** → `"ios"`
- **React Native on Android** → `"android"`
- **Web (browser)** → `"web"`
- **Unknown** → `"unknown"` (no overrides applied)

### 2. Cascade/Override Model

**Top-Level Defaults:** Shared config that applies to all platforms
```json
{
  "thresholds": { "slowScreenMs": 3000, "slowRequestMs": 5000 },
  "network": { "pingIntervalMs": 600000, "pingTimeoutMs": 5000 }
}
```

**Platforms Section:** Per-platform *overrides* (partial config)
```json
{
  "platforms": {
    "ios": {
      "thresholds": { "slowScreenMs": 2000 },
      "network": { "pingIntervalMs": 60000 }
    }
  }
}
```

**Result on iOS:** Cascade merges base + overrides
```
thresholds.slowScreenMs = 2000       (← iOS override)
thresholds.slowRequestMs = 5000      (← falls back to base, not overridden)
network.pingIntervalMs = 60000       (← iOS override)
network.pingTimeoutMs = 5000         (← falls back to base)
```

### 3. Merge Strategy (Deep Merge)

- Start with shared config
- For each platform override:
  - If both base and override have an object at the same key → recursively merge
  - Otherwise → use override value
- Arrays are always replaced entirely (no array merging)
- `null` / `undefined` in override are skipped (don't remove base value)
- Result preserves all unspecified keys from shared config

## Configuration Examples

### Add Platform Overrides

Edit `config/appsettings.json` or `config/appsettings.dev.json`:

```json
{
  "version": 1,
  "description": "Production config with platform overrides",
  "environment": "production",
  
  // === SHARED DEFAULTS (apply to all platforms) ===
  "thresholds": {
    "slowScreenMs": 3000,
    "slowRequestMs": 5000
  },
  "network": {
    "pingIntervalMs": 600000,
    "pingTimeoutMs": 5000,
    "description": "Network health check settings (ping every 10 min, timeout 5s)"
  },
  
  // ... other shared config ...
  
  // === PLATFORM-SPECIFIC OVERRIDES (cascade pattern) ===
  "platforms": {
    "ios": {
      "thresholds": {
        "slowScreenMs": 2000,
        "slowRequestMs": 3000
      },
      "network": {
        "pingIntervalMs": 60000,
        "pingTimeoutMs": 10000
      },
      "description": "iOS: stricter thresholds (slower devices), more frequent health checks (less stable networks)"
    },
    "android": {
      "thresholds": {
        "slowScreenMs": 2000
      },
      "network": {
        "pingIntervalMs": 60000
      },
      "description": "Android: similar constraints to iOS (variable hardware, less stable networks)"
    },
    "web": {
      "thresholds": {
        "slowScreenMs": 5000,
        "slowRequestMs": 7000
      },
      "description": "Web: looser thresholds (desktop hardware is significantly faster)"
    },
    "desktop": {
      "thresholds": {
        "slowScreenMs": 4000
      },
      "description": "Desktop (Electron): between mobile and web in performance"
    }
  }
}
```

**Key Points:**
- **Top level:** All shared defaults that apply to every platform
- **`platforms` section:** Only the values that differ per platform (overrides)
- **Descriptions:** Explain WHY each platform differs (constraints, capabilities, network stability)
- **Unspecified values:** Fall back to shared defaults (no duplication needed)

### Per-Environment Values

The two config files allow different strategies per environment:

**Production** (`config/appsettings.json`):
```json
{
  "thresholds": { "slowScreenMs": 3000 },
  "platforms": {
    "ios": { "thresholds": { "slowScreenMs": 2000 } },
    "web": { "thresholds": { "slowScreenMs": 5000 } }
  }
}
```
- Shared: conservative defaults
- Platform overrides: mobile stricter (slower devices), web looser (faster)

**Development** (`config/appsettings.dev.json`):
```json
{
  "thresholds": { "slowScreenMs": 2500 },
  "platforms": {
    "ios": { "thresholds": { "slowScreenMs": 1000 } },
    "web": { "thresholds": { "slowScreenMs": 3000 } }
  }
}
```
- Shared: more permissive than production
- Platform overrides: extra aggressive testing on mobile

**Threshold Progression:**
```
Production:  mobile(2000) — base(3000) — web(5000)
Development: mobile(1000) — base(2500) — web(3000)
```

## API Reference

### `getPlatformName(): PlatformName | "unknown"`

Detects the current platform. Returns one of: `"web"`, `"ios"`, `"android"`, `"desktop"`, `"unknown"`.

```typescript
import { getPlatformName } from "@/lib/config/platform-config";

const platform = getPlatformName();
console.log(`Running on: ${platform}`);

if (platform === "ios" || platform === "android") {
  // Mobile-specific code
}
```

### `mergeConfigForPlatform(config: AppSettings, platform?: PlatformName): AppSettings`

Applies platform overrides to a config. If `platform` is not provided, calls `getPlatformName()` to detect it.

```typescript
import { mergeConfigForPlatform } from "@/lib/config/platform-config";
import type { AppSettings } from "@/lib/config/loader";

const baseConfig: AppSettings = { /* ... */ };
const mergedConfig = mergeConfigForPlatform(baseConfig, "ios");
// mergedConfig has iOS overrides applied
```

## Validation

The config validator (`lib/config/config-validator.ts`) ensures:

1. **Valid platform names:** Only `"web"`, `"ios"`, `"android"`, `"desktop"` allowed
2. **Partial objects:** Each platform override is a `Partial<AppSettings>` (object)
3. **No unknown platforms:** Rejects keys like `"web-mobile"`, `"iphone"`, etc.
4. **Clear error messages:** Example: `Invalid platform name: "iphone". Valid platforms are: web, ios, android, desktop.`

## Performance

- **No runtime overhead:** Merge happens once at startup in `getAppConfig()`
- **Cached result:** Merged config is cached; subsequent `getAppConfig()` calls return the same object
- **Deterministic:** Same input → same output every time

## Troubleshooting

### Config not applying to my platform

1. Check `getPlatformName()` returns expected value:
   ```typescript
   console.log("Platform:", getPlatformName());
   ```

2. Verify platform section exists in your config file:
   ```json
   "platforms": {
     "ios": { ... }
   }
   ```

3. Ensure your override key matches (lowercase, exact spelling):
   - ✅ `"ios"`, `"android"`, `"web"`, `"desktop"`
   - ❌ `"iOS"`, `"iphone"`, `"web-mobile"`

### Config values not changing

- Check merge is happening in `getAppConfig()` (should be after migration)
- Verify override is within a valid `Partial<AppSettings>` structure
- Ensure no syntax errors in config file (validate as JSON)

### Validation error: "Invalid platform"

Your config has a platform key that's not recognized. Valid keys: `web`, `ios`, `android`, `desktop`.

Example error:
```
Invalid platform name: "mobile". Valid platforms are: web, ios, android, desktop.
```

## Best Practices

1. **Start with shared config:** Define sensible defaults that work for all platforms
2. **Override only what differs:** Don't duplicate the entire config in platform sections
3. **Document why:** Add `description` fields to platform sections explaining the difference:
   ```json
   "platforms": {
     "ios": {
       "thresholds": { "slowScreenMs": 2000 },
       "description": "iOS: stricter thresholds for slower typical devices"
     }
   }
   ```
4. **Test per-platform:** Use feature flags or direct testing to verify your overrides work on each platform
5. **Keep it simple:** Use for infrastructure (thresholds, timeouts), not game logic (use featureFlags for that)

## Related

- Source: `lib/config/platform-config.ts`
- Types: `lib/config/loader.ts` (AppSettings interface)
- Validator: `lib/config/config-validator.ts`
- Config files: `config/appsettings.json`, `config/appsettings.dev.json`
- Kernel integration: `lib/config/loader.ts` (getAppConfig function)
