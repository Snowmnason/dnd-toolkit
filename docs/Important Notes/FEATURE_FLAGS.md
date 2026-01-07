# Feature Flags System

A simple JSON-based feature flag system for toggling features during development and testing without code changes. Flags now live inside `config/appsettings.*.json` under the `featureFlags` key.

## Usage

### Checking flags in code

```typescript
import { FeatureFlags } from '@/lib/feature-flags';

// Check if a feature is enabled
if (FeatureFlags.isEnabled('splashScreen')) {
  // Show splash screen
}

// Get flag description
const description = FeatureFlags.getDescription('splashScreen');
```

### Toggling flags

#### Via config file (persistent)

Edit `config/appsettings.dev.json` (for local) or `config/appsettings.json` (for prod defaults):

```json
{
  "featureFlags": {
    "splashScreen": {
      "enabled": true,
      "description": "Show splash screen on app load"
    }
  }
}
```

#### Via dev console (runtime only, not persistent)

Open browser console and type:

```javascript
// Toggle a flag on
FeatureFlags.toggle('splashScreen', true);

// Toggle a flag off
FeatureFlags.toggle('splashScreen', false);

// View all flags
FeatureFlags.getAllFlags();
```

Runtime toggles are lost on page refresh.

## Available Flags

### `splashScreen`
- **Default**: `true`
- **Description**: Show splash screen on app load (after bootstrap + 1s buffer)
- **Impact**: When enabled, displays a splash screen before the app content. When disabled, skips splash and goes straight to content after bootstrap.

### `debugLogs`
- **Default**: `false`
- **Description**: Enable verbose debug logging throughout the app
- **Impact**: Reserved for future use; currently not implemented.

### `skipAuth`
- **Default**: `false`
- **Description**: Skip authentication checks (for local testing only)
- **Impact**: Reserved for future use; currently not implemented.

## Adding New Flags

1. Add the flag to `config/appsettings.dev.json` (and mirror the key in `config/appsettings.json`):
   ```json
   {
     "featureFlags": {
       "myNewFeature": {
         "enabled": false,
         "description": "Description of my new feature"
       }
     }
   }
   ```

2. Use it in code:
   ```typescript
   if (FeatureFlags.isEnabled('myNewFeature')) {
     // Feature logic
   }
   ```

## Notes

- Feature flags are checked at runtime
- Config file changes require app restart (web: refresh, native: reload)
- Console toggles work immediately but don't persist across refreshes
- The system is exposed to `window.FeatureFlags` for easy console access on web
- Config Files: `config/appsettings.{dev,json}` (`featureFlags`); beta flags enabled in production log a warning; helpers can toggle by kind
